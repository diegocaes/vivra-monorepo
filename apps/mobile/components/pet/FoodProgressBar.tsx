import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';

interface FoodProgressBarProps {
  brand: string;
  dailyGrams: number;
  bagSize: number;
  bagUnit: string | null;
  startDate: string;
}

function bagToGrams(size: number, unit: string | null): number {
  if (unit === 'kg') return size * 1000;
  if (unit === 'lb') return size * 453.592;
  return size; // already grams
}

export function FoodProgressBar({ brand, dailyGrams, bagSize, bagUnit, startDate }: FoodProgressBarProps) {
  const bagGrams = bagToGrams(bagSize, bagUnit);
  const totalDays = Math.floor(bagGrams / dailyGrams);
  const daysElapsed = Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, totalDays - daysElapsed);
  const pct = Math.min(1, daysElapsed / totalDays);
  const remaining = 1 - pct;

  const barColor = remaining > 0.3 ? Colors.good : remaining > 0.1 ? Colors.warn : Colors.bad;

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="restaurant" size={20} color={Colors.accent} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Alimento</Text>
          <Text style={styles.brand}>{brand}</Text>
        </View>
      </View>

      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.round(remaining * 100)}%`, backgroundColor: barColor }]} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{dailyGrams}g/día</Text>
        <Text style={[styles.footerText, styles.daysLeft]}>
          {daysLeft > 0 ? `${daysLeft} días restantes` : 'Bolsa agotada'}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  brand: {
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  barBg: {
    height: 10,
    backgroundColor: Colors.cardBorder,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: 10,
    borderRadius: Radius.full,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  daysLeft: {
    fontWeight: FontWeight.medium,
  },
});
