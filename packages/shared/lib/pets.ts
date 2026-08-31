import type { Json } from './database.types';

export interface PetIdentity {
  id: string;
}

/**
 * Resolves the active pet from the pets the current user can actually access.
 * A stale selection (for example after access is revoked) safely falls back to
 * the first accessible pet instead of leaving the app without content.
 */
export function resolveActivePet<T extends PetIdentity>(
  accessiblePets: readonly T[],
  preferredPetId: string | null | undefined,
): T | null {
  if (preferredPetId) {
    const preferred = accessiblePets.find((pet) => pet.id === preferredPetId);
    if (preferred) return preferred;
  }

  return accessiblePets[0] ?? null;
}

export type AcceptedPetShareInvite = {
  ok: true;
  petId: string;
};

export type RejectedPetShareInvite = {
  ok: false;
  error: string;
};

export type PetShareInviteResult = AcceptedPetShareInvite | RejectedPetShareInvite;

/** Safely validates the JSON returned by accept_pet_share_invite. */
export function parsePetShareInviteResult(value: Json | null): PetShareInviteResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'invalid_response' };
  }

  if (value.ok === true && typeof value.pet_id === 'string' && value.pet_id.length > 0) {
    return { ok: true, petId: value.pet_id };
  }

  return {
    ok: false,
    error: typeof value.error === 'string' ? value.error : 'unknown',
  };
}
