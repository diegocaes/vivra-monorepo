import { BrandLogo } from '../../components/ui/BrandLogo';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { FREE_LIMITS } from '../../constants/revenueCat';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { usePetContext } from '../../contexts/PetContext';
import { useVitality } from '../../hooks/useVitality';
import { useDashboardStatus } from '../../hooks/useDashboardStatus';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { CategoryGrid } from '../../components/pet/CategoryGrid';
import { VitalityWidget } from '../../components/pet/VitalityWidget';
import { FoodSummaryCard } from '../../components/pet/FoodSummaryCard';
import { ReminderCard } from '../../components/pet/ReminderCard';
import { CareCard } from '../../components/pet/CareCard';
import { PetSelector } from '../../components/pet/PetSelector';
import { DashboardSkeleton } from '../../components/shared/SkeletonLoader';
import { DataLoadNotice } from '../../components/shared/DataLoadNotice';
import { buildVaccineOverview, daysUntilDate, formatDate, formatGroomingServices } from '@vivra/shared';

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
  legacyDismissId: string | null;
};

function buildVaccineSummary(vaccines: { id: string; name: string; date_given: string; next_due: string | null }[]): VaccineSummary {
  const overview = buildVaccineOverview(vaccines);
  const latest = overview.latestByName;
  if (latest.length === 0) {
    return {
      state: 'empty',
      title: 'Registra su primera vacuna',
      detail: 'Guarda la dosis tal como aparece en el carné',
      dismissId: null,
      legacyDismissId: null,
    };
  }

  const next = overview.schedule[0];
  if (next) {
    const days = daysUntilDate(next.next_due!);
    const state = days < 0 ? 'overdue' : 'scheduled';
    return {
      state,
      title: state === 'overdue' ? `${next.name}: fecha por confirmar` : `Próxima vacuna: ${next.name}`,
      detail: state === 'overdue'
        ? 'Consulta con tu veterinario si corresponde un refuerzo'
        : days === 0 ? 'La fecha registrada es hoy' : `Fecha registrada: ${formatDate(next.next_due!)}`,
      // If the vaccine or its due date changes, the new reminder appears again.
      // A reminder dismissed while merely upcoming must reappear if that
      // same date later becomes overdue.
      dismissId: `${next.id}:${next.next_due}:${state}`,
      // Preserve existing scheduled dismissals created before the state was
      // added to the key. Never reuse that legacy key for an overdue dose.
      legacyDismissId: state === 'scheduled' ? `${next.id}:${next.next_due}` : null,
    };
  }

  return {
    state: 'recorded',
    title: `${latest.length} vacuna${latest.length === 1 ? '' : 's'} registrada${latest.length === 1 ? '' : 's'}`,
    detail: 'Aún no hay una próxima fecha registrada',
    dismissId: null,
    legacyDismissId: null,
  };
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const petData = usePetContext();
  const vitality = useVitality(petData);
  const { isPremium } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const { data: dashboardStatus, error: statusError, refresh: refreshStatus } = useDashboardStatus(supabase, user?.id ?? null);
  const { unreadCount = 0, isTrial = false, trialDaysLeft = null } = dashboardStatus ?? {};
  const [dismissedVaccineKey, setDismissedVaccineKey] = useState<string | null>(null);
  const [checkedVaccineKey, setCheckedVaccineKey] = useState<string | null>(null);
  const vaccineSummary = buildVaccineSummary(petData.vaccines);
  const vaccineDismissStorageKey = user && petData.pet && vaccineSummary.dismissId
    ? `@vivra/home-vaccine-dismissed/${user.id}/${petData.pet.id}/${vaccineSummary.dismissId}`
    : null;
  const legacyVaccineDismissStorageKey = user && petData.pet && vaccineSummary.legacyDismissId
    ? `@vivra/home-vaccine-dismissed/${user.id}/${petData.pet.id}/${vaccineSummary.legacyDismissId}`
    : null;

  useEffect(() => {
    let active = true;
    setCheckedVaccineKey(null);
    if (!vaccineDismissStorageKey) {
      setDismissedVaccineKey(null);
      return () => { active = false; };
    }
    Promise.all([
      AsyncStorage.getItem(vaccineDismissStorageKey),
      legacyVaccineDismissStorageKey ? AsyncStorage.getItem(legacyVaccineDismissStorageKey) : Promise.resolve(null),
    ])
      .then(([value, legacyValue]) => {
        if (!active) return;
        setDismissedVaccineKey(value === '1' || legacyValue === '1' ? vaccineDismissStorageKey : null);
        setCheckedVaccineKey(vaccineDismissStorageKey);
      })
      .catch(() => {
        if (!active) return;
        setDismissedVaccineKey(null);
        setCheckedVaccineKey(vaccineDismissStorageKey);
      });
    return () => { active = false; };
  }, [vaccineDismissStorageKey, legacyVaccineDismissStorageKey]);

  const dismissVaccineReminder = useCallback(async () => {
    if (!vaccineDismissStorageKey) return;
    setDismissedVaccineKey(vaccineDismissStorageKey);
    setCheckedVaccineKey(vaccineDismissStorageKey);
    await AsyncStorage.setItem(vaccineDismissStorageKey, '1');
  }, [vaccineDismissStorageKey]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([petData.refresh(), refreshStatus()]);
    } finally {
      setRefreshing(false);
    }
  }, [petData.refresh, refreshStatus]);

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
  const isProfileStarting = petData.vaccines.length === 0
    && petData.weightRecords.length === 0
    && !hasFood
    && !hasPreventiveHistory
    && petData.groomings.length === 0
    && petData.vetVisits.length === 0;

  // Preventive critical banner — only for treatments that are actually overdue.
  const preventiveStatus = (() => {
    const compute = (nextDue: string | null | undefined) => {
      if (!nextDue) return { status: 'unknown' as const, days: 0 };
      const days = daysUntilDate(nextDue);
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
  // Missing data is not a medical warning. Only show a calm reminder when a
  // previously registered treatment has a date in the past.
  const showPreventiveBanner = preventiveStatus.overdueTypes.length > 0;

  return (
    <SafeAreaView testID="screen-home" style={styles.safe} edges={['top']}>
      {/* Header with notification bell */}
      <View style={styles.dashHeader}>
        <BrandLogo width={134} style={styles.dashTitle} />
        <View style={styles.headerActions}>
        <TouchableOpacity
          onPress={() => router.push('/notificaciones' as any)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
        >
          <Ionicons name="notifications-outline" size={24} color={Colors.ink} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.addPet} onPress={() => petData.pets.length >= FREE_LIMITS.MAX_PETS ? Alert.alert('Límite alcanzado', `Puedes tener hasta ${FREE_LIMITS.MAX_PETS} mascotas por cuenta.`) : router.push('/onboarding')} accessibilityRole="button" accessibilityLabel="Agregar mascota">
          <Ionicons name="add" size={26} color={Colors.white} />
        </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
      {/* Pet selector */}
      <PetSelector
        pets={petData.pets}
        activePetId={petData.pet.id}
        onSelect={petData.setActivePetId}
      />


        <CategoryGrid />

        {/* Progressive disclosure: a brand-new profile gets one clear next
            step. The regular dashboard appears after the first real record. */}
        {isProfileStarting && (
          <View style={styles.startingGuide}>
            <View style={styles.startingGuideIcon}>
              <Ionicons name="medkit-outline" size={23} color={Colors.accent} />
            </View>
            <View style={styles.startingGuideCopy}>
              <Text style={styles.startingGuideTitle}>Empieza con su primera vacuna</Text>
              <Text style={styles.startingGuideText}>
                Así comienzas el historial de {petData.pet.name}. Puedes completar lo demás poco a poco.
              </Text>
              <TouchableOpacity
                style={styles.startingGuideAction}
                onPress={() => router.navigate('/(app)/salud/vacunas' as any)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Registrar primera vacuna"
              >
                <Text style={styles.startingGuideActionText}>Registrar vacuna</Text>
                <Ionicons name="arrow-forward" size={16} color={Colors.accent} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Preventivo reminder — only after a registered treatment date passes. */}
        {showPreventiveBanner && (
          <TouchableOpacity
            style={styles.preventiveBanner}
            onPress={() => router.navigate('/(app)/salud/preventivos' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="information-circle-outline" size={22} color="#93652D" />
            <View style={{ flex: 1 }}>
              <Text style={styles.preventiveBannerTitle}>
                {preventiveStatus.overdueTypes.length === 2
                  ? 'Revisa las próximas fechas de preventivos'
                  : `Revisa la próxima fecha de ${preventiveStatus.overdueTypes[0].label}`}
              </Text>
              <Text style={styles.preventiveBannerDesc}>
                {preventiveStatus.overdueTypes.length === 2
                  ? 'Las fechas registradas ya pasaron. Confírmalas con tu veterinario.'
                  : 'La fecha registrada ya pasó. Confírmala con tu veterinario.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#93652D" />
          </TouchableOpacity>
        )}

        {/* Vitality Score */}
        {vitality && !isProfileStarting && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.navigate('/(app)/salud' as any)}>
            <VitalityWidget vitality={vitality} compact />
          </TouchableOpacity>
        )}

        {!isProfileStarting && <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Lo próximo</Text><TouchableOpacity accessibilityRole="button" onPress={() => router.navigate('/(app)/salud/vacunas')}><Text style={styles.sectionLink}>Ver todo ›</Text></TouchableOpacity></View>}
        {!isProfileStarting && (!vaccineDismissStorageKey || (
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
            vaccineSummary.state === 'scheduled' && styles.vaccineCtaIconScheduled,
          ]}>
            <Ionicons
              name="medkit-outline"
              size={21}
              color={vaccineSummary.state === 'overdue' ? '#93652D' : vaccineSummary.state === 'scheduled' ? '#567F94' : Colors.good}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.vaccineCtaTitle}>{vaccineSummary.title}</Text>
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
          <Ionicons name="chevron-forward" size={18} color={vaccineSummary.state === 'overdue' ? '#93652D' : vaccineSummary.state === 'scheduled' ? '#567F94' : Colors.good} />
        </TouchableOpacity>}

        {/* Food summary — averages and trazabilidad, no countdown */}
        {!isProfileStarting && (hasFood ? (
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.navigate('/(app)/cuidado/alimentacion' as any)}>
            <FoodSummaryCard foods={petData.foods} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.foodCta}
            onPress={() => router.navigate('/(app)/cuidado/alimentacion' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="restaurant-outline" size={20} color={Colors.accent} />
            <Text style={styles.foodCtaText}>Agrega la alimentación de {petData.pet.name}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
          </TouchableOpacity>
        ))}

        {/* Care grid — 2×2 quick access. */}
        {!isProfileStarting && <View style={styles.careGrid}>
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
              iconColor="#567F94"
              badge={
                petData.groomings[0]?.date
                  ? { text: shortTimeAgo(petData.groomings[0].date), color: '#567F94' }
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
              onPress={() => router.push('/grooming?from=inicio' as any)}
            />
          </View>
          <View style={styles.careCol}>
            <CareCard
              icon="medkit"
              iconColor="#4C8876"
              badge={
                petData.vetVisits[0]?.date
                  ? { text: shortTimeAgo(petData.vetVisits[0].date), color: '#4C8876' }
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
        </View>}

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
        {!isProfileStarting && !isPremium && !isTrial && (
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

        <DataLoadNotice message={petData.error ?? (statusError ? 'No pudimos cargar las notificaciones y la suscripción.' : null)} onRetry={onRefresh} />
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
    backgroundColor: '#E5EDE1',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#CDDDC7',
    padding: Spacing.md,
  },
  vaccineCtaScheduled: { backgroundColor: '#EAF0F2', borderColor: '#C5D6DC' },
  vaccineCtaOverdue: { backgroundColor: '#F4EBDD', borderColor: '#E1CBA8' },
  vaccineCtaIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCE8D7',
  },
  vaccineCtaIconScheduled: { backgroundColor: '#DCE5E8' },
  vaccineCtaIconOverdue: { backgroundColor: '#F0E1C8' },
  vaccineCtaTitle: { color: Colors.ink, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  vaccineCtaText: { color: Colors.muted, fontSize: FontSize.xs, marginTop: 2 },
  dashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  dashTitle: { flexShrink: 0 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  addPet: { width: 39, height: 39, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.accent },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.ink },
  sectionLink: { fontSize: 12, color: Colors.accent, paddingVertical: 10 },
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
    paddingTop: 8,
    gap: 22,
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
  startingGuide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  startingGuideIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startingGuideCopy: { flex: 1 },
  startingGuideTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  startingGuideText: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: 4,
    lineHeight: 20,
  },
  startingGuideAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
    minHeight: 34,
  },
  startingGuideActionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
  },
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
    backgroundColor: '#F4EBDD',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E1CBA8',
  },
  preventiveBannerTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  preventiveBannerDesc: { fontSize: FontSize.xs, lineHeight: 17, color: Colors.muted, marginTop: 2 },
});
