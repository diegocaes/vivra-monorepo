import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoreCircle } from '../ui/ScoreCircle';
import { Card } from '../ui/Card';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import type { VitalityScoreResult } from '@vivra/shared';

const PILLAR_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Peso': 'scale-outline',
  'Cuidado preventivo': 'shield-checkmark-outline',
  'Raza y edad': 'paw-outline',
  'Actividad': 'walk-outline',
  'Nutrición': 'restaurant-outline',
};

interface VitalityWidgetProps {
  vitality: VitalityScoreResult;
}

function PillarBar({ name, pct, isEstimated }: { name: string; pct: number; isEstimated: boolean }) {
  // pct comes as 0-100 integer from vitality-score.ts
  const barColor = isEstimated
    ? Colors.cardBorder
    : pct >= 70
      ? Colors.good
      : pct >= 40
        ? Colors.warn
        : Colors.bad;

  return (
    <View style={styles.pillarRow}>
      <Ionicons name={PILLAR_ICONS[name] ?? 'ellipse-outline'} size={16} color={barColor} />
      <View style={styles.pillarInfo}>
        <Text style={styles.pillarName}>{name}</Text>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
        </View>
      </View>
      <Text style={[styles.pillarPct, { color: barColor }]}>
        {isEstimated ? '—' : `${Math.round(pct)}%`}
      </Text>
    </View>
  );
}

export function VitalityWidget({ vitality }: VitalityWidgetProps) {
  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.title}>Vitality Score</Text>
        <Text style={styles.headline}>{vitality.headline}</Text>
      </View>

      <View style={styles.body}>
        <ScoreCircle
          score={vitality.total}
          color={vitality.color}
          showScore={vitality.showScore}
          label={vitality.category === 'building' ? 'Completando' : undefined}
        />

        <View style={styles.pillars}>
          {vitality.pillars.map(p => (
            <PillarBar
              key={p.name}
              name={p.name}
              pct={p.pct}
              isEstimated={p.isEstimated}
            />
          ))}
        </View>
      </View>

      {vitality.subline ? (
        <Text style={styles.subline}>{vitality.subline}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  headline: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: 2,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  pillars: {
    flex: 1,
    gap: Spacing.sm,
  },
  pillarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pillarInfo: {
    flex: 1,
  },
  pillarName: {
    fontSize: FontSize.xs,
    color: Colors.ink,
    marginBottom: 2,
  },
  barBg: {
    height: 6,
    backgroundColor: Colors.cardBorder,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: Radius.full,
  },
  pillarPct: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    width: 40,
    textAlign: 'right',
  },
  subline: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: Spacing.md,
    fontStyle: 'italic',
  },
});
