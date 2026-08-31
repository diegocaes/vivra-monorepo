import { describe, expect, it, vi } from 'vitest';
import { runRequiredOperations } from './helpers';

describe('delete-account required operations', () => {
  it('returns no failures when every operation succeeds', async () => {
    const failures = await runRequiredOperations([
      { name: 'pets', run: async () => ({ error: null }) },
      { name: 'profiles', run: async () => ({ error: null }) },
    ]);

    expect(failures).toEqual([]);
  });

  it('detects Supabase errors that resolve inside the result', async () => {
    const error = { message: 'permission denied', code: '42501' };
    const failures = await runRequiredOperations([
      { name: 'pets', run: async () => ({ error }) },
    ]);

    expect(failures).toEqual([{ name: 'pets', error }]);
  });

  it('stops after a failure to limit partial deletion', async () => {
    const secondRun = vi.fn(async () => ({ error: null }));
    const failures = await runRequiredOperations([
      { name: 'pets', run: async () => { throw new Error('network failure'); } },
      { name: 'profiles', run: secondRun },
    ]);

    expect(failures[0]?.name).toBe('pets');
    expect(secondRun).not.toHaveBeenCalled();
  });
});
