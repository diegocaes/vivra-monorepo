import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@vivra/shared/lib/database';

/** Only route to onboarding when both queries confirm there are no pets. */
export async function lookupStartupPets(
  client: SupabaseClient<Database>,
  userId: string,
  signal: AbortSignal,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal.aborted) throw new Error('Pet lookup cancelled');
    const results = await Promise.all([
      client.from('pets').select('id').eq('user_id', userId).limit(1).abortSignal(signal),
      client.from('pet_shares').select('id').eq('shared_with', userId).limit(1).abortSignal(signal),
    ]);
    if (signal.aborted) throw new Error('Pet lookup cancelled');
    // One confirmed pet is enough, even if the other query failed.
    if (results.some(result => !result.error && (result.data?.length ?? 0) > 0)) return true;
    const failures = results.filter(result => result.error);
    if (failures.length === 0) return false;
    const transient = failures.every(result => result.status === 0 || result.status === 408 || result.status >= 500);
    if (attempt === 0 && transient) continue;
    const failure = failures[0];
    throw new Error(failure.error?.message || 'Pet lookup failed', { cause: failure.error });
  }
  throw new Error('Pet lookup failed');
}
