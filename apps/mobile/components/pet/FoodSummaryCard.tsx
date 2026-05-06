import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme';
import { computeFoodStats, formatCurrency, FOOD_TYPES, type FoodLike } from '@vivra/shared';

interface FoodSummaryCardProps {
  foods: FoodLike[];
}

/** Home dashboard food card. Shows brand of latest food + averages
 *  (price/day, days/bag, daily grams, total bags). No countdown,
 *  no progress bar — the owner already knows when food runs out. */
export function FoodSummaryCard({ foods }: FoodSummaryCardProps) {
  const stats = computeFoodStats(foods);

  // No data → caller handles the empty state CTA, but render a friendly fallback
  // here just in case it's used standalone.
  if (!stats.latestFood) {
    return (
      <Card>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Ionicons name="restaurant" size={20} color={Colors.accent} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Comida</Text>
            <Text style={styles.brand}>Sin registrar</Text>
          </View>
        </View>
      </Card>
    );
  }

  const typeLabel = stats.latestFood.type
    ? FOOD_TYPES[stats.latestFood.type] ?? stats.latestFood.type
    : null;

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="restaurant" size={20} color={Colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Comida</Text>
          <Text style={styles.brand} numberOfLines={1}>
            {stats.latestFood.brand}
            {typeLabel ? ` · ${typeLabel}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>
            {stats.avgPricePerDay !== null ? `$${formatCurrency(stats.avgPricePerDay)}` : '—'}
          </Text>
          <Text style={styles.statLabel}>$/día prom.</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>
            {stats.avgDaysPerBag !== null ? `${stats.avgDaysPerBag}d` : '—'}
          </Text>
          <Text style={styles.statLabel}>dura/bolsa</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>
            {stats.avgDailyGrams !== null ? `${stats.avgDailyGrams}g` : '—'}
          </Text>
          <Text style={styles.statLabel}>g/día prom.</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{stats.totalBags}</Text>
          <Text style={styles.statLabel}>{stats.totalBags === 1 ? 'bolsa' : 'bolsas'}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  brand: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
});
