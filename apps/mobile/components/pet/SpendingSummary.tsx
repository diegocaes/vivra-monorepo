import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme';
import { Card } from '../ui/Card';
import { formatCurrency } from '@vivra/shared';
import { track } from '../../lib/analytics';
import { DataLoadNotice } from '../shared/DataLoadNotice';
import type { SpendingTotals } from '../../hooks/usePetSpending';

interface SpendingSummaryProps {
  totals: SpendingTotals | null;
  error: unknown | null;
  onRetry: () => Promise<void>;
  isPremium: boolean;
}

interface SpendingCategory {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  total: number;
}

export function SpendingSummary({ totals, error, onRetry, isPremium }: SpendingSummaryProps) {
  const router = useRouter();
  if (error) return <DataLoadNotice message="No pudimos cargar los gastos." onRetry={onRetry} />;
  if (!totals) return null;

  const categories: SpendingCategory[] = [
    { label: 'Alimento', icon: 'nutrition', iconColor: Colors.accent, total: totals.alimento },
    { label: 'Veterinario', icon: 'medical', iconColor: '#E879F9', total: totals.vet },
    { label: 'Grooming', icon: 'cut', iconColor: Colors.accentDark, total: totals.grooming },
    { label: 'Vuelos', icon: 'airplane', iconColor: '#3B82F6', total: totals.vuelos },
    { label: 'Snacks', icon: 'restaurant', iconColor: '#22C55E', total: totals.snacks },
    { label: 'Preventivos', icon: 'shield-checkmark', iconColor: Colors.warn, total: totals.preventivos },
  ];
  const grandTotal = Math.round(categories.reduce((sum, category) => sum + category.total, 0) * 100) / 100;

  // El TOTAL es visible para todos. El desglose por categoría es premium.
  return (
    <Card>
      <View style={styles.header}>
        <Ionicons name="wallet-outline" size={20} color={Colors.accent} />
        <Text style={styles.headerTitle}>Gastos totales</Text>
        <Text style={styles.grandTotal}>${formatCurrency(grandTotal)}</Text>
      </View>
      {grandTotal === 0 ? (
        <Text style={styles.noData}>Aún no hay gastos registrados</Text>
      ) : isPremium ? (
        <View style={styles.list}>
          {categories.filter(c => c.total > 0).map(c => (
            <View key={c.label} style={styles.row}>
              <Ionicons name={c.icon} size={16} color={c.iconColor} />
              <Text style={styles.catLabel}>{c.label}</Text>
              <Text style={styles.catTotal}>${formatCurrency(c.total)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => {
            // Saber QUÉ candado empuja al paywall vale más que el total de
            // aperturas: dice qué función vale la pena vender.
            track('click', 'upsell_desglose_gastos');
            router.push('/paywall' as any);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.lockedRow}>
            <View style={styles.lockedLeft}>
              <Ionicons name="lock-closed" size={16} color={Colors.muted} />
              <Text style={styles.lockedDesc}>Ver el desglose por categoría con Premium</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
          </View>
        </TouchableOpacity>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  headerTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  grandTotal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.accent },
  list: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  catLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.ink },
  catTotal: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  noData: { fontSize: FontSize.sm, color: Colors.muted, fontStyle: 'italic' },
  lockedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  lockedLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  lockedDesc: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 1 },
});
