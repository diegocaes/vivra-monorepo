import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { supabase } from '../lib/supabase';
import { LoadingScreen } from '../components/shared/LoadingScreen';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  useNotifications();

  // Check if user has pets
  useEffect(() => {
    if (!user) {
      setHasPets(null);
      return;
    }

    supabase
      .from('pets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => {
        setHasPets((count ?? 0) > 0);
      })
      .then(undefined, () => {
        setHasPets(false);
      });
  }, [user]);

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
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="notificaciones" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}
