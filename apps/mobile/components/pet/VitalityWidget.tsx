import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoreCircle } from '../ui/ScoreCircle';
import { Card } from '../ui/Card';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import type { VitalityScoreResult, PillarScore, PillarId } from '@vivra/shared';

// The 4 vitality pillars after R1 (activity tracking was removed).
const PILLAR_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Peso': 'scale-outline',
  'Cuidado preventivo': 'shield-checkmark-outline',
  'Raza y edad': 'paw-outline',
  'Nutrición': 'restaurant-outline',
};

/** Where "Mejorar →" takes the user, per pillar. */
const PILLAR_ROUTES: Record<PillarId, { route: string; label: string }> = {
  peso: { route: '/(app)/salud/peso', label: 'Registrar peso' },
  cuidado: { route: '/(app)/salud/preventivos', label: 'Ver preventivos' },
  raza: { route: '/(app)/perfil', label: 'Completar perfil' },
  nutricion: { route: '/(app)/alimentacion', label: 'Ver alimentación' },
};

interface VitalityWidgetProps {
  vitality: VitalityScoreResult;
  compact?: boolean;
  /** Navigate handler for pillar CTAs (full mode). Receives the expo-router route. */
  onNavigate?: (route: string) => void;
}

function barColorFor(pct: number, isEstimated: boolean): string {
  if (isEstimated) return Colors.cardBorder;
  if (pct >= 70) return Colors.good;
  if (pct >= 40) return Colors.warn;
  return Colors.bad;
}

/**
 * Expandable pillar row. Tapping reveals WHY the score is what it is
 * (status + concrete tips from the scoring engine) and a CTA that takes the
 * user to the screen where they can improve it. This is the "explica por qué
 * nutrición está baja" feature — the engine always produced these insights,
 * the UI just never showed them.
 */
function PillarRow({
  pillar,
  expanded,
  onToggle,
  onNavigate,
}: {
  pillar: PillarScore;
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: (route: string) => void;
}) {
  const color = barColorFor(pillar.pct, pillar.isEstimated);
  const needsAttention = !pillar.isEstimated && pillar.pct < 70;
  const cta = PILLAR_ROUTES[pillar.id];

  return (
    <View>
      <TouchableOpacity
        style={styles.pillarRow}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${pillar.name}: ${pillar.isEstimated ? 'sin datos' : `${Math.round(pillar.pct)} por ciento`}. Toca para ${expanded ? 'cerrar' : 'ver'} detalles`}
      >
        <Ionicons name={PILLAR_ICONS[pillar.name] ?? 'ellipse-outline'} size={16} color={color} />
        <View style={styles.pillarInfo}>
          <Text style={styles.pillarName}>{pillar.name}</Text>
          {pillar.isEstimated ? (
            <Text style={styles.pillarHint}>{pillar.status}</Text>
          ) : (
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.min(pillar.pct, 100)}%`, backgroundColor: color }]} />
            </View>
          )}
        </View>
        <Text style={[styles.pillarPct, { color }]}>
          {pillar.isEstimated ? '—' : `${Math.round(pillar.pct)}%`}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.muted}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.pillarDetail, needsAttention && { borderLeftColor: color }]}>
          <Text style={styles.pillarStatus}>{pillar.status}</Text>
          {pillar.tips.map(tip => (
            <View key={`${pillar.id}-${tip}`} style={styles.tipRow}>
              <Ionicons name="bulb-outline" size={13} color={Colors.warn} style={{ marginTop: 1 }} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
          {pillar.tips.length === 0 && (
            <Text style={styles.tipText}>{pillar.description}</Text>
          )}
          {onNavigate && cta && (
            <TouchableOpacity
              style={styles.pillarCta}
              onPress={() => onNavigate(cta.route)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={cta.label}
            >
              <Text style={styles.pillarCtaText}>{cta.label}</Text>
              <Ionicons name="arrow-forward" size={13} color={Colors.accent} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export function VitalityWidget({ vitality, compact, onNavigate }: VitalityWidgetProps) {
  // Auto-expand the weakest non-estimated pillar so the user lands with the
  // most relevant insight already open.
  const weakest = [...vitality.pillars]
    .filter(p => !p.isEstimated)
    .sort((a, b) => a.pct - b.pct)[0];
  const [expandedId, setExpandedId] = useState<PillarId | null>(
    weakest && weakest.pct < 70 ? weakest.id : null,
  );

  if (compact) {
    // Surface the weakest pillar in the dashboard card without turning
    // incomplete information into an alarming health message.
    const attention = weakest && weakest.pct < 40 ? weakest : null;
    return (
      <Card>
        <View style={styles.compactRow}>
          <ScoreCircle
            score={vitality.total}
            color={vitality.color}
            showScore={vitality.showScore}
            label={vitality.category === 'building' ? 'Completando' : undefined}
          />
          <View style={styles.compactInfo}>
            <Text style={styles.title}>Vitality Score</Text>
            <Text style={styles.headline}>{vitality.headline}</Text>
            {attention ? (
              <View style={styles.attentionChip}>
                <Ionicons name="information-circle-outline" size={13} color={Colors.accent} />
                <Text style={styles.attentionText}>{attention.name}: información por completar</Text>
              </View>
            ) : vitality.subline ? (
              <Text style={styles.compactSubline}>{vitality.subline}</Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </View>
      </Card>
    );
  }

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
            <PillarRow
              key={p.id}
              pillar={p}
              expanded={expandedId === p.id}
              onToggle={() => setExpandedId(prev => (prev === p.id ? null : p.id))}
              onNavigate={onNavigate}
            />
          ))}
        </View>
      </View>

      <Text style={styles.expandHint}>Toca un pilar para ver por qué y cómo mejorarlo</Text>
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
    alignItems: 'flex-start',
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
  pillarHint: {
    fontSize: 10,
    color: Colors.muted,
    fontStyle: 'italic',
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
    width: 36,
    textAlign: 'right',
  },
  // Expanded detail under a pillar
  pillarDetail: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    marginLeft: Spacing.lg,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: Colors.cardBorder,
    gap: 6,
  },
  pillarStatus: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.muted,
    lineHeight: 16,
  },
  pillarCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  pillarCtaText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
  },
  expandHint: {
    fontSize: 10,
    color: Colors.muted,
    marginTop: Spacing.md,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  compactInfo: {
    flex: 1,
  },
  compactSubline: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  attentionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  attentionText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.accentDark,
  },
});
