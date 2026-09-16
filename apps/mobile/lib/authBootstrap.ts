import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export interface AuthBootstrapClient {
  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) => { data: { subscription: { unsubscribe: () => void } } };
  getSession: () => Promise<{ data: { session: Session | null }; error?: unknown }>;
}

interface AuthBootstrapOptions {
  client: AuthBootstrapClient;
  timeoutMs: number;
  onSession: (session: Session | null) => void;
  onEvent: (event: AuthChangeEvent, session: Session | null) => void;
  onTimeout: () => void;
  onError: (error: unknown) => void;
}

/**
 * Coordinates Supabase's INITIAL_SESSION event and getSession fallback.
 * A non-null initial event can restore the session immediately. A null event
 * must wait for getSession: Supabase also emits null when refreshing fails.
 * Later auth events continue to update the app normally.
 */
export function startAuthBootstrap({
  client,
  timeoutMs,
  onSession,
  onEvent,
  onTimeout,
  onError,
}: AuthBootstrapOptions): () => void {
  let active = true;
  let settled = false;

  const finish = (session: Session | null) => {
    if (!active || settled) return;
    settled = true;
    clearTimeout(timeout);
    onSession(session);
  };

  const timeout = setTimeout(() => {
    if (!active || settled) return;
    // The timeout reveals recovery UI; a late session can still recover.
    onTimeout();
  }, timeoutMs);

  const {
    data: { subscription },
  } = client.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION') {
      if (session) finish(session);
      return;
    }

    if (!active) return;
    settled = true;
    clearTimeout(timeout);
    onSession(session);
    onEvent(event, session);
  });

  client.getSession()
    .then(({ data: { session }, error }) => {
      if (error) throw error;
      finish(session);
    })
    .catch((error) => {
      if (!active || settled) return;
      clearTimeout(timeout);
      onError(error);
    });

  return () => {
    active = false;
    clearTimeout(timeout);
    subscription.unsubscribe();
  };
}
