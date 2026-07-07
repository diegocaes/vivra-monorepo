import type { APIRoute } from 'astro';
import { createSupabaseClient, createSupabaseAdminClient } from '../../lib/supabase';

/**
 * POST /api/track — recibe eventos de producto (page views, clicks, CRUDs)
 * y los guarda en app_events. Público: la landing también trackea (user null).
 * El insert usa el admin client; el user_id se resuelve del session cookie,
 * nunca del payload, para que nadie pueda escribir eventos a nombre de otro.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { event?: string; name?: string; props?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const event = String(body.event ?? '').slice(0, 40);
  const name = String(body.name ?? '').slice(0, 120);
  if (!event || !name) return new Response(null, { status: 400 });

  let userId: string | null = null;
  try {
    const supabase = createSupabaseClient(request, cookies);
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* landing / logged out */ }

  try {
    const admin = createSupabaseAdminClient();
    await admin.from('app_events').insert({
      user_id: userId,
      event,
      name,
      platform: 'web',
      props: body.props ?? null,
    });
  } catch { /* tracking nunca debe romper la app */ }

  return new Response(null, { status: 204 });
};
