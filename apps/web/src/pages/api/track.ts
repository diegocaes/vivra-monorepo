import type { APIRoute } from 'astro';
import { createSupabaseClient, createSupabaseAdminClient } from '../../lib/supabase';

/**
 * POST /api/track — recibe eventos de producto (page views, clicks, CRUDs)
 * y los guarda en app_events. Público: la landing también trackea (user null).
 * El insert usa el admin client; el user_id se resuelve del session cookie,
 * nunca del payload, para que nadie pueda escribir eventos a nombre de otro.
 *
 * Al ser público + service role, es la única superficie donde un anónimo
 * escribe en la DB. Por eso todo está acotado: whitelist de tipos de evento,
 * tope de tamaño del body y de `props`, y rate limit por IP.
 */

/** Tipos de evento aceptados. Cualquier otro se descarta con 400. */
const ALLOWED_EVENTS = new Set(['page_view', 'click', 'screen_view', 'crud']);

/** Topes de tamaño — `props` es el campo libre, así que es el que más importa. */
const MAX_BODY_BYTES = 4 * 1024; // 4 KB de payload es de sobra para un evento
const MAX_PROPS_BYTES = 1024;    // props ya serializado
const MAX_PROPS_KEYS = 15;

/**
 * Rate limit en memoria por IP (ventana deslizante de 1 min).
 * En serverless el Map vive por instancia, así que no es un límite global
 * estricto — pero corta el abuso sostenido desde una sola fuente sin agregar
 * infra. Si algún día hace falta algo duro, mover a Redis/Upstash.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    // Limpieza oportunista para que el Map no crezca sin límite.
    if (hits.size > 5000) {
      for (const [key, val] of hits) if (now > val.resetAt) hits.delete(key);
    }
    return false;
  }

  entry.count++;
  return entry.count > MAX_PER_WINDOW;
}

/** Deja props en algo seguro de guardar: objeto plano, acotado en claves y tamaño. */
function sanitizeProps(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const out: Record<string, unknown> = {};
  let keys = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (keys >= MAX_PROPS_KEYS) break;
    // Solo primitivos: nada de objetos anidados que inflen la fila.
    if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
      out[k.slice(0, 40)] = typeof v === 'string' ? v.slice(0, 200) : v;
      keys++;
    }
  }

  if (Object.keys(out).length === 0) return null;
  return JSON.stringify(out).length > MAX_PROPS_BYTES ? null : out;
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || clientAddress
    || 'unknown';
  if (rateLimited(ip)) return new Response(null, { status: 429 });

  // Rechazar payloads grandes antes de leerlos en memoria.
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let body: { event?: unknown; name?: unknown; props?: unknown };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(null, { status: 400 });
  }

  const event = String(body.event ?? '').slice(0, 40);
  const name = String(body.name ?? '').slice(0, 120);
  if (!event || !name || !ALLOWED_EVENTS.has(event)) return new Response(null, { status: 400 });

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
      props: sanitizeProps(body.props),
    });
  } catch { /* tracking nunca debe romper la app */ }

  return new Response(null, { status: 204 });
};
