import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { supabase } from '../lib/supabase';
import { LoadingScreen } from '../components/shared/LoadingScreen';
import { OfflineBanner } from '../components/shared/OfflineBanner';
import { AppErrorBoundary } from '../components/shared/AppErrorBoundary';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import { initSentry, setSentryUser } from '../lib/sentry';

SplashScreen.preventAutoHideAsync();

// Antes de renderizar nada, para capturar también los errores de arranque.
initSentry();

export default function RootLayout() {
  const { session, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  useNotifications();

  // Solo el id, nunca el email: permite distinguir "le pasa a todos" de
  // "le pasa a un usuario" sin guardar datos personales en Sentry.
  useEffect(() => {
    setSentryUser(user?.id ?? null);
  }, [user?.id]);

  // Check if user has pets to drive auth routing decision
  useEffect(() => {
    if (!user) {
      setHasPets(null);
      return;
    }

    let cancelled = false;

    // Check owned + shared pets
    Promise.all([
      supabase
        .from('pets')
        .select('id, name', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1),
      supabase
        .from('pet_shares')
        .select('id', { count: 'exact' })
        .eq('shared_with', user.id)
        .limit(1),
    ])
      .then(([ownedRes, sharedRes]) => {
        if (cancelled) return;
        // If either query errored, we can't trust the result — keep hasPets
        // as null so the loading screen stays visible rather than wrongly
        // routing the user to /onboarding and risking a duplicate pet.
        if (ownedRes.error || sharedRes.error) {
          console.warn(
            '[layout] pets fetch error:',
            ownedRes.error?.message || sharedRes.error?.message,
          );
          return;
        }
        const has = ((ownedRes.count ?? 0) + (sharedRes.count ?? 0)) > 0;
        setHasPets(has);
      })
      .then(undefined, (e) => {
        if (cancelled) return;
        console.warn('[layout] pets fetch threw:', e);
        // Leave hasPets as null on transient errors
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // `router` de expo-router es un singleton estable entre renders, así que no
  // agrega valor en las deps y solo generaría ruido.
  useEffect(() => {
    if (loading || (session && hasPets === null)) return;

    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // User just logged in — route based on pet ownership
      if (hasPets === false) {
        router.replace('/onboarding');
      } else {
        router.replace('/(app)');
      }
    }
  }, [session, loading, segments, hasPets]);

  if (loading || (session && hasPets === null)) {
    return <LoadingScreen />;
  }

  return (
    <AppErrorBoundary>
      {/* Va en el layout raíz (no en (app)) porque /paywall vive fuera del
          grupo (app) y usePet también consume el estado de suscripción. */}
      <SubscriptionProvider>
        <StatusBar style="dark" />
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="notificaciones" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="referidos" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="invite/[token]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </SubscriptionProvider>
    </AppErrorBoundary>
  );
}
