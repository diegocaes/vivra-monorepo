import { supabase } from './supabase';
import type { Json } from '@vivra/shared/lib/database';

/**
 * Eventos de producto → app_events (se leen en vivrapet.com/admin).
 * Fire-and-forget: el tracking jamás bloquea ni rompe la UI.
 * RLS: authenticated solo puede insertar filas con su propio user_id.
 */
export function track(event: 'screen_view' | 'click' | 'crud', name: string, props?: Record<string, Json | undefined>) {
  (async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('app_events').insert({
        user_id: user.id,
        event,
        name: name.slice(0, 120),
        platform: 'ios',
        props: props ?? null,
      });
    } catch { /* nunca romper la app por tracking */ }
  })();
}
