import { useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@vivra/shared/lib/database';
import { useRemoteData } from './useRemoteData';

export function useDashboardStatus(client: SupabaseClient<Database>, userId: string | null) {
  const load = useCallback(async (signal: AbortSignal) => {
    if (!userId) throw new Error('A user is required');
    const [notifications, subscription] = await Promise.all([
      client.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('read', false).eq('dismissed', false).abortSignal(signal),
      client.from('user_subscriptions').select('plan, source, premium_until')
        .eq('user_id', userId).abortSignal(signal).maybeSingle(),
    ]);
    if (notifications.error) throw notifications.error;
    if (subscription.error) throw subscription.error;
    const expiresAt = new Date(subscription.data?.premium_until ?? '').getTime();
    const now = Date.now();
    const isTrial = subscription.data?.plan === 'premium'
      && subscription.data.source === 'trial' && expiresAt > now;
    return {
      unreadCount: notifications.count ?? 0,
      isTrial,
      trialDaysLeft: isTrial ? Math.ceil((expiresAt - now) / 86400000) : null,
    };
  }, [client, userId]);

  return useRemoteData(userId, load);
}
