import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { supabase } from '../lib/supabase';
import { LoadingScreen } from '../components/shared/LoadingScreen';
import { StartupRecoveryScreen } from '../components/shared/StartupRecoveryScreen';
import { OfflineBanner } from '../components/shared/OfflineBanner';
import { AppErrorBoundary } from '../components/shared/AppErrorBoundary';
import { AuthProvider } from '../contexts/AuthContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import { PetProvider } from '../contexts/PetContext';
import { captureError, initSentry, setSentryUser } from '../lib/sentry';

const PET_LOOKUP_TIMEOUT_MS = 8_000;

SplashScreen.preventAutoHideAsync();

// Antes de renderizar nada, para capturar también los errores de arranque.
initSentry();

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <RootLayoutContent />
      </AuthProvider>
    </AppErrorBoundary>
  );
}

function RootLayoutContent() {
  const { session, user, loading, startupError, retryStartup } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  const [petLookupError, setPetLookupError] = useState(false);
  const [petLookupAttempt, setPetLookupAttempt] = useState(0);
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
      setPetLookupError(false);
      return;
    }

    let cancelled = false;
    let settled = false;
    setHasPets(null);
    setPetLookupError(false);

    const failLookup = (error: unknown, context: string) => {
      if (cancelled || settled) return;
      settled = true;
      clearTimeout(timeout);
      setPetLookupError(true);
      captureError(error, { phase: 'startup_pet_lookup', context });
    };

    const timeout = setTimeout(() => {
      failLookup(new Error('Pet lookup timed out'), 'timeout');
    }, PET_LOOKUP_TIMEOUT_MS);

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
        if (cancelled || settled) return;
        // If either query errored, we can't trust the result — keep hasPets
        // as null and offer retry rather than routing the user to onboarding
        // and risking a duplicate pet.
        if (ownedRes.error || sharedRes.error) {
          console.warn(
            '[layout] pets fetch error:',
            ownedRes.error?.message || sharedRes.error?.message,
          );
          failLookup(ownedRes.error || sharedRes.error, 'query_error');
          return;
        }
        settled = true;
        clearTimeout(timeout);
        const has = ((ownedRes.count ?? 0) + (sharedRes.count ?? 0)) > 0;
        setHasPets(has);
      })
      .then(undefined, (e) => {
        console.warn('[layout] pets fetch threw:', e);
        failLookup(e, 'query_threw');
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [user?.id, petLookupAttempt]);

  // `router` de expo-router es un singleton estable entre renders, así que no
  // agrega valor en las deps y solo generaría ruido.
  useEffect(() => {
    if (loading || startupError || (session && hasPets === null && !petLookupError)) return;

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
  }, [session, loading, startupError, segments, hasPets, petLookupError]);

  if (loading || (session && hasPets === null && !petLookupError)) {
    return <LoadingScreen />;
  }

  if (startupError) {
    return (
      <StartupRecoveryScreen
        title="No pudimos iniciar Vivra"
        message="Revisa tu conexión e inténtalo de nuevo. Tus datos no se han modificado."
        onRetry={retryStartup}
      />
    );
  }

  if (session && petLookupError) {
    return (
      <StartupRecoveryScreen
        title="No pudimos cargar a tu mascota"
        message="Revisa tu conexión e inténtalo de nuevo. No te enviaremos al registro por este error."
        onRetry={() => setPetLookupAttempt(current => current + 1)}
      />
    );
  }

  return (
    /* Va en el layout raíz (no en (app)) porque /paywall vive fuera del
       grupo (app) y usePet también consume el estado de suscripción. */
    <SubscriptionProvider>
      <PetProvider>
        <StatusBar style="dark" />
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="grooming" />
          <Stack.Screen name="pasaporte" />
          <Stack.Screen name="notificaciones" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="referidos" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="invite/[token]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </PetProvider>
    </SubscriptionProvider>
  );
}
