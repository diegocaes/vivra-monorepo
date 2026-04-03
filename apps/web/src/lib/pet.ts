import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pet } from '../types/supabase';

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
  supabase: SupabaseClient,
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

  const ownedPets = (ownedRes.data ?? []) as Pet[];
  const sharedPets = (sharedRes.data ?? [])
    .map((s: any) => s.pets)
    .filter(Boolean) as Pet[];

  const pets = [...ownedPets, ...sharedPets];

  if (!pets.length) return { pet: null, pets: [], isOwner: true };

  const pet = (activePetId ? pets.find((p) => p.id === activePetId) : null) ?? pets[0];
  const isOwner = pet ? pet.user_id === userId : true;

  return { pet: pet ?? null, pets, isOwner };
}
