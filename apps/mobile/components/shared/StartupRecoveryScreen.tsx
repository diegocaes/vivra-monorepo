import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { Colors, FontSize, FontWeight, Spacing } from '../../constants/theme';

interface StartupRecoveryScreenProps {
  title: string;
  message: string;
  onRetry: () => void;
}

/** A recoverable startup failure must never look like an endless spinner. */
export function StartupRecoveryScreen({ title, message, onRetry }: StartupRecoveryScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="cloud-offline-outline" size={34} color={Colors.accent} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <Button title="Reintentar" onPress={onRetry} style={styles.button} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentLight,
    marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.ink },
  message: {
    maxWidth: 290,
    marginTop: Spacing.sm,
    color: Colors.muted,
    fontSize: FontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
  },
  button: { alignSelf: 'stretch', marginTop: Spacing.xl, maxWidth: 300 },
});
