import { createClient } from '@supabase/supabase-js';
import type { Database } from '@vivra/shared/lib/database';
import { describe, expect, it, vi } from 'vitest';
import { loadFoodHistory } from './foodHistory';

function setup(treatStatuses: number[]) {
  const calls: string[] = [];
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const table = new URL(String(input)).pathname.split('/').pop()!;
    calls.push(table);
    const status = table === 'treats' ? treatStatuses.shift()! : 200;
    return new Response(JSON.stringify(status === 200 ? [{ id: table }] : { message: 'Backend failed' }), {
      status, headers: { 'Content-Type': 'application/json' },
    });
  });
  const client = createClient<Database>('https://example.supabase.co', 'test-key', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, calls };
}

describe('food history after backend failures', () => {
  it('recovers a 504 without repeating the successful food request', async () => {
    const { client, calls } = setup([504, 200]);
    const result = await loadFoodHistory(client, 'pet');
    expect(result).toEqual({ foods: [{ id: 'foods' }], treats: [{ id: 'treats' }] });
    expect(calls).toEqual(['foods', 'treats', 'treats']);
  });

  it('rejects persistent 504s instead of returning an empty or partial history', async () => {
    const { client, calls } = setup([504, 504]);
    await expect(loadFoodHistory(client, 'pet')).rejects.toThrow('Backend failed');
    expect(calls).toEqual(['foods', 'treats', 'treats']);
  });

  it('does not retry authorization errors', async () => {
    const { client, calls } = setup([403]);
    await expect(loadFoodHistory(client, 'pet')).rejects.toThrow('Backend failed');
    expect(calls).toEqual(['foods', 'treats']);
  });
});
