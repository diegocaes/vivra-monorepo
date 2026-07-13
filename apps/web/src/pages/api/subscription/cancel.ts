import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase';

/**
 * Cancela la suscripción web (Paddle) del usuario autenticado.
 * La cancelación es al final del período pagado (next_billing_period):
 * el usuario conserva Premium hasta esa fecha y luego expira solo.
 *
 * Requiere PADDLE_API_KEY (server-side) en el entorno.
 */
export const POST: APIRoute = async ({ locals }) => {
  const { user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }

  const apiKey = import.meta.env.PADDLE_API_KEY || process.env.PADDLE_API_KEY;
  if (!apiKey) {
    console.error('[cancel] PADDLE_API_KEY no configurada');
    return new Response(JSON.stringify({ error: 'Cancelación no disponible, contacta soporte' }), { status: 500 });
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

  const res = await fetch(`${apiBase}/subscriptions/${sub.paddle_subscription_id}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ effective_from: 'next_billing_period' }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[cancel] Paddle API error:', res.status, body);
    // 400 con "subscription_update_when_canceled" = ya estaba cancelada; tratamos como éxito.
    if (body.includes('canceled')) {
      return new Response(JSON.stringify({ ok: true, already: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'No se pudo cancelar, intenta de nuevo o contacta soporte' }), { status: 502 });
  }

  // El webhook subscription.canceled ajustará premium_until al fin del período.
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
