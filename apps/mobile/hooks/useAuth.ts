import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { clearRevenueCatUser } from '../lib/revenueCatSession';
import { captureError } from '../lib/sentry';

const SESSION_BOOTSTRAP_TIMEOUT_MS = 8_000;

/**
 * Clear per-user device state on sign-out:
 *  - RevenueCat cached appUserID (entitlements must not leak between accounts)
 *  - ALL locally-scheduled notifications. They mention the previous user's
 *    pet by name ("Firulais: antipulgas próximo") — on a shared device the
 *    next account would keep receiving them. Privacy + confusion bug.
 * Imported expo-notifications directly (not via useNotifications) to avoid
 * a module cycle: useNotifications already imports useAuth.
 */
function clearPerUserDeviceState() {
  void clearRevenueCatUser();
  Notifications.cancelAllScheduledNotificationsAsync().catch((e) => {
    console.warn('[auth] failed to cancel scheduled notifications on signOut:', e?.message ?? e);
  });
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let settled = false;

    const finish = (nextSession: Session | null) => {
      if (!active || settled) return;
      settled = true;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setStartupError(false);
      setLoading(false);
    };

    setLoading(true);
    setStartupError(false);

    // AsyncStorage / auth initialization should be near-instant. If it hangs,
    // leaving the user on the native splash forever is worse than offering a
    // visible retry. The auth listener below can still settle normally first.
    const timeout = setTimeout(() => {
      if (!active || settled) return;
      settled = true;
      setStartupError(true);
      setLoading(false);
      captureError(new Error('Auth bootstrap timed out'), { phase: 'getSession' });
    }, SESSION_BOOTSTRAP_TIMEOUT_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        finish(session);
        return;
      }

      if (!active) return;
      settled = true;
      setSession(session);
      setUser(session?.user ?? null);
      setStartupError(false);
      setLoading(false);
      if (event === 'SIGNED_OUT') {
        clearPerUserDeviceState();
      }
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => finish(session))
      .catch((error) => {
        if (!active || settled) return;
        settled = true;
        setStartupError(true);
        setLoading(false);
        captureError(error, { phase: 'getSession' });
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [attempt]);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Defensive: also clear immediately, in case the auth listener fires
    // later or the SIGNED_OUT event is missed.
    clearPerUserDeviceState();
  };

  return {
    session,
    user,
    loading,
    startupError,
    retryStartup: () => setAttempt(current => current + 1),
    signOut,
  };
}
