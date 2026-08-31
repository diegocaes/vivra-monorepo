import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { clearRevenueCatUser } from '../lib/revenueCatSession';
import { startAuthBootstrap } from '../lib/authBootstrap';
import { captureError } from '../lib/sentry';

const SESSION_BOOTSTRAP_TIMEOUT_MS = 8_000;

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  startupError: boolean;
  retryStartup: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Clear state tied to the previous account on this physical device.
 * This must happen once per sign-out, not once per screen consuming useAuth.
 */
function clearPerUserDeviceState() {
  void clearRevenueCatUser();
  Notifications.cancelAllScheduledNotificationsAsync().catch((error) => {
    console.warn(
      '[auth] failed to cancel scheduled notifications on signOut:',
      error?.message ?? error,
    );
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const deviceStateCleared = useRef(false);

  const clearDeviceStateOnce = useCallback(() => {
    if (deviceStateCleared.current) return;
    deviceStateCleared.current = true;
    clearPerUserDeviceState();
  }, []);

  useEffect(() => {
    setLoading(true);
    setStartupError(false);

    return startAuthBootstrap({
      client: supabase.auth,
      timeoutMs: SESSION_BOOTSTRAP_TIMEOUT_MS,
      onSession(nextSession) {
        if (nextSession) deviceStateCleared.current = false;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setStartupError(false);
        setLoading(false);
      },
      onEvent(event) {
        if (event === 'SIGNED_OUT') clearDeviceStateOnce();
      },
      onTimeout() {
        setStartupError(true);
        setLoading(false);
        captureError(new Error('Auth bootstrap timed out'), { phase: 'getSession' });
      },
      onError(error) {
        setStartupError(true);
        setLoading(false);
        captureError(error, { phase: 'getSession' });
      },
    });
  }, [attempt, clearDeviceStateOnce]);

  const retryStartup = useCallback(() => {
    setAttempt(current => current + 1);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      // Defensive: also clear immediately if the SIGNED_OUT event is delayed
      // or missed. The ref keeps this idempotent when the event did fire.
      clearDeviceStateOnce();
    }
  }, [clearDeviceStateOnce]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    loading,
    startupError,
    retryStartup,
    signOut,
  }), [session, user, loading, startupError, retryStartup, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
