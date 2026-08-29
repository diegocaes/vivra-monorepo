import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { usePetContext } from '../../contexts/PetContext';
import { useVitality } from '../../hooks/useVitality';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PetHeroCard } from '../../components/pet/PetHeroCard';
import { VitalityWidget } from '../../components/pet/VitalityWidget';
import { FoodSummaryCard } from '../../components/pet/FoodSummaryCard';
import { ReminderCard } from '../../components/pet/ReminderCard';
import { CareCard } from '../../components/pet/CareCard';
import { PetSelector } from '../../components/pet/PetSelector';
import { DashboardSkeleton } from '../../components/shared/SkeletonLoader';
import { Card } from '../../components/ui/Card';
import { formatDate, formatGroomingServices } from '@vivra/shared';

/**
 * Compact "time ago" formatter used for the care-card badges.
 *   < 1 day  → "Hoy"
 *   < 30d    → "Hace Nd"
 *   < 12mo   → "Hace Nm"
 *   else     → "Hace Na"
 */
function shortTimeAgo(isoDate: string): string {
  const diffDays = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (diffDays <= 0) return 'Hoy';
  if (diffDays < 30) return `Hace ${diffDays}d`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `Hace ${months}m`;
  const years = Math.floor(diffDays / 365);
  return `Hace ${years}a`;
}

type VaccineSummary = {
  state: 'empty' | 'overdue' | 'scheduled' | 'recorded';
  title: string;
  detail: string;
  dismissId: string | null;
};

