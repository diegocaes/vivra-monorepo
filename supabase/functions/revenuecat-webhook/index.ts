// RevenueCat → user_subscriptions.
//
// Deploy with --no-verify-jwt: RevenueCat authenticates each request with a
// signed payload, not a Supabase JWT. Set REVENUECAT_WEBHOOK_SIGNING_SECRET
// from the RevenueCat webhook integration before deploying.

import { createClient } from 'npm:@supabase/supabase-js@2';

const encoder = new TextEncoder();
const PREMIUM_ENTITLEMENT_ID = 'premium';
const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

/** Verify RevenueCat's HMAC over `${timestamp}.${rawBody}` before parsing. */
async function verifySignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const fields = Object.fromEntries(
    header.split(',').map((part) => part.trim().split('=') as [string, string]),
  );
  const timestamp = Number(fields.t);
  const signature = fields.v1;
  if (!Number.isFinite(timestamp) || !signature) return false;
  if (Math.abs(Date.now() - timestamp * 1000) > MAX_SIGNATURE_AGE_MS) return false;

  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  const expected = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return constantTimeEquals(expected, signature);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function hasPremiumEntitlement(event: Record<string, unknown>): boolean {
  if (event.entitlement_id === PREMIUM_ENTITLEMENT_ID) return true;
  return Array.isArray(event.entitlement_ids) && event.entitlement_ids.includes(PREMIUM_ENTITLEMENT_ID);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SIGNING_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !supabaseUrl || !serviceRoleKey) return new Response('Not configured', { status: 500 });

  const rawBody = await req.text();
  const valid = await verifySignature(rawBody, req.headers.get('X-RevenueCat-Webhook-Signature'), secret);
  if (!valid) return new Response('Invalid signature', { status: 401 });

  let payload: { event?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const event = payload.event;
  const userId = event?.app_user_id;
  if (!event || !isUuid(userId)) {
    // Anonymous/test users do not map to a Vivra account, but the webhook was
    // valid so acknowledge it and avoid unnecessary RevenueCat retries.
    return new Response('ignored', { status: 200 });
  }

  if (!hasPremiumEntitlement(event)) return new Response('ignored', { status: 200 });

  const type = typeof event.type === 'string' ? event.type : '';
  const eventTimestamp = Number(event.event_timestamp_ms);
  const expiration = Number(event.expiration_at_ms);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Duplicate or out-of-order deliveries must not overwrite newer billing
  // state. The database migration adds iap_event_timestamp for this purpose.
  const { data: current, error: currentError } = await supabase
    .from('user_subscriptions')
    .select('source, premium_until, referral_days_balance, iap_event_timestamp')
    .eq('user_id', userId)
    .maybeSingle();
  if (currentError) return new Response('db error', { status: 500 });
  if (Number.isFinite(eventTimestamp) && (current?.iap_event_timestamp ?? 0) > eventTimestamp) {
    return new Response('stale', { status: 200 });
  }

  if (type === 'EXPIRATION') {
    if (current?.source !== 'iap') return new Response('ignored', { status: 200 });

    const queuedDays = Math.max(0, Number(current.referral_days_balance ?? 0));
    if (queuedDays > 0) {
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          plan: 'premium',
          source: 'referral',
          premium_until: new Date(Date.now() + queuedDays * DAY_MS).toISOString(),
          referral_days_balance: 0,
          iap_event_timestamp: Number.isFinite(eventTimestamp) ? eventTimestamp : Date.now(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('source', 'iap');
      return error ? new Response('db error', { status: 500 }) : new Response('ok', { status: 200 });
    }

    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        plan: 'free',
        source: null,
        premium_until: null,
        iap_event_timestamp: Number.isFinite(eventTimestamp) ? eventTimestamp : Date.now(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('source', 'iap');
    return error ? new Response('db error', { status: 500 }) : new Response('ok', { status: 200 });
  }

  // A cancellation retains access through the already-paid period. The
  // expiration event above is the only lifecycle event that removes access.
  if (!['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'NON_RENEWING_PURCHASE', 'UNCANCELLATION', 'SUBSCRIPTION_EXTENDED', 'CANCELLATION'].includes(type)) {
    return new Response('ignored', { status: 200 });
  }
  if (!Number.isFinite(expiration) || expiration <= Date.now()) return new Response('ignored', { status: 200 });

  let queuedReferralDays = Math.max(0, Number(current?.referral_days_balance ?? 0));
  if (current?.source === 'referral' && current.premium_until) {
    const remainingMs = new Date(current.premium_until).getTime() - Date.now();
    if (remainingMs > 0) queuedReferralDays += Math.ceil(remainingMs / DAY_MS);
  }

  const { error } = await supabase.from('user_subscriptions').upsert({
    user_id: userId,
    plan: 'premium',
    source: 'iap',
    premium_until: new Date(expiration).toISOString(),
    referral_days_balance: queuedReferralDays,
    iap_product_id: typeof event.product_id === 'string' ? event.product_id : null,
    iap_event_timestamp: Number.isFinite(eventTimestamp) ? eventTimestamp : Date.now(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return error ? new Response('db error', { status: 500 }) : new Response('ok', { status: 200 });
});
