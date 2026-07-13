import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase';

/**
 * Exit offer: cambia la suscripción web (Paddle) del plan mensual al anual.
 * Paddle prorratea el cobro de inmediato y el webhook subscription.updated
 * actualiza premium_until al nuevo período anual.
 */
export const POST: APIRoute = async ({ locals }) => {
  const { user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }

  const apiKey = import.meta.env.PADDLE_API_KEY || process.env.PADDLE_API_KEY;
  const yearlyPrice = import.meta.env.PUBLIC_PADDLE_PRICE_YEARLY;
  if (!apiKey || !yearlyPrice) {
    return new Response(JSON.stringify({ error: 'No disponible, contacta soporte' }), { status: 500 });
  }

  const admin = createSupabaseAdminClient();
  const { data: sub } = await admin
    .from('user_subscriptions')
    .select('source, paddle_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sub || sub.source !== 'web' || !sub.paddle_subscription_id) {
    return new Response(JSON.stringify({ error: 'No tienes una suscripción web activa' }), { status: 400 });
  }

  const paddleEnv = import.meta.env.PUBLIC_PADDLE_ENV ?? 'sandbox';
  const apiBase = paddleEnv === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';

  const res = await fetch(`${apiBase}/subscriptions/${sub.paddle_subscription_id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [{ price_id: yearlyPrice, quantity: 1 }],
      proration_billing_mode: 'prorated_immediately',
    }),
  });

  if (!res.ok) {
    console.error('[switch-yearly] Paddle API error:', res.status, await res.text());
    return new Response(JSON.stringify({ error: 'No se pudo cambiar el plan, intenta de nuevo' }), { status: 502 });
  }

  // Retención ganada — registrar para /admin.
  try {
    await admin.from('app_events').insert({
      user_id: user.id,
      event: 'subscription_switch_yearly',
      name: 'exit_offer',
      platform: 'web',
      props: null,
    });
  } catch { /* best-effort */ }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
