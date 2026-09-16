import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@vivra/shared/lib/database';
import { retryRead } from './retryRead';

export async function loadFoodHistory(client: SupabaseClient<Database>, petId: string) {
  const [foods, treats] = await Promise.all([
    retryRead(() => client.from('foods').select('*').eq('pet_id', petId).order('created_at', { ascending: false })),
    retryRead(() => client.from('treats').select('*').eq('pet_id', petId).order('created_at', { ascending: false })),
  ]);
  const error = foods.error ?? treats.error;
  if (error) throw new Error(error.message, { cause: error });
  return { foods: foods.data ?? [], treats: treats.data ?? [] };
}
