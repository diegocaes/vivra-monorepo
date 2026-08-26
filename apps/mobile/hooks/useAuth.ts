import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { clearRevenueCatUser } from './useSubscription';

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === 'SIGNED_OUT') {
        clearPerUserDeviceState();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Defensive: also clear immediately, in case the auth listener fires
    // later or the SIGNED_OUT event is missed.
    clearPerUserDeviceState();
  };

  return { session, user, loading, signOut };
}
