// Edge function: delete-account
//
// Permanently deletes the authenticated user's account and all related data.
// Required for App Store compliance — Apple Guideline 5.1.1(v) states that any
// app offering account creation must also offer in-app account deletion.
//
// Flow:
//   1. Validate the caller's JWT and resolve their user_id.
//   2. Delete their rows across user-owned tables. Most child tables (vaccines,
//      weight_records, foods, etc.) cascade from `pets`, but we also clean the
//      top-level tables the user can own directly.
//   3. Call `auth.admin.deleteUser()` with the service-role client to remove
//      the auth record itself. This invalidates all sessions.
//
// Security:
//   - Uses two Supabase clients: one anon-scoped to validate the caller,
//     one service-role to perform the deletion.
//   - Service-role key is pulled from the SUPABASE_SERVICE_ROLE_KEY secret.
//     Never expose this to the client.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { runRequiredOperations } from './helpers.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Missing environment configuration' }, 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }

    // Client scoped to the caller — used only to identify the user.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: 'Invalid or expired session' }, 401);
    }

    const userId = user.id;

    // Service-role client — bypasses RLS to clean data + delete the auth user.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Storage cleanup BEFORE deleting pets rows: pet photos live under
    // pet-photos/{userId}/... — list the folder and remove every object.
    // These operations are required: deleting Auth while files survive would
    // leave personal data without an owner who can retry the cleanup.
    const { data: photoFiles, error: photoListError } = await admin.storage
      .from('pet-photos')
      .list(userId);
    if (photoListError) {
      console.error('[delete-account] pet-photos list failed:', photoListError);
      return json({ error: 'No se pudieron eliminar todos los archivos de la cuenta.' }, 500);
    }
    if (photoFiles && photoFiles.length > 0) {
      const paths = photoFiles.map((f) => `${userId}/${f.name}`);
      const { error: photoRemoveError } = await admin.storage.from('pet-photos').remove(paths);
      if (photoRemoveError) {
        console.error('[delete-account] pet-photos remove failed:', photoRemoveError);
        return json({ error: 'No se pudieron eliminar todos los archivos de la cuenta.' }, 500);
      }
    }
    // Flight documents live under flight-docs/{userId}/{flightId}/... —
    // list is not recursive, so walk one level of flight folders.
    const { data: flightFolders, error: flightFolderError } = await admin.storage
      .from('flight-docs')
      .list(userId);
    if (flightFolderError) {
      console.error('[delete-account] flight-docs list failed:', flightFolderError);
      return json({ error: 'No se pudieron eliminar todos los archivos de la cuenta.' }, 500);
    }
    for (const folder of flightFolders ?? []) {
      const folderPath = `${userId}/${folder.name}`;
      const { data: docs, error: docsListError } = await admin.storage
        .from('flight-docs')
        .list(folderPath);
      if (docsListError) {
        console.error('[delete-account] flight-docs folder list failed:', folderPath, docsListError);
        return json({ error: 'No se pudieron eliminar todos los archivos de la cuenta.' }, 500);
      }
      if (docs && docs.length > 0) {
        const { error: docsRemoveError } = await admin.storage
          .from('flight-docs')
          .remove(docs.map((d) => `${folderPath}/${d.name}`));
        if (docsRemoveError) {
          console.error('[delete-account] flight-docs remove failed:', folderPath, docsRemoveError);
          return json({ error: 'No se pudieron eliminar todos los archivos de la cuenta.' }, 500);
        }
      }
    }

    // Si el usuario tiene una suscripción web (Paddle), cancelarla de inmediato
    // ANTES de borrar sus datos — si no, Paddle podría seguir cobrando a una
    // cuenta que ya no existe. Si no podemos verificar o cancelar, detenemos el
    // borrado para que el usuario conserve acceso y pueda reintentarlo.
    try {
      const { data: sub, error: subscriptionError } = await admin
        .from('user_subscriptions')
        .select('source, paddle_subscription_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (subscriptionError) {
        console.error('[delete-account] subscription lookup failed:', subscriptionError);
        return json({ error: 'No se pudo verificar la suscripción de la cuenta.' }, 500);
      }
      if (sub?.source === 'web' && sub.paddle_subscription_id) {
        const paddleApiKey = Deno.env.get('PADDLE_API_KEY');
        if (!paddleApiKey) {
          console.error('[delete-account] PADDLE_API_KEY is missing for a web subscription');
          return json({ error: 'No se pudo cancelar la suscripción web.' }, 500);
        }
        const paddleEnv = Deno.env.get('PADDLE_ENV') ?? 'sandbox';
        const apiBase = paddleEnv === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
        const paddleHeaders = {
          'Authorization': `Bearer ${paddleApiKey}`,
          'Content-Type': 'application/json',
        };

        // The delete flow must be safe to retry. Paddle cannot cancel an
        // already canceled subscription again, so read its current status
        // before issuing the irreversible cancellation request.
        const lookupRes = await fetch(`${apiBase}/subscriptions/${sub.paddle_subscription_id}`, {
          headers: paddleHeaders,
        });
        if (!lookupRes.ok) {
          console.error('[delete-account] paddle lookup failed:', lookupRes.status, await lookupRes.text());
          return json({ error: 'No se pudo verificar la suscripción web.' }, 502);
        }
        const paddleSubscription = await lookupRes.json();
        if (paddleSubscription?.data?.status !== 'canceled') {
          const cancelRes = await fetch(`${apiBase}/subscriptions/${sub.paddle_subscription_id}/cancel`, {
            method: 'POST',
            headers: paddleHeaders,
            body: JSON.stringify({ effective_from: 'immediately' }),
          });
          if (!cancelRes.ok) {
            console.error('[delete-account] paddle cancel failed:', cancelRes.status, await cancelRes.text());
            return json({ error: 'No se pudo cancelar la suscripción web.' }, 502);
          }
        }
      }
    } catch (e) {
      console.error('[delete-account] paddle cancellation threw:', e);
      return json({ error: 'No se pudo cancelar la suscripción web.' }, 502);
    }

    // Delete user-owned rows. Child tables (vaccines, foods, etc.) cascade
    // through `pet_id`, so removing `pets` propagates those automatically.
    // Every row where this user appears as owner, grantee, inviter, or
    // referrer/referred must be cleaned explicitly — none of those cascade
    // from `auth.users` in the current schema.
    const deletionFailures = await runRequiredOperations([
      { name: 'pet_share_invites.inviter_id', run: () => admin.from('pet_share_invites').delete().eq('inviter_id', userId) },
      { name: 'pet_share_invites.accepted_by', run: () => admin.from('pet_share_invites').delete().eq('accepted_by', userId) },
      { name: 'pet_shares.shared_with', run: () => admin.from('pet_shares').delete().eq('shared_with', userId) },
      { name: 'pet_shares.owner_id', run: () => admin.from('pet_shares').delete().eq('owner_id', userId) },
      { name: 'referrals.referrer_id', run: () => admin.from('referrals').delete().eq('referrer_id', userId) },
      { name: 'referrals.referred_id', run: () => admin.from('referrals').delete().eq('referred_id', userId) },
      { name: 'referral_codes', run: () => admin.from('referral_codes').delete().eq('user_id', userId) },
      // Device push tokens + in-app notifications — without these, "zombie"
      // rows survive account deletion (GDPR gap + skewed analytics).
      { name: 'push_tokens', run: () => admin.from('push_tokens').delete().eq('user_id', userId) },
      { name: 'notifications', run: () => admin.from('notifications').delete().eq('user_id', userId) },
      { name: 'owner_profiles', run: () => admin.from('owner_profiles').delete().eq('user_id', userId) },
      // Parent records are last so foreign-key dependants are already gone.
      { name: 'pets', run: () => admin.from('pets').delete().eq('user_id', userId) },
      { name: 'user_subscriptions', run: () => admin.from('user_subscriptions').delete().eq('user_id', userId) },
      { name: 'profiles', run: () => admin.from('profiles').delete().eq('id', userId) },
    ]);

    // Never delete Auth if any owned data could not be removed. The account
    // remains available so the user can retry and support can diagnose the
    // exact table instead of leaving orphaned personal data.
    if (deletionFailures.length > 0) {
      for (const failure of deletionFailures) {
        console.error('[delete-account] required deletion failed:', failure.name, failure.error);
      }
      return json({ error: 'No se pudieron eliminar todos los datos de la cuenta.' }, 500);
    }

    // Finally, delete the auth user. This is the point of no return.
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error('[delete-account] auth delete failed:', deleteUserError);
      return json({ error: 'No se pudo eliminar la cuenta. Contacta soporte.' }, 500);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    console.error('[delete-account] unexpected error:', e);
    return json({ error: 'Unexpected server error' }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}
