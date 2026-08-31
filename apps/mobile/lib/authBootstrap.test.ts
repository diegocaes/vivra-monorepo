import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAuthBootstrap, type AuthBootstrapClient } from './authBootstrap';

function fakeSession(userId: string): Session {
  return { user: { id: userId } } as Session;
}

function createClient(getSession: AuthBootstrapClient['getSession']) {
  let listener: ((event: AuthChangeEvent, session: Session | null) => void) | null = null;
  const unsubscribe = vi.fn();
  const client: AuthBootstrapClient = {
    getSession,
    onAuthStateChange: vi.fn((callback) => {
      listener = callback;
      return { data: { subscription: { unsubscribe } } };
    }),
  };

  return {
    client,
    unsubscribe,
    emit(event: AuthChangeEvent, session: Session | null) {
      if (!listener) throw new Error('Auth listener was not registered');
      listener(event, session);
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('auth bootstrap', () => {
  it('uses one listener and only resolves the initial session once', async () => {
    const session = fakeSession('user-1');
    const auth = createClient(async () => ({ data: { session } }));
    const onSession = vi.fn();

    const cleanup = startAuthBootstrap({
      client: auth.client,
      timeoutMs: 8_000,
      onSession,
      onEvent: vi.fn(),
      onTimeout: vi.fn(),
      onError: vi.fn(),
    });
    auth.emit('INITIAL_SESSION', session);
    await Promise.resolve();

    expect(auth.client.onAuthStateChange).toHaveBeenCalledOnce();
    expect(onSession).toHaveBeenCalledOnce();
    expect(onSession).toHaveBeenCalledWith(session);

    cleanup();
    expect(auth.unsubscribe).toHaveBeenCalledOnce();
  });

  it('continues forwarding sign-in and sign-out events after bootstrap', async () => {
    const initialSession = fakeSession('user-1');
    const nextSession = fakeSession('user-2');
    const auth = createClient(async () => ({ data: { session: initialSession } }));
    const onSession = vi.fn();
    const onEvent = vi.fn();

    const cleanup = startAuthBootstrap({
      client: auth.client,
      timeoutMs: 8_000,
      onSession,
      onEvent,
      onTimeout: vi.fn(),
      onError: vi.fn(),
    });
    await Promise.resolve();
    auth.emit('SIGNED_IN', nextSession);
    auth.emit('SIGNED_OUT', null);

    expect(onSession).toHaveBeenLastCalledWith(null);
    expect(onEvent).toHaveBeenNthCalledWith(1, 'SIGNED_IN', nextSession);
    expect(onEvent).toHaveBeenNthCalledWith(2, 'SIGNED_OUT', null);
    cleanup();
  });

  it('shows recovery after a timeout and ignores a late initial session', async () => {
    vi.useFakeTimers();
    let resolveSession!: (value: { data: { session: Session | null } }) => void;
    const auth = createClient(() => new Promise((resolve) => { resolveSession = resolve; }));
    const onSession = vi.fn();
    const onTimeout = vi.fn();

    const cleanup = startAuthBootstrap({
      client: auth.client,
      timeoutMs: 8_000,
      onSession,
      onEvent: vi.fn(),
      onTimeout,
      onError: vi.fn(),
    });
    vi.advanceTimersByTime(8_000);
    resolveSession({ data: { session: fakeSession('late-user') } });
    await Promise.resolve();

    expect(onTimeout).toHaveBeenCalledOnce();
    expect(onSession).not.toHaveBeenCalled();
    cleanup();
  });
});
