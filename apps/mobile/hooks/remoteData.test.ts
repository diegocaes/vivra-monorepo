// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@vivra/shared/lib/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDashboardStatus } from './useDashboardStatus';
import { usePetSpending } from './usePetSpending';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const roots: Root[] = [];
afterEach(async () => {
  await act(async () => { for (const root of roots.splice(0)) root.unmount(); });
});

async function mountHook<T>(useValue: () => T) {
  let value: T;
  function Harness() { value = useValue(); return null; }
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  const render = async () => { await act(async () => { root.render(createElement(Harness)); }); };
  await render();
  return { read: () => value, render };
}

function setup(handler: (url: URL) => Response | Promise<Response>) {
  // Deliberately ignore the AbortSignal: late responses must still be ignored
  // even if a transport has already received the response when cancelled.
  const fetch = vi.fn(async (input: RequestInfo | URL) => handler(new URL(String(input))));
  const client = createClient<Database>('https://example.supabase.co', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch },
  });
  return { client, fetch };
}

function statusResponse(url: URL, count = 3) {
  return url.pathname.endsWith('/notifications')
    ? new Response(null, { headers: { 'content-range': `0-${count - 1}/${count}` } })
    : Response.json([{ plan: 'premium', source: 'trial', premium_until: '2099-01-01' }]);
}

function spendingResponse(url: URL, amount = 10.25) {
  const column = url.searchParams.get('select')!;
  return Response.json([{ [column]: String(amount) }, { [column]: null }, { [column]: -5 }]);
}

describe('dashboard status requests', () => {
  it('loads once and coalesces simultaneous refreshes into one pair of requests', async () => {
    const { client, fetch } = setup(statusResponse);
    const useStatus = () => useDashboardStatus(client, 'owner');
    const view = await mountHook(useStatus);
    expect(view.read().data).toMatchObject({ unreadCount: 3, isTrial: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => { await Promise.all([view.read().refresh(), view.read().refresh()]); });
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(view.read().loading).toBe(false);
  });

  it('ignores a previous account response and clears data on sign-out', async () => {
    const delayed: (() => void)[] = [];
    const { client, fetch } = setup(url => url.searchParams.get('user_id') === 'eq.first'
      ? new Promise(resolve => { delayed.push(() => resolve(statusResponse(url, 99))); })
      : statusResponse(url, 2));
    let userId: string | null = 'first';
    const useStatus = () => useDashboardStatus(client, userId);
    const view = await mountHook(useStatus);
    userId = 'second';
    await view.render();
    expect(view.read().data?.unreadCount).toBe(2);
    await act(async () => { for (const resolve of delayed) resolve(); });
    expect(view.read().data?.unreadCount).toBe(2);
    userId = null;
    await view.render();
    expect(view.read().data).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it.each(['invalid-date', '2000-01-01'])('does not advertise an inactive trial (%s)', async premiumUntil => {
    const { client } = setup(url => url.pathname.endsWith('/notifications')
      ? statusResponse(url)
      : Response.json([{ plan: 'premium', source: 'trial', premium_until: premiumUntil }]));
    const useStatus = () => useDashboardStatus(client, 'owner');
    const view = await mountHook(useStatus);
    expect(view.read().data).toMatchObject({ isTrial: false, trialDaysLeft: null });
  });
});

describe('profile spending requests', () => {
  it('does no work while hidden and reloads all categories when returning to Profile', async () => {
    const { client, fetch } = setup(spendingResponse);
    let focused = false;
    const useSpending = () => usePetSpending(client, 'owner', 'pet', focused);
    const view = await mountHook(useSpending);
    expect(fetch).not.toHaveBeenCalled();
    focused = true;
    await view.render();
    expect(fetch).toHaveBeenCalledTimes(6);
    expect(Object.values(view.read().data!)).toEqual(Array(6).fill(10.25));
    focused = false;
    await view.render();
    expect(view.read().data).toBeNull();
    focused = true;
    await view.render();
    expect(fetch).toHaveBeenCalledTimes(12);
  });

  it('never shows a partial total as a complete bill, and supports retry', async () => {
    let fail = true;
    const { client, fetch } = setup(url => fail && url.pathname.endsWith('/foods')
      ? Response.json({ message: 'permission denied', code: '42501' }, { status: 403 })
      : spendingResponse(url));
    const useSpending = () => usePetSpending(client, 'owner', 'pet', true);
    const view = await mountHook(useSpending);
    expect(view.read().data).toBeNull();
    expect(view.read().error).toMatchObject({ code: '42501' });
    fail = false;
    await act(async () => { await view.read().refresh(); });
    expect(view.read().error).toBeNull();
    expect(view.read().data?.alimento).toBe(10.25);
    expect(fetch).toHaveBeenCalledTimes(12);
  });

  it('discards late results for a previously selected pet', async () => {
    const delayed: (() => void)[] = [];
    const { client } = setup(url => url.searchParams.get('pet_id') === 'eq.first'
      ? new Promise(resolve => { delayed.push(() => resolve(spendingResponse(url, 99))); })
      : spendingResponse(url, 2));
    let petId = 'first';
    const useSpending = () => usePetSpending(client, 'owner', petId, true);
    const view = await mountHook(useSpending);
    petId = 'second';
    await view.render();
    expect(view.read().data?.vet).toBe(2);
    await act(async () => { for (const resolve of delayed) resolve(); });
    expect(Object.values(view.read().data!)).toEqual(Array(6).fill(2));
  });
});
