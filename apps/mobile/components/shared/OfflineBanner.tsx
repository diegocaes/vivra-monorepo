import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';

/**
 * Lightweight offline banner — no extra native deps needed.
 * Pings a known endpoint periodically to detect connectivity.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const insets = useSafeAreaInsets();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkConnection = async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsOffline(false);
    } catch {
      setIsOffline(true);
    }
  };

  useEffect(() => {
    checkConnection();
    timer.current = setInterval(checkConnection, 15000);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkConnection();
    });

    return () => {
      if (timer.current) clearInterval(timer.current);
      subscription.remove();
    };
  }, []);

  if (!isOffline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 4 }]}>
      <Text style={styles.text}>Sin conexión — los datos guardados siguen disponibles</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.ink,
    paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    zIndex: 999,
  },
  text: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign: 'center',
  },
});
