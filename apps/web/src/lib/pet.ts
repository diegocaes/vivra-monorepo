import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Pet } from '@vivra/shared/lib/database';
import { isPetRow } from '@vivra/shared/lib/database';

export interface PetContext {
  pet: Pet | null;
  pets: Pet[];
  isOwner: boolean;
}

/**
 * Fetches all pets for a user (owned + shared) and returns the active one.
 * The active pet is determined by activePetId (from cookie), falling back to the first pet.
 */
export async function getActivePet(
  supabase: SupabaseClient<Database>,
  userId: string,
  activePetId: string | null,
): Promise<PetContext> {
  const [ownedRes, sharedRes] = await Promise.all([
    supabase
      .from('pets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('pet_shares')
      .select('pet_id, pets(*)')
      .eq('shared_with', userId),
  ]);

  const ownedPets = ownedRes.data ?? [];
  const sharedPets = (sharedRes.data ?? [])
    .flatMap(share => Array.isArray(share.pets) ? share.pets : [share.pets])
    .filter(isPetRow);

  const pets = [...ownedPets, ...sharedPets];

  if (!pets.length) return { pet: null, pets: [], isOwner: true };

  const pet = (activePetId ? pets.find((p) => p.id === activePetId) : null) ?? pets[0];
  const isOwner = pet ? pet.user_id === userId : true;

  return { pet: pet ?? null, pets, isOwner };
}