function buildVaccineSummary(vaccines: { id: string; name: string; next_due: string | null }[]): VaccineSummary {
  const latestByName = new Map<string, (typeof vaccines)[number]>();
  for (const vaccine of vaccines) {
    if (!latestByName.has(vaccine.name)) latestByName.set(vaccine.name, vaccine);
  }
  const latest = [...latestByName.values()];
  if (latest.length === 0) {
    return {
      state: 'empty',
      title: 'Registra su primera vacuna',
      detail: 'Guarda la dosis tal como aparece en el carné',
      dismissId: null,
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dated = latest
    .filter((vaccine): vaccine is typeof vaccine & { next_due: string } => Boolean(vaccine.next_due))
    .map(vaccine => ({ vaccine, due: new Date(`${vaccine.next_due}T00:00:00`) }))
    .sort((a, b) => a.due.getTime() - b.due.getTime());
  const next = dated[0];
  if (next) {
    const state = next.due < today ? 'overdue' : 'scheduled';
    return {
      state,
      title: state === 'overdue' ? `${next.vaccine.name} pendiente` : `Próxima: ${next.vaccine.name}`,
      detail: state === 'overdue' ? 'Confirma el refuerzo con tu veterinario' : formatDate(next.vaccine.next_due),
      // If the vaccine or its due date changes, the new reminder appears again.
      dismissId: `${next.vaccine.id}:${next.vaccine.next_due}`,
    };
  }

  return {
    state: 'recorded',
    title: `${latest.length} vacuna${latest.length === 1 ? '' : 's'} registrada${latest.length === 1 ? '' : 's'}`,
    detail: 'Aún no hay una próxima fecha registrada',
    dismissId: null,
  };
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const petData = usePetContext();
  const vitality = useVitality(petData);
  const { isPremium } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [dismissedVaccineKey, setDismissedVaccineKey] = useState<string | null>(null);
  const [checkedVaccineKey, setCheckedVaccineKey] = useState<string | null>(null);
  const vaccineSummary = buildVaccineSummary(petData.vaccines);
  const vaccineDismissStorageKey = user && petData.pet && vaccineSummary.dismissId
    ? `@vivra/home-vaccine-dismissed/${user.id}/${petData.pet.id}/${vaccineSummary.dismissId}`
    : null;

  useEffect(() => {
    let active = true;
    setCheckedVaccineKey(null);
    if (!vaccineDismissStorageKey) {
      setDismissedVaccineKey(null);
      return () => { active = false; };
    }
    AsyncStorage.getItem(vaccineDismissStorageKey)
      .then(value => {
        if (!active) return;
        setDismissedVaccineKey(value === '1' ? vaccineDismissStorageKey : null);
        setCheckedVaccineKey(vaccineDismissStorageKey);
      })
      .catch(() => {
        if (!active) return;
        setDismissedVaccineKey(null);
        setCheckedVaccineKey(vaccineDismissStorageKey);
      });
    return () => { active = false; };
  }, [vaccineDismissStorageKey]);

  const dismissVaccineReminder = useCallback(async () => {
    if (!vaccineDismissStorageKey) return;
    setDismissedVaccineKey(vaccineDismissStorageKey);
    setCheckedVaccineKey(vaccineDismissStorageKey);
    await AsyncStorage.setItem(vaccineDismissStorageKey, '1');
  }, [vaccineDismissStorageKey]);

  // Fetch unread notification count + trial status.
  // `refreshing` va en las deps aunque no se lea en el cuerpo: se usa como
  // disparador para que el pull-to-refresh vuelva a traer estos contadores.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .eq('dismissed', false)
      .then(({ count }) => setUnreadCount(count ?? 0))
      .then(undefined, () => {});

    // Check Supabase trial status (for referral trials, independent of RevenueCat)
    supabase
      .from('user_subscriptions')
      .select('plan, source, premium_until, trial_ends_at')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.plan === 'premium' && data?.source === 'trial' && data?.premium_until) {
          const days = Math.max(0, Math.ceil((new Date(data.premium_until).getTime() - Date.now()) / 86400000));
          setTrialDaysLeft(days);
          setIsTrial(true);
        }
      })
      .then(undefined, () => {});
  }, [user, refreshing]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await petData.refresh();
    setRefreshing(false);
  }, [petData.refresh]);

  // Loading state
  if (petData.loading && !refreshing) {
    return (
      <SafeAreaView testID="screen-home" style={styles.safe} edges={['top']}>
        <ScrollView style={styles.scroll}>
          <DashboardSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // No pet registered
  if (!petData.pet) {
    return (
      <SafeAreaView testID="screen-home" style={styles.safe} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        >
          <View style={styles.emptyIcon}>
            <Ionicons name="paw" size={48} color={Colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>Bienvenido a Vivra</Text>
          <Text style={styles.emptyText}>
            Crea el perfil de tu mascota para empezar a registrar su vida.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.replace('/onboarding' as any)}
          >
            <Text style={styles.emptyBtnText}>Agregar mascota</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Whether the user has logged any food at all (drives empty-state CTA below)
  const hasFood = petData.foods.length > 0;
  const hasPreventiveHistory = Boolean(petData.lastAntipulgas?.date_given || petData.lastDesparasitante?.date_given);
  const isProfileStarting = !hasFood
    && !hasPreventiveHistory
    && petData.groomings.length === 0
    && petData.vetVisits.length === 0;

  // Preventive critical banner — only for treatments that are actually overdue.
  const preventiveStatus = (() => {
    const compute = (nextDue: string | null | undefined) => {
      if (!nextDue) return { status: 'unknown' as const, days: 0 };
      const next = new Date(`${nextDue}T00:00:00`);
      const days = Math.ceil((next.getTime() - Date.now()) / 86400000);
      if (days < 0) return { status: 'overdue' as const, days: Math.abs(days) };
      return { status: 'ok' as const, days };
    };
    const anti = compute(petData.lastAntipulgas?.next_due);
    const des = compute(petData.lastDesparasitante?.next_due);
    const overdueTypes: { label: string; days: number }[] = [];
    if (anti.status === 'overdue') overdueTypes.push({ label: 'antipulgas', days: anti.days });
    if (des.status === 'overdue') overdueTypes.push({ label: 'desparasitante', days: des.days });
    return { overdueTypes };
  })();
  // Missing data is not a medical warning. Only show a red banner when a
  // previously registered treatment is actually overdue.
  const showPreventiveBanner = preventiveStatus.overdueTypes.length > 0;

  return (
    <SafeAreaView testID="screen-home" style={styles.safe} edges={['top']}>
      {/* Header with notification bell */}
      <View style={styles.dashHeader}>
        <Text style={styles.dashTitle}>Vivra</Text>
        <TouchableOpacity onPress={() => router.push('/notificaciones' as any)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="notifications-outline" size={24} color={Colors.ink} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Pet selector (only shows if multiple pets) */}
      <PetSelector
        pets={petData.pets}
        activePetId={petData.pet.id}
        onSelect={petData.setActivePetId}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* Hero card */}
        <PetHeroCard pet={petData.pet} />

        {/* A newly created pet needs an invitation, not health alarms. */}
        {isProfileStarting && (
          <Card style={styles.setupCard}>
            <View style={styles.setupIcon}>
              <Ionicons name="sparkles" size={20} color={Colors.accent} />
            </View>
            <View style={styles.setupCopy}>
              <Text style={styles.setupTitle}>¡{petData.pet.name} ya está en Vivra!</Text>
              <Text style={styles.setupText}>
                Agrega su alimentación, peso y preventivos poco a poco, cuando tengas la información.
              </Text>
            </View>
          </Card>
        )}

        {/* Preventivo critical banner — only after a registered treatment expires */}
        {showPreventiveBanner && (
          <TouchableOpacity
            style={styles.preventiveBanner}
            onPress={() => router.navigate('/(app)/salud/preventivos' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle" size={22} color={Colors.bad} />
            <View style={{ flex: 1 }}>
              <Text style={styles.preventiveBannerTitle}>
                {preventiveStatus.overdueTypes.length === 2
                    ? 'Preventivos vencidos'
                    : `${preventiveStatus.overdueTypes[0].label} vencido ${preventiveStatus.overdueTypes[0].days}d`}
              </Text>
              <Text style={styles.preventiveBannerDesc}>
                Aplica y registra la nueva dosis
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.bad} />
          </TouchableOpacity>
        )}

        {/* Vitality Score */}
        {vitality && !isProfileStarting && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.navigate('/(app)/salud' as any)}>
            <VitalityWidget vitality={vitality} compact />
          </TouchableOpacity>
        )}

        {isProfileStarting && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.navigate('/(app)/perfil' as any)}>
            <Card style={styles.vitalitySetupCard}>
              <View style={styles.vitalitySetupIcon}>
                <Ionicons name="heart-outline" size={24} color={Colors.accent} />
              </View>
              <View style={styles.setupCopy}>
                <Text style={styles.vitalitySetupTitle}>Vitality Score en preparación</Text>
                <Text style={styles.vitalitySetupText}>
                  Lo activaremos cuando conozcamos un poco más a {petData.pet.name}.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
            </Card>
          </TouchableOpacity>
        )}

        {(!vaccineDismissStorageKey || (
          checkedVaccineKey === vaccineDismissStorageKey
          && dismissedVaccineKey !== vaccineDismissStorageKey
        )) && <TouchableOpacity
          style={[
            styles.vaccineCta,
            vaccineSummary.state === 'overdue' && styles.vaccineCtaOverdue,
            vaccineSummary.state === 'scheduled' && styles.vaccineCtaScheduled,
          ]}
          onPress={() => router.navigate('/(app)/salud/vacunas' as any)}
          activeOpacity={0.8}
        >
          <View style={[
            styles.vaccineCtaIcon,
            vaccineSummary.state === 'overdue' && styles.vaccineCtaIconOverdue,
          ]}>
            <Ionicons name="medkit-outline" size={21} color={vaccineSummary.state === 'overdue' ? Colors.bad : Colors.good} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.vaccineCtaTitle, vaccineSummary.state === 'overdue' && styles.vaccineCtaTitleOverdue]}>{vaccineSummary.title}</Text>
            <Text style={styles.vaccineCtaText}>{vaccineSummary.detail}</Text>
          </View>
          {vaccineDismissStorageKey && (
            <TouchableOpacity
              onPress={(event) => {
                event.stopPropagation();
                void dismissVaccineReminder();
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Ocultar recordatorio de vacuna"
            >
              <Ionicons name="close" size={19} color={Colors.muted} />
            </TouchableOpacity>
          )}
          <Ionicons name="chevron-forward" size={18} color={vaccineSummary.state === 'overdue' ? Colors.bad : Colors.good} />
        </TouchableOpacity>}

        {/* Food summary — averages and trazabilidad, no countdown */}
        {hasFood ? (
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.navigate('/(app)/alimentacion' as any)}>
            <FoodSummaryCard foods={petData.foods} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.foodCta}
            onPress={() => router.navigate('/(app)/alimentacion' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="restaurant-outline" size={20} color={Colors.accent} />
            <Text style={styles.foodCtaText}>¿Qué come {petData.pet.name}? Registra su alimento</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
          </TouchableOpacity>
        )}

        {/* Care grid — 2×2 quick access. Each card pulsable, navigates to
            its own detail screen. Reuses one CareCard component parametrized
            by icon/badge/subtitle/etc. The preventives still use ReminderCard
            which owns the 30-day cycle logic but renders via CareCard for
            visual consistency. */}
        <View style={styles.careGrid}>
          <View style={styles.careCol}>
            <ReminderCard
              type="antipulgas"
              lastDate={petData.lastAntipulgas?.date_given ?? null}
              nextDue={petData.lastAntipulgas?.next_due}
              productName={petData.lastAntipulgas?.product_name}
              onPress={() => router.navigate('/(app)/salud/preventivos' as any)}
            />
          </View>
          <View style={styles.careCol}>
            <ReminderCard
              type="desparasitante"
              lastDate={petData.lastDesparasitante?.date_given ?? null}
              nextDue={petData.lastDesparasitante?.next_due}
              productName={petData.lastDesparasitante?.product_name}
              onPress={() => router.navigate('/(app)/salud/preventivos' as any)}
            />
          </View>
          <View style={styles.careCol}>
            <CareCard
              icon="cut"
              iconColor="#3B82F6"
              badge={
                petData.groomings[0]?.date
                  ? { text: shortTimeAgo(petData.groomings[0].date), color: '#3B82F6' }
                  : null
              }
              title="Grooming"
              subtitle={
                petData.groomings[0]?.location
                || petData.groomings[0]?.groomer_name
                || formatGroomingServices(
                  petData.groomings[0]?.services,
                  petData.groomings[0]?.type,
                )
                || null
              }
              lastDate={petData.groomings[0]?.date ?? null}
              emptyText="Sin baños registrados"
              onPress={() => router.navigate('/(app)/actividad/grooming?from=inicio' as any)}
            />
          </View>
          <View style={styles.careCol}>
            <CareCard
              icon="medkit"
              iconColor="#14B8A6"
              badge={
                petData.vetVisits[0]?.date
                  ? { text: shortTimeAgo(petData.vetVisits[0].date), color: '#14B8A6' }
                  : null
              }
              title="Veterinario"
              subtitle={
                petData.vetVisits[0]?.reason
                || petData.vetVisits[0]?.location
                || null
              }
              lastDate={petData.vetVisits[0]?.date ?? null}
              emptyText="Sin visitas registradas"
              onPress={() => router.navigate('/(app)/salud/historial' as any)}
            />
          </View>
        </View>

        {/* Trial expiring banner */}
        {isTrial && trialDaysLeft !== null && trialDaysLeft <= 1 && (
          <TouchableOpacity
            style={styles.trialExpiringBanner}
            onPress={() => router.push('/paywall' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="time-outline" size={20} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.trialExpiringTitle}>
                Tu Premium gratis vence {trialDaysLeft === 0 ? 'hoy' : 'mañana'}
              </Text>
              <Text style={styles.trialExpiringDesc}>
                Sin Premium perderás el co-dueño y el desglose de gastos
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#DC2626" />
          </TouchableOpacity>
        )}

        {/* Trial active banner */}
        {isTrial && trialDaysLeft !== null && trialDaysLeft > 1 && (
          <TouchableOpacity
            style={styles.trialBanner}
            onPress={() => router.push('/paywall' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="star" size={18} color={Colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumBannerTitle}>Premium gratis por {trialDaysLeft} días</Text>
              <Text style={styles.premiumBannerDesc}>Gracias a tu referido. Disfruta todas las funciones.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
          </TouchableOpacity>
        )}

        {/* Premium upsell */}
        {!isPremium && !isTrial && (
          <TouchableOpacity
            style={styles.premiumBanner}
            onPress={() => router.push('/paywall' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="star" size={18} color={Colors.accent} />
            <View style={styles.premiumBannerInfo}>
              <Text style={styles.premiumBannerTitle}>Vivra Premium</Text>
              <Text style={styles.premiumBannerDesc}>Agrega un co-dueño y ve el desglose de tus gastos</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
          </TouchableOpacity>
        )}

        {/* Error banner */}
        {petData.error && (
          <Card style={styles.errorCard}>
            <Text style={styles.errorText}>{petData.error}</Text>
          </Card>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  vaccineCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#ECFDF5',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: Spacing.md,
  },
  vaccineCtaScheduled: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  vaccineCtaOverdue: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  vaccineCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
  },
  vaccineCtaIconOverdue: { backgroundColor: '#FEE2E2' },
  vaccineCtaTitle: { color: Colors.ink, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  vaccineCtaTitleOverdue: { color: Colors.bad },
  vaccineCtaText: { color: Colors.muted, fontSize: FontSize.xs, marginTop: 2 },
  dashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  dashTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.bad,
    borderRadius: Radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  // 2×2 grid of care cards. flexWrap + each card 50%-minus-half-gap so they
  // wrap into two rows cleanly without needing a separate row container.
  careGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  careCol: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  foodCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Colors.accent}30`,
    padding: Spacing.md,
  },
  foodCtaText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.ink,
  },
  setupCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderColor: `${Colors.accent}28`,
  },
  setupIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupCopy: { flex: 1 },
  setupTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.ink },
  setupText: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 3, lineHeight: 18 },
  vitalitySetupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  vitalitySetupIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalitySetupTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.ink },
  vitalitySetupText: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 3, lineHeight: 17 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
    marginBottom: Spacing.sm,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
  },
  emptyBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.accent}20`,
  },
  premiumBannerInfo: { flex: 1 },
  premiumBannerTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  premiumBannerDesc: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 1 },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.accent}30`,
  },
  trialExpiringBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  trialExpiringTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#DC2626' },
  trialExpiringDesc: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 1 },
  preventiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.bad,
  },
  preventiveBannerTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.bad },
  preventiveBannerDesc: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 1 },
  errorCard: {
    backgroundColor: `${Colors.bad}12`,
    borderColor: Colors.bad,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.bad,
  },
});
