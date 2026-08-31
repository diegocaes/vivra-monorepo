import { describe, expect, it } from 'vitest';
import { asJsonObject, isPetRow } from './database';

describe('Supabase JSON response narrowing', () => {
  it('accepts plain JSON objects', () => {
    expect(asJsonObject({ ok: true, code: 'TINTO1234' })).toEqual({
      ok: true,
      code: 'TINTO1234',
    });
  });

  it('rejects scalar and array responses', () => {
    expect(asJsonObject(null)).toBeNull();
    expect(asJsonObject('unexpected')).toBeNull();
    expect(asJsonObject([])).toBeNull();
  });
});

describe('Supabase pet relation narrowing', () => {
  it('accepts the required identity fields and rejects relation wrappers', () => {
    expect(isPetRow({ id: 'pet-1', user_id: 'user-1', name: 'Tinto' })).toBe(true);
    expect(isPetRow([{ id: 'pet-1', user_id: 'user-1', name: 'Tinto' }])).toBe(false);
    expect(isPetRow(null)).toBe(false);
  });
});
