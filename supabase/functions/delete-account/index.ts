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

    // Delete user-owned rows. Child tables (vaccines, foods, etc.) cascade
    // through `pet_id`, so removing `pets` propagates those automatically.
    // Every row where this user appears as owner, grantee, inviter, or
    // referrer/referred must be cleaned explicitly — none of those cascade
    // from `auth.users` in the current schema.
    const deletions = await Promise.allSettled([
      admin.from('pets').delete().eq('user_id', userId),
      admin.from('pet_shares').delete().eq('shared_with', userId),
      admin.from('pet_shares').delete().eq('owner_id', userId),
      admin.from('pet_share_invites').delete().eq('inviter_id', userId),
      admin.from('pet_share_invites').delete().eq('accepted_by', userId),
      admin.from('referrals').delete().eq('referrer_id', userId),
      admin.from('referrals').delete().eq('referred_id', userId),
      admin.from('referral_codes').delete().eq('user_id', userId),
      admin.from('user_subscriptions').delete().eq('user_id', userId),
      admin.from('profiles').delete().eq('id', userId),
    ]);

    // Log non-critical delete errors but keep going — missing tables are OK
    // (some may not exist yet, and the auth delete is the hard requirement).
    for (const d of deletions) {
      if (d.status === 'rejected') {
        console.warn('[delete-account] soft-fail on child delete:', d.reason);
      }
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
