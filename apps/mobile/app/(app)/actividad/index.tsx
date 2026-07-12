import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { usePetContext } from '../../../contexts/PetContext';
import { evaluateBadges } from '@vivra/shared';

/**
 * Activity hub — 2×2 grid of visually rich shortcut cards (Grooming, Viajes,
 * Insignias, Pasaporte) + "Actividad reciente": a merged, reverse-chronological
 * feed of everything registered for the pet (vacunas, peso, vet, grooming,
 * preventivos, alimentos) so the screen reflects the pet's real life.
 */

interface TimelineEvent {
  date: string; // YYYY-MM-DD
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  sub: string | null;
}

function relativeDay(date: string): string {
  const days = Math.floor((Date.now() - new Date(date + 'T00:00:00').getTime()) / 86400000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days}d`;
  const months = Math.floor(days / 30);
  return `Hace ${months}m`;
}

function buildTimeline(petData: ReturnType<typeof usePetContext>): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const g of petData.groomings) {
    events.push({ date: g.date, icon: 'cut', tint: '#8B5CF6', title: g.type || 'Grooming', sub: g.location });
  }
  for (const v of petData.vetVisits) {
    events.push({ date: v.date, icon: 'medkit', tint: '#10B981', title: v.reason || 'Visita al vet', sub: v.location });
  }
  for (const vac of petData.vaccines) {
    events.push({ date: vac.date_given, icon: 'shield-checkmark', tint: '#3B82F6', title: `Vacuna · ${vac.name}`, sub: null });
  }
  for (const w of petData.weightRecords) {
    events.push({ date: w.date, icon: 'trending-up', tint: Colors.accent, title: `Peso: ${w.weight_kg} kg`, sub: null });
  }
  for (const p of petData.preventives) {
    const label = p.type === 'antipulgas' ? 'Antipulgas' : p.type === 'desparasitante' ? 'Desparasitante' : 'Preventivo';
    events.push({ date: p.date_given, icon: 'shield-half', tint: Colors.warn, title: label, sub: p.product_name });
  }
  for (const f of petData.foods) {
    const date = f.start_date ?? f.created_at?.slice(0, 10);
    if (date) events.push({ date, icon: 'restaurant', tint: '#F59E0B', title: `Nueva bolsa · ${f.brand}`, sub: f.food_type ?? f.type ?? null });
  }

  return events
    .filter(e => !!e.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
}

interface HubCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  /** Big stat line (e.g. "Hace 22d", "5/10"). Falls back to '—'. */
  stat?: string | null;
  /** Small context line under the stat. */
  sub?: string | null;
  /** Accent CTA shown instead of stat when there's no data yet. */
  cta?: string | null;
  locked?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}

function HubCard({ icon, tint, title, stat, sub, cta, locked, onPress, accessibilityLabel }: HubCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={styles.hubCardWrap}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.hubCard}>
        <View style={styles.hubTopRow}>
          <View style={[styles.hubIcon, { backgroundColor: tint + '16' }]}>
            <Ionicons name={icon} size={26} color={tint} />
          </View>
          {locked ? (
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={11} color={Colors.muted} />
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={Colors.cardBorder} />
          )}
        </View>

        <Text style={styles.hubTitle} numberOfLines={1}>{title}</Text>

        {cta ? (
          <Text style={[styles.hubCta, { color: tint }]} numberOfLines={2}>{cta}</Text>
        ) : (
          <>
            <Text style={[styles.hubStat, { color: tint }]} numberOfLines={1}>{stat ?? '—'}</Text>
            {sub ? <Text style={styles.hubSub} numberOfLines={1}>{sub}</Text> : null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ActividadScreen() {
  const router = useRouter();
  const petData = usePetContext();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await petData.refresh();
    setRefreshing(false);
  }, [petData.refresh]);

  const { earnedCount, totalCount } = useMemo(() => {
    const badgeCounts = {
      profileComplete: !!(petData.pet?.name && petData.pet?.breed && petData.pet?.birth_date),
      vaccineCount: petData.vaccines.length,
      visitCount: petData.vetVisits.length,
      weightCount: petData.weightRecords.length,
      flightCount: 0,
      groomingCount: petData.groomings.length,
      foodCount: petData.foods.length,
      hasAntipulgas: !!petData.lastAntipulgas,
      hasDesparasitante: !!petData.lastDesparasitante,
      vaccineNames: petData.vaccines.map(v => v.name),
    };
    return evaluateBadges(badgeCounts);
  }, [petData.pet?.name, petData.pet?.breed, petData.pet?.birth_date, petData.vaccines, petData.vetVisits.length, petData.weightRecords.length, petData.groomings.length, petData.foods.length, petData.lastAntipulgas, petData.lastDesparasitante]);

  const lastGrooming = petData.groomings[0];
  const groomingDaysAgo = lastGrooming
    ? Math.floor((Date.now() - new Date(lastGrooming.date + 'T00:00:00').getTime()) / 86400000)
    : null;

  const petName = petData.pet?.name ?? 'tu mascota';

  const openPasaporte = useCallback(() => {
    if (!petData.pet?.id) return;
    // Passport VIEW is free (stickiness + appeal); only PDF export is premium,
    // gated inside the passport screen itself.
    router.push('/(app)/actividad/pasaporte' as any);
  }, [petData.pet?.id, router]);

  const timeline = useMemo(() => buildTimeline(petData), [
    petData.groomings, petData.vetVisits, petData.vaccines,
    petData.weightRecords, petData.preventives, petData.foods,
  ]);

  const groomingStat = groomingDaysAgo === null
    ? null
    : groomingDaysAgo === 0 ? 'Hoy'
    : `Hace ${groomingDaysAgo}d`;
  const groomingSub = groomingDaysAgo !== null && groomingDaysAgo > 28
    ? 'Recomendado: cada 4 sem'
    : lastGrooming?.type ?? 'Último baño';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Actividad</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <View style={styles.grid}>
          <HubCard
            icon="cut"
            tint="#8B5CF6"
            title="Grooming"
            stat={groomingStat}
            sub={groomingSub}
            cta={groomingDaysAgo === null ? '¿Cuándo fue el último baño?' : null}
            onPress={() => router.push('/(app)/actividad/grooming' as any)}
            accessibilityLabel={`Grooming de ${petName}`}
          />
          <HubCard
            icon="airplane"
            tint="#3B82F6"
            title="Viajes"
            stat="Vuelos"
            sub={`Historial de ${petName}`}
            onPress={() => router.push('/(app)/actividad/vuelos' as any)}
            accessibilityLabel={`Viajes de ${petName}`}
          />
          <HubCard
            icon="ribbon"
            tint={Colors.warn}
            title="Insignias"
            stat={earnedCount > 0 ? `${earnedCount}/${totalCount}` : null}
            sub={earnedCount > 0 ? 'ganadas' : null}
            cta={earnedCount === 0 ? `Completa el perfil de ${petName} para tu primera insignia` : null}
            onPress={() => router.push('/(app)/actividad/insignias' as any)}
            accessibilityLabel="Insignias ganadas"
          />
          <HubCard
            icon="document-text"
            tint={Colors.accent}
            title="Pasaporte"
            stat="Ver"
            sub="Identidad, vacunas y viajes"
            onPress={openPasaporte}
            accessibilityLabel={`Pasaporte de ${petName}`}
          />
        </View>

        {timeline.length > 0 && (
          <>
            <Text style={styles.timelineHeader}>Actividad reciente</Text>
            <View style={styles.timelineCard}>
              {timeline.map((e, i) => (
                <View key={`${e.date}-${e.title}-${i}`} style={[styles.timelineRow, i < timeline.length - 1 && styles.timelineRowBorder]}>
                  <View style={[styles.timelineIcon, { backgroundColor: e.tint + '16' }]}>
                    <Ionicons name={e.icon} size={16} color={e.tint} />
                  </View>
                  <View style={styles.timelineBody}>
                    <Text style={styles.timelineTitle} numberOfLines={1}>{e.title}</Text>
                    {e.sub ? <Text style={styles.timelineSub} numberOfLines={1}>{e.sub}</Text> : null}
                  </View>
                  <Text style={styles.timelineDate}>{relativeDay(e.date)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.ink },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md, paddingBottom: Spacing.xxl },

  // 2×2 hub grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  hubCardWrap: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  hubCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    minHeight: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  hubTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  hubIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  hubStat: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginTop: 2,
  },
  hubSub: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 1,
  },
  hubCta: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 4,
    lineHeight: 16,
  },

  // Recent activity timeline
  timelineHeader: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    marginTop: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timelineCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: Spacing.md,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
  },
  timelineRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBody: { flex: 1, minWidth: 0 },
  timelineTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  timelineSub: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 1,
  },
  timelineDate: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    fontVariant: ['tabular-nums'],
  },
});
