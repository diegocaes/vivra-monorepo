import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabase';

/**
 * Reanuda una suscripción web (Paddle) con cancelación programada:
 * elimina el scheduled_change para que vuelva a renovarse normalmente.
 */
export const POST: APIRoute = async ({ locals }) => {
  const { user } = locals;
  if (!user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401 });
  }

  const apiKey = import.meta.env.PADDLE_API_KEY || process.env.PADDLE_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No disponible, contacta soporte' }), { status: 500 });
  }

  const admin = createSupabaseAdminClient();
  const { data: sub } = await admin
    .from('user_subscriptions')
    .select('source, paddle_subscription_id, cancel_scheduled_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sub || sub.source !== 'web' || !sub.paddle_subscription_id || !sub.cancel_scheduled_at) {
    return new Response(JSON.stringify({ error: 'No tienes una cancelación programada' }), { status: 400 });
  }

  const paddleEnv = import.meta.env.PUBLIC_PADDLE_ENV ?? 'sandbox';
  const apiBase = paddleEnv === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';

  const res = await fetch(`${apiBase}/subscriptions/${sub.paddle_subscription_id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scheduled_change: null }),
  });

  if (!res.ok) {
    console.error('[resume] Paddle API error:', res.status, await res.text());
    return new Response(JSON.stringify({ error: 'No se pudo reanudar, intenta de nuevo' }), { status: 502 });
  }

  // El webhook subscription.updated limpiará cancel_scheduled_at; lo hacemos
  // también aquí para que la UI refleje el cambio al instante.
  await admin
    .from('user_subscriptions')
    .update({ cancel_scheduled_at: null, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('source', 'web');

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
