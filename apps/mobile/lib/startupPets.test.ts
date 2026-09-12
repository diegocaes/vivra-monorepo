import { createClient } from '@supabase/supabase-js';
import type { Database } from '@vivra/shared/lib/database';
import { describe, expect, it, vi } from 'vitest';
import { lookupStartupPets } from './startupPets';

function setup(responses: Record<string, Array<{ status: number; body: unknown }>>) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const table = new URL(String(input)).pathname.split('/').pop()!;
    const response = responses[table]?.shift();
    if (!response) throw new Error(`Unexpected request to ${table}`);
    return new Response(JSON.stringify(response.body), {
      status: response.status, headers: { 'Content-Type': 'application/json' },
    });
  });
  const client = createClient<Database>('https://example.supabase.co', 'test-key', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, fetch };
}

const empty = { status: 200, body: [] };
const pet = { status: 200, body: [{ id: 'pet' }] };
const timeout = { status: 504, body: { message: 'Gateway Timeout' } };

describe('startup pet lookup', () => {
  it('recovers from a transient shared-pet failure', async () => {
    const { client, fetch } = setup({ pets: [empty, empty], pet_shares: [timeout, pet] });
    await expect(lookupStartupPets(client, 'user', new AbortController().signal)).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('does not block an existing pet because the other query failed', async () => {
    const { client, fetch } = setup({ pets: [pet], pet_shares: [timeout] });
    await expect(lookupStartupPets(client, 'user', new AbortController().signal)).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('only returns empty when both queries succeeded', async () => {
    const { client } = setup({ pets: [empty], pet_shares: [empty] });
    await expect(lookupStartupPets(client, 'user', new AbortController().signal)).resolves.toBe(false);
  });

  it('limits retries and preserves the backend error instead of onboarding', async () => {
    const { client, fetch } = setup({ pets: [empty, empty], pet_shares: [timeout, timeout] });
    await expect(lookupStartupPets(client, 'user', new AbortController().signal)).rejects.toThrow('Gateway Timeout');
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('does not retry permission failures', async () => {
    const { client, fetch } = setup({ pets: [empty], pet_shares: [{ status: 403, body: { message: 'Forbidden' } }] });
    await expect(lookupStartupPets(client, 'user', new AbortController().signal)).rejects.toThrow('Forbidden');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not start requests for a cancelled attempt', async () => {
    const { client, fetch } = setup({});
    const controller = new AbortController();
    controller.abort();
    await expect(lookupStartupPets(client, 'user', controller.signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
