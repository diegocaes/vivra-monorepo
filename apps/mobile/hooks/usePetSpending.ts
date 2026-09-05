import { useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SPENDING_SOURCES, sumAmounts, type SpendingKey } from '@vivra/shared';
import type { Database } from '@vivra/shared/lib/database';
import { useRemoteData } from './useRemoteData';

export type SpendingTotals = Record<SpendingKey, number>;

export function usePetSpending(
  client: SupabaseClient<Database>, userId: string | null, petId: string | null, enabled: boolean,
) {
  const load = useCallback(async (signal: AbortSignal): Promise<SpendingTotals> => {
    if (!petId) throw new Error('A pet is required');
    const entries = await Promise.all(SPENDING_SOURCES.map(async source => {
      const { data, error } = await client.from(source.table).select(source.column)
        .eq('pet_id', petId).abortSignal(signal);
      if (error) throw error;
      return [source.key, sumAmounts(data, source.column)] as const;
    }));
    return Object.fromEntries(entries) as SpendingTotals;
  }, [client, petId]);

  return useRemoteData(enabled && userId && petId ? `${userId}:${petId}` : null, load);
}
