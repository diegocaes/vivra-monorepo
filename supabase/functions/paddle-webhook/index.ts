// Paddle webhook → activa/actualiza Vivra Premium (source: 'web').
//
// Deploy:  npx supabase functions deploy paddle-webhook --project-ref upjiewrirkzhjeciwugg --no-verify-jwt
// Secrets: npx supabase secrets set PADDLE_WEBHOOK_SECRET=pdl_ntfset_... --project-ref upjiewrirkzhjeciwugg
//
// En Paddle: Developer Tools → Notifications → crear destino apuntando a
// https://upjiewrirkzhjeciwugg.supabase.co/functions/v1/paddle-webhook
// con los eventos: subscription.activated, subscription.updated, subscription.canceled.
//
// El checkout debe enviar customData: { user_id } (lo hace /premium en la web).

import { createClient } from 'npm:@supabase/supabase-js@2';

const encoder = new TextEncoder();

/** Verifica la firma Paddle-Signature: HMAC-SHA256 de `${ts}:${rawBody}` con el secret. */
async function verifyPaddleSignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(';').map((p) => p.split('=') as [string, string]));
  const ts = parts['ts'];
  const h1 = parts['h1'];
  if (!ts || !h1) return false;

  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${ts}:${rawBody}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === h1;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[paddle-webhook] PADDLE_WEBHOOK_SECRET not set');
    return new Response('Not configured', { status: 500 });
  }

  const rawBody = await req.text();
  const valid = await verifyPaddleSignature(rawBody, req.headers.get('Paddle-Signature'), secret);
  if (!valid) {
    console.warn('[paddle-webhook] invalid signature');
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const type: string = event.event_type ?? '';
  const data = event.data ?? {};

  // Solo nos interesan eventos de suscripción.
  if (!type.startsWith('subscription.')) {
    return new Response('ignored', { status: 200 });
  }

  const userId: string | undefined = data.custom_data?.user_id;
  if (!userId) {
    console.warn(`[paddle-webhook] ${type} without custom_data.user_id — skipping`);
    return new Response('no user_id', { status: 200 });
  }

  // Fin del período pagado. En 'canceled' Paddle manda scheduled_change o el
  // período vigente: el usuario conserva premium hasta esa fecha y la expiración
  // natural (evaluatePremium + cron) lo baja a free sin tocar nada más.
  const periodEnd: string | null =
    data.current_billing_period?.ends_at ??
    data.scheduled_change?.effective_at ??
    null;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  if (['subscription.created', 'subscription.activated', 'subscription.updated', 'subscription.resumed'].includes(type)) {
    const status: string = data.status ?? '';
    // 'active' y 'trialing' otorgan premium; otros estados (paused, past_due) no extienden.
    if (['active', 'trialing'].includes(status) && periodEnd) {
      const { error } = await supabase.from('user_subscriptions').upsert({
        user_id: userId,
        plan: 'premium',
        source: 'web',
        premium_until: periodEnd,
        paddle_subscription_id: data.id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) {
        console.error('[paddle-webhook] upsert failed:', error.message);
        return new Response('db error', { status: 500 });
      }
      console.log(`[paddle-webhook] ${type}: premium hasta ${periodEnd} para ${userId}`);
    }
  } else if (type === 'subscription.canceled') {
    // No demote inmediato: si periodEnd existe se respeta; si Paddle canceló en
    // el acto (ends_at pasado o nulo), premium_until queda como esté y expira solo.
    if (periodEnd) {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({ premium_until: periodEnd, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('source', 'web');
      if (error) console.error('[paddle-webhook] cancel update failed:', error.message);
    }
    console.log(`[paddle-webhook] canceled para ${userId}, acceso hasta ${periodEnd ?? 'fin ya registrado'}`);
  }

  return new Response('ok', { status: 200 });
});
