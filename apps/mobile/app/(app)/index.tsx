import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { usePetContext } from '../../contexts/PetContext';
import { useVitality } from '../../hooks/useVitality';
import { useSubscription } from '../../hooks/useSubscription';
import { PetHeroCard } from '../../components/pet/PetHeroCard';
import { VitalityWidget } from '../../components/pet/VitalityWidget';
import { FoodSummaryCard } from '../../components/pet/FoodSummaryCard';
import { ReminderCard } from '../../components/pet/ReminderCard';
import { CareCard } from '../../components/pet/CareCard';
import { PetSelector } from '../../components/pet/PetSelector';
import { DashboardSkeleton } from '../../components/shared/SkeletonLoader';
import { Card } from '../../components/ui/Card';

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

  // Fetch unread notification count + trial status
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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView style={styles.scroll}>
          <DashboardSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // No pet registered
  if (!petData.pet) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
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

  // Preventive critical banner — show if overdue OR never registered
  const preventiveStatus = (() => {
    const compute = (dateStr: string | null | undefined) => {
      if (!dateStr) return { status: 'never' as const, days: 0 };
      const next = new Date(dateStr);
      next.setDate(next.getDate() + 30);
      const days = Math.ceil((next.getTime() - Date.now()) / 86400000);
      if (days < 0) return { status: 'overdue' as const, days: Math.abs(days) };
      return { status: 'ok' as const, days };
    };
    const anti = compute(petData.lastAntipulgas?.date_given);
    const des = compute(petData.lastDesparasitante?.date_given);
    const neverTypes: string[] = [];
    const overdueTypes: { label: string; days: number }[] = [];
    if (anti.status === 'never') neverTypes.push('antipulgas');
    else if (anti.status === 'overdue') overdueTypes.push({ label: 'antipulgas', days: anti.days });
    if (des.status === 'never') neverTypes.push('desparasitante');
    else if (des.status === 'overdue') overdueTypes.push({ label: 'desparasitante', days: des.days });
    return { neverTypes, overdueTypes };
  })();
  const showPreventiveBanner = preventiveStatus.neverTypes.length > 0 || preventiveStatus.overdueTypes.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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

        {/* Preventivo critical banner — overdue or never registered */}
        {showPreventiveBanner && (
          <TouchableOpacity
            style={styles.preventiveBanner}
            onPress={() => router.navigate('/(app)/salud/preventivos' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle" size={22} color={Colors.bad} />
            <View style={{ flex: 1 }}>
              <Text style={styles.preventiveBannerTitle}>
                {preventiveStatus.neverTypes.length === 2
                  ? `${petData.pet.name} no tiene protección preventiva`
                  : preventiveStatus.overdueTypes.length === 2
                    ? 'Preventivos vencidos'
                    : preventiveStatus.neverTypes.length > 0
                      ? `Falta ${preventiveStatus.neverTypes[0]}`
                      : `${preventiveStatus.overdueTypes[0].label} vencido ${preventiveStatus.overdueTypes[0].days}d`}
              </Text>
              <Text style={styles.preventiveBannerDesc}>
                {preventiveStatus.neverTypes.length > 0 && preventiveStatus.overdueTypes.length === 0
                  ? 'Registra la última dosis para activar recordatorios'
                  : 'Aplica y registra la nueva dosis'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.bad} />
          </TouchableOpacity>
        )}

        {/* Vitality Score */}
        {vitality && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.navigate('/(app)/salud' as any)}>
            <VitalityWidget vitality={vitality} compact />
          </TouchableOpacity>
        )}

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
              productName={petData.lastAntipulgas?.product_name}
              onPress={() => router.navigate('/(app)/salud/preventivos' as any)}
            />
          </View>
          <View style={styles.careCol}>
            <ReminderCard
              type="desparasitante"
              lastDate={petData.lastDesparasitante?.date_given ?? null}
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
                || petData.groomings[0]?.type
                || null
              }
              lastDate={petData.groomings[0]?.date ?? null}
              emptyText="Sin baños registrados"
              onPress={() => router.navigate('/(app)/actividad/grooming' as any)}
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
    borderColor: Colors.accent + '30',
    padding: Spacing.md,
  },
  foodCtaText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.ink,
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
    borderColor: Colors.accent + '20',
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
    borderColor: Colors.accent + '30',
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
    backgroundColor: Colors.bad + '12',
    borderColor: Colors.bad,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.bad,
  },
});
