import { describe, expect, it } from 'vitest';
import { parsePetShareInviteResult, resolveActivePet } from './pets';

const ownedPet = { id: 'owned', name: 'Tinto' };
const sharedPet = { id: 'shared', name: 'Milo' };

describe('active pet selection', () => {
  it('keeps an accessible shared pet selected', () => {
    expect(resolveActivePet([ownedPet, sharedPet], sharedPet.id)).toBe(sharedPet);
  });

  it('works for a co-owner who only has a shared pet', () => {
    expect(resolveActivePet([sharedPet], sharedPet.id)).toBe(sharedPet);
  });

  it('falls back after the selected pet access is revoked', () => {
    expect(resolveActivePet([ownedPet], sharedPet.id)).toBe(ownedPet);
  });

  it('returns null when the user has no accessible pets', () => {
    expect(resolveActivePet([], 'revoked')).toBeNull();
  });
});

describe('pet share invite response', () => {
  it('accepts only a confirmed pet id', () => {
    expect(parsePetShareInviteResult({ ok: true, pet_id: 'pet-123' })).toEqual({
      ok: true,
      petId: 'pet-123',
    });
  });

  it('preserves a terminal error returned by Supabase', () => {
    expect(parsePetShareInviteResult({ ok: false, error: 'expired' })).toEqual({
      ok: false,
      error: 'expired',
    });
  });

  it('rejects malformed successful responses', () => {
    expect(parsePetShareInviteResult({ ok: true })).toEqual({
      ok: false,
      error: 'unknown',
    });
  });
});
