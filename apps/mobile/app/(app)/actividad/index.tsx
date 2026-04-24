import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { usePetContext } from '../../../contexts/PetContext';
import { useSubscription } from '../../../hooks/useSubscription';
import { evaluateBadges } from '@vivra/shared';

function getWeekStartISO(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday-based week
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export default function ActividadScreen() {
  const router = useRouter();
  const petData = usePetContext();
  const { isPremium } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await petData.refresh();
    setRefreshing(false);
  }, [petData.refresh]);

  const weekStart = getWeekStartISO();
  const weekLogs = petData.activityLogs.filter(l => l.date >= weekStart);
  const totalWalks = weekLogs.reduce((s, l) => s + l.walks, 0);
  const totalMinutes = weekLogs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);

  // Global activity count for the week (paseos + grooming + vuelos)
  const weekGroomings = petData.groomings.filter(g => g.date >= weekStart).length;
  const weekFlights = petData.adventures.filter(a => a.date && a.date >= weekStart).length;
  const totalActivities = totalWalks + weekGroomings + weekFlights;

  // Days with ANY activity this week
  const walkDates = new Set(weekLogs.filter(l => l.walks > 0).map(l => l.date));
  const groomDates = new Set(petData.groomings.filter(g => g.date >= weekStart).map(g => g.date));
  const flightDates = new Set(petData.adventures.filter(a => a.date && a.date >= weekStart).map(a => a.date));
  const allActiveDates = new Set([...walkDates, ...groomDates, ...flightDates]);
  const daysActive = allActiveDates.size;

  // All-time totals
  const allTimeWalks = petData.activityLogs.reduce((s, l) => s + l.walks, 0);
  const allTimeMinutes = petData.activityLogs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);
  const allTimeActivities = allTimeWalks + petData.groomings.length + petData.adventures.length;

  // Show weekly or all-time depending on whether the week has activity
  const hasWeekData = daysActive > 0;
  const showWalks = hasWeekData ? totalWalks : allTimeWalks;
  const showMinutes = hasWeekData ? totalMinutes : allTimeMinutes;
  const showActivities = hasWeekData ? totalActivities : allTimeActivities;
  const showDays = hasWeekData ? daysActive : new Set(petData.activityLogs.filter(l => l.walks > 0).map(l => l.date)).size;
  const statsLabel = hasWeekData ? 'Esta semana' : 'Historico';

  const { earnedCount, totalCount } = useMemo(() => {
    const badgeCounts = {
      profileComplete: !!(petData.pet?.name && petData.pet?.breed && petData.pet?.birth_date),
      vaccineCount: petData.vaccines.length,
      visitCount: petData.vetVisits.length,
      weightCount: petData.weightRecords.length,
      adventureCount: petData.adventures.length,
      flightCount: 0,
      groomingCount: petData.groomings.length,
      foodCount: petData.foods.length,
      hasAntipulgas: !!petData.lastAntipulgas,
      hasDesparasitante: !!petData.lastDesparasitante,
      vaccineNames: petData.vaccines.map(v => v.name),
    };
    return evaluateBadges(badgeCounts);
  }, [petData.pet?.name, petData.pet?.breed, petData.pet?.birth_date, petData.vaccines, petData.vetVisits.length, petData.weightRecords.length, petData.adventures.length, petData.groomings.length, petData.foods.length, petData.lastAntipulgas, petData.lastDesparasitante]);

  const lastGrooming = petData.groomings[0];
  const groomingDaysAgo = lastGrooming
    ? Math.floor((Date.now() - new Date(lastGrooming.date + 'T00:00:00').getTime()) / 86400000)
    : null;

  const petName = petData.pet?.name ?? 'tu mascota';

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
        {/* Stats header */}
        <View style={styles.statsHeader}>
          <Text style={styles.statsHeaderLabel}>{statsLabel}</Text>
          {!hasWeekData && allTimeActivities > 0 && (
            <Text style={styles.statsHeaderHint}>Sin actividad esta semana</Text>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{showDays}</Text>
            <Text style={styles.statLabel}>Días activos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{showActivities}</Text>
            <Text style={styles.statLabel}>Actividades</Text>
          </View>
          <View style={styles.statBox}>
            {isPremium ? (
              <>
                <Text style={styles.statValue}>{showMinutes}</Text>
                <Text style={styles.statLabel}>Minutos</Text>
              </>
            ) : (
              <>
                <Ionicons name="lock-closed" size={18} color={Colors.muted} />
                <Text style={styles.statLabel}>Minutos</Text>
              </>
            )}
          </View>
        </View>

        {/* Paseos */}
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(app)/actividad/paseos' as any)}>
          <View style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: Colors.accent + '18' }]}>
              <Ionicons name="walk" size={24} color={Colors.accent} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Paseos</Text>
              {petData.activityLogs.length === 0 ? (
                <Text style={styles.cardCta}>Registra el primer paseo de {petName}</Text>
              ) : totalWalks > 0 ? (
                <Text style={styles.cardSub}>
                  {totalWalks} paseo{totalWalks !== 1 ? 's' : ''} esta semana
                </Text>
              ) : (
                <Text style={styles.cardSub}>
                  {allTimeWalks} paseo{allTimeWalks !== 1 ? 's' : ''} registrado{allTimeWalks !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
          </View>
        </TouchableOpacity>

        {/* Grooming */}
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(app)/actividad/grooming' as any)}>
          <View style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: '#8B5CF618' }]}>
              <Ionicons name="cut" size={24} color="#8B5CF6" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Grooming</Text>
              {groomingDaysAgo === null ? (
                <Text style={styles.cardCta}>¿Cuándo fue el último baño?</Text>
              ) : (
                <Text style={styles.cardSub}>
                  {groomingDaysAgo === 0
                    ? 'Último baño hoy'
                    : `Último hace ${groomingDaysAgo} día${groomingDaysAgo !== 1 ? 's' : ''}`}
                  {groomingDaysAgo > 28 ? ' · Recomendado: cada 4 semanas' : ''}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
          </View>
        </TouchableOpacity>

        {/* Vuelos */}
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(app)/actividad/vuelos' as any)}>
          <View style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: '#3B82F618' }]}>
              <Ionicons name="airplane" size={24} color="#3B82F6" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Vuelos</Text>
              <Text style={styles.cardSub}>Historial de viajes de {petName}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
          </View>
        </TouchableOpacity>

        {/* Insignias */}
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(app)/actividad/insignias' as any)}>
          <View style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: Colors.warn + '18' }]}>
              <Ionicons name="ribbon" size={24} color={Colors.warn} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Insignias</Text>
              {earnedCount === 0 ? (
                <Text style={styles.cardCta}>Completa el perfil de {petName} para ganar tu primera insignia</Text>
              ) : (
                <Text style={styles.cardSub}>{earnedCount} de {totalCount} ganadas</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.muted} />
          </View>
        </TouchableOpacity>

        {/* Premium upsell for notifications */}
        {!isPremium && (
          <TouchableOpacity
            style={styles.premiumBanner}
            onPress={() => router.push('/paywall' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications" size={18} color={Colors.accent} />
            <View style={styles.premiumInfo}>
              <Text style={styles.premiumTitle}>Recordatorios inteligentes</Text>
              <Text style={styles.premiumDesc}>Vacunas, baño, antipulgas y más con Premium</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
          </TouchableOpacity>
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
  content: { padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm, paddingBottom: Spacing.xxl },
  // Stats
  statsHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  statsHeaderLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  statsHeaderHint: {
    fontSize: FontSize.xs, color: Colors.accent, fontStyle: 'italic',
  },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  statBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, alignItems: 'center',
  },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },
  statLabel: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  // Section cards
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: Spacing.md,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  cardSub: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  cardCta: { fontSize: FontSize.sm, color: Colors.accent, marginTop: 2 },
  // Premium banner
  premiumBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accentLight, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.accent + '30',
    padding: Spacing.md, marginTop: Spacing.xs,
  },
  premiumInfo: { flex: 1 },
  premiumTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  premiumDesc: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 1 },
});
