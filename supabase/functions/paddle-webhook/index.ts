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
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Verifica la firma Paddle-Signature: HMAC-SHA256 de `${ts}:${rawBody}` con el secret. */
async function verifyPaddleSignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(';').map((part) => part.trim().split('=', 2));
  const ts = parts.find(([key]) => key === 'ts')?.[1];
  const signatures = parts.filter(([key, value]) => key === 'h1' && value).map(([, value]) => value);
  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(Date.now() - timestamp * 1000) > MAX_SIGNATURE_AGE_MS) return false;

  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${ts}:${rawBody}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return signatures.some((signature) => constantTimeEquals(hex, signature));
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

  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const type: string = event.event_type ?? '';
  const data = event.data ?? {};

  // Solo nos interesan eventos de suscripción.
  if (!type.startsWith('subscription.')) {
    return new Response('ignored', { status: 200 });
  }

  const userId = data.custom_data?.user_id;
  if (!isUuid(userId)) {
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

  const occurredAt = typeof event.occurred_at === 'string' ? event.occurred_at : null;
  const occurredAtMs = occurredAt ? new Date(occurredAt).getTime() : NaN;
  const eventId = typeof event.event_id === 'string' ? event.event_id : null;
  const { data: current, error: currentError } = await supabase
    .from('user_subscriptions')
    .select('source, premium_until, referral_days_balance, web_event_timestamp, web_event_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (currentError) return new Response('db error', { status: 500 });
  if (eventId && current?.web_event_id === eventId) return new Response('duplicate', { status: 200 });
  if (Number.isFinite(occurredAtMs) && current?.web_event_timestamp) {
    const storedMs = new Date(current.web_event_timestamp).getTime();
    if (Number.isFinite(storedMs) && storedMs > occurredAtMs) {
      return new Response('stale', { status: 200 });
    }
  }

  const eventAudit = {
    web_event_timestamp: Number.isFinite(occurredAtMs) ? new Date(occurredAtMs).toISOString() : new Date().toISOString(),
    web_event_id: eventId,
  };

  // Cancelación programada (cancel al final del período): Paddle deja la sub
  // 'active' con scheduled_change = { action: 'cancel', effective_at }. La
  // guardamos para que la UI muestre "no se renovará"; NULL = renueva normal.
  const cancelScheduledAt: string | null =
    data.scheduled_change?.action === 'cancel' ? (data.scheduled_change.effective_at ?? null) : null;

  if (['subscription.created', 'subscription.activated', 'subscription.updated', 'subscription.resumed'].includes(type)) {
    const status: string = data.status ?? '';
    // 'active' y 'trialing' otorgan premium; otros estados (paused, past_due) no extienden.
    if (['active', 'trialing'].includes(status) && periodEnd) {
      let queuedReferralDays = Math.max(0, Number(current?.referral_days_balance ?? 0));
      if (current?.source === 'referral' && current.premium_until) {
        const remainingMs = new Date(current.premium_until).getTime() - Date.now();
        if (remainingMs > 0) queuedReferralDays += Math.ceil(remainingMs / DAY_MS);
      }
      const { error } = await supabase.from('user_subscriptions').upsert({
        user_id: userId,
        plan: 'premium',
        source: 'web',
        premium_until: periodEnd,
        referral_days_balance: queuedReferralDays,
        paddle_subscription_id: data.id ?? null,
        cancel_scheduled_at: cancelScheduledAt,
        ...eventAudit,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) {
        console.error('[paddle-webhook] upsert failed:', error.message);
        return new Response('db error', { status: 500 });
      }
      console.log(`[paddle-webhook] ${type}: premium hasta ${periodEnd} para ${userId}`);
    }
  } else if (type === 'subscription.canceled') {
    if (current?.source !== 'web') return new Response('ignored', { status: 200 });

    const endMs = periodEnd ? new Date(periodEnd).getTime() : NaN;
    const hasEnded = !Number.isFinite(endMs) || endMs <= Date.now() + 60_000;
    const queuedDays = Math.max(0, Number(current.referral_days_balance ?? 0));
    const update = hasEnded
      ? queuedDays > 0
        ? {
            plan: 'premium', source: 'referral',
            premium_until: new Date(Date.now() + queuedDays * DAY_MS).toISOString(),
            referral_days_balance: 0, cancel_scheduled_at: null,
          }
        : {
            plan: 'free', source: null, premium_until: null,
            referral_days_balance: 0, cancel_scheduled_at: null,
          }
      : { premium_until: periodEnd, cancel_scheduled_at: periodEnd };

    const { error } = await supabase
      .from('user_subscriptions')
      .update({ ...update, ...eventAudit, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('source', 'web');
    if (error) {
      console.error('[paddle-webhook] cancel update failed:', error.message);
      return new Response('db error', { status: 500 });
    }
    console.log(`[paddle-webhook] canceled para ${userId}, acceso hasta ${periodEnd ?? 'fin ya registrado'}`);
  }

  return new Response('ok', { status: 200 });
});
