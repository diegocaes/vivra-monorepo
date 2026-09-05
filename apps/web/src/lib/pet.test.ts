import { createClient } from '@supabase/supabase-js';
import type { Database } from '@vivra/shared/lib/database';
import { describe, expect, it, vi } from 'vitest';
import { getActivePet } from './pet';

const owned = { id: 'owned', user_id: 'owner', name: 'Tinto' };
const shared = { id: 'shared', user_id: 'partner', name: 'Luna' };

function setup() {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    return Response.json(url.pathname.endsWith('/pet_shares')
      ? [{ pet_id: shared.id, pets: shared }]
      : [owned]);
  });
  const client = createClient<Database>('https://example.supabase.co', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });
  return { client, fetch };
}

describe('request pet lookup', () => {
  it('uses two HTTP requests for concurrent page/layout lookups and subsequent reads', async () => {
    const { client, fetch } = setup();
    const [page, layout] = await Promise.all([
      getActivePet(client, 'owner', 'shared'),
      getActivePet(client, 'owner', 'shared'),
    ]);
    expect(page).toEqual({ pet: shared, pets: [owned, shared], isOwner: false });
    expect(layout).toBe(page);
    expect(await getActivePet(client, 'owner', 'shared')).toBe(page);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not reuse a result for a different client, account, or pet selection', async () => {
    const first = setup();
    const second = setup();
    await getActivePet(first.client, 'owner', 'shared');
    expect((await getActivePet(first.client, 'owner', 'owned')).pet).toEqual(owned);
    expect((await getActivePet(first.client, 'partner', 'shared')).isOwner).toBe(true);
    await getActivePet(second.client, 'owner', 'shared');
    expect(first.fetch).toHaveBeenCalledTimes(6);
    expect(second.fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects failed lookups instead of treating them as no pets, and allows retry', async () => {
    const { client, fetch } = setup();
    fetch.mockResolvedValueOnce(Response.json({ message: 'permission denied', code: '42501' }, { status: 403 }));
    await expect(getActivePet(client, 'owner', null)).rejects.toMatchObject({ code: '42501' });
    expect((await getActivePet(client, 'owner', null)).pet).toEqual(owned);
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
