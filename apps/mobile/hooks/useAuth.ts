import { useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearRevenueCatUser } from './useSubscription';

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
      // When the user signs out, also clear the cached RevenueCat
      // configuration. Without this, switching accounts on the same device
      // would leave RC pointing at the old user's appUserID until the next
      // app restart, leaking entitlements between sessions.
      if (event === 'SIGNED_OUT') {
        clearRevenueCatUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Defensive: clear RC user immediately too, in case the auth listener
    // fires later or the SIGNED_OUT event is missed.
    clearRevenueCatUser();
  };

  return { session, user, loading, signOut };
}
