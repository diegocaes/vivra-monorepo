import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Pet } from '@vivra/shared/lib/database';
import { isPetRow } from '@vivra/shared/lib/database';
import { resolveActivePet } from '@vivra/shared';

export interface PetContext {
  pet: Pet | null;
  pets: Pet[];
  isOwner: boolean;
}

// Middleware creates a client per request. Reuse its in-flight result between
// the page and layout; never share authenticated data across clients/requests.
const petContexts = new WeakMap<SupabaseClient<Database>, {
  userId: string;
  activePetId: string | null;
  result: Promise<PetContext>;
}>();

/**
 * Fetches all pets for a user (owned + shared) and returns the active one.
 * The active pet is determined by activePetId (from cookie), falling back to the first pet.
 */
export function getActivePet(
  supabase: SupabaseClient<Database>,
  userId: string,
  activePetId: string | null,
): Promise<PetContext> {
  const cached = petContexts.get(supabase);
  if (cached?.userId === userId && cached.activePetId === activePetId) return cached.result;

  const result = fetchActivePet(supabase, userId, activePetId).catch(error => {
    if (petContexts.get(supabase)?.result === result) petContexts.delete(supabase);
    throw error;
  });
  petContexts.set(supabase, { userId, activePetId, result });
  return result;
}

async function fetchActivePet(
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

  // A failed lookup is not an empty account; don't redirect it to onboarding.
  if (ownedRes.error) throw ownedRes.error;
  if (sharedRes.error) throw sharedRes.error;

  const ownedPets = ownedRes.data ?? [];
  const sharedPets = (sharedRes.data ?? [])
    .flatMap(share => Array.isArray(share.pets) ? share.pets : [share.pets])
    .filter(isPetRow);

  const pets = [...ownedPets, ...sharedPets];

  if (!pets.length) return { pet: null, pets: [], isOwner: true };

  const pet = resolveActivePet(pets, activePetId);
  const isOwner = pet ? pet.user_id === userId : true;

  return { pet, pets, isOwner };
}
