import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase';

/**
 * Cancela la suscripción web (Paddle) del usuario autenticado.
 * La cancelación es al final del período pagado (next_billing_period):
 * el usuario conserva Premium hasta esa fecha y luego expira solo.
 *
 * Requiere PADDLE_API_KEY (server-side) en el entorno.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  const { user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }

  // Motivo del exit offer (opcional) — se registra en app_events para /admin.
  let reason: string | null = null;
  let comment: string | null = null;
  try {
    const body = await request.json();
    reason = typeof body?.reason === 'string' ? body.reason.slice(0, 50) : null;
    comment = typeof body?.comment === 'string' && body.comment ? body.comment.slice(0, 500) : null;
  } catch { /* sin body JSON — cancelación sin motivo */ }

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

  // Registrar el motivo (best-effort) para verlo en /admin.
  try {
    await admin.from('app_events').insert({
      user_id: user.id,
      event: 'subscription_cancel',
      name: reason ?? 'sin_motivo',
      platform: 'web',
      props: comment ? { comment } : null,
    });
  } catch { /* analytics nunca bloquea la cancelación */ }

  // El webhook subscription.canceled ajustará premium_until al fin del período.
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
