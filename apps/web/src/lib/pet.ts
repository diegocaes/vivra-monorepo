import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pet } from '../types/supabase';

export interface PetContext {
  pet: Pet | null;
  pets: Pet[];
}

/**
 * Fetches all pets for a user and returns the active one.
 * The active pet is determined by activePetId (from cookie), falling back to the first pet.
 * Single DB query — no duplication across pages.
 */
export async function getActivePet(
  supabase: SupabaseClient,
  userId: string,
  activePetId: string | null,
): Promise<PetContext> {
  const { data: pets } = await supabase
    .from('pets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!pets?.length) return { pet: null, pets: [] };

  const pet = (activePetId ? pets.find((p) => p.id === activePetId) : null) ?? pets[0];
  return { pet: pet ?? null, pets };
}
