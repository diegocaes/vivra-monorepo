import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, FontWeight, Radius, Spacing } from '../../constants/theme';

interface DataLoadNoticeProps {
  message: string | null;
  onRetry: () => void | Promise<void>;
}

/** Friendly, non-alarming notice shown only when existing data could not refresh. */
export function DataLoadNotice({ message, onRetry }: DataLoadNoticeProps) {
  if (!message) return null;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Reintentar cargar los datos"
      activeOpacity={0.75}
      onPress={() => { void onRetry(); }}
      style={styles.container}
    >
      <Ionicons name="cloud-offline-outline" size={20} color={Colors.accent} />
      <View style={styles.copy}>
        <Text style={styles.title}>No pudimos actualizar los datos</Text>
        <Text style={styles.message}>{message} Toca para reintentar.</Text>
      </View>
      <Ionicons name="refresh" size={18} color={Colors.accent} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: `${Colors.accent}35`,
    backgroundColor: Colors.accentLight,
  },
  copy: { flex: 1 },
  title: {
    color: Colors.ink,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  message: {
    color: Colors.muted,
    fontSize: FontSize.xs,
    lineHeight: 17,
    marginTop: 2,
  },
});
