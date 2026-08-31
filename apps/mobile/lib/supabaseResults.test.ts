import { describe, expect, it } from 'vitest';
import { firstSupabaseFailure } from './supabaseResults';

describe('Supabase query result validation', () => {
  it('returns null when every query succeeded', () => {
    expect(firstSupabaseFailure([
      { name: 'vacunas', error: null },
      { name: 'preventivos', error: null },
    ])).toBeNull();
  });

  it('returns the first resolved Supabase error instead of treating it as empty data', () => {
    const error = { message: 'Failed to fetch', code: 'NETWORK' };

    expect(firstSupabaseFailure([
      { name: 'vacunas', error: null },
      { name: 'preventivos', error },
      { name: 'peso', error: { message: 'another error' } },
    ])).toEqual({ name: 'preventivos', error });
  });
});
