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
import { FoodProgressBar } from '../../components/pet/FoodProgressBar';
import { ReminderCard } from '../../components/pet/ReminderCard';
import { FunFact } from '../../components/pet/FunFact';
import { PetSelector } from '../../components/pet/PetSelector';
import { DashboardSkeleton } from '../../components/shared/SkeletonLoader';
import { Card } from '../../components/ui/Card';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const petData = usePetContext();
  const vitality = useVitality(petData);
  const { isPremium } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
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

  // Active food for progress bar
  const activeFood = petData.foods.find(f => f.daily_grams && f.bag_size);

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

        {/* Vitality Score */}
        {vitality && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.navigate('/(app)/salud' as any)}>
            <VitalityWidget vitality={vitality} compact />
          </TouchableOpacity>
        )}

        {/* Food progress */}
        {activeFood && activeFood.daily_grams && activeFood.bag_size ? (
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.navigate('/(app)/alimentacion' as any)}>
            <FoodProgressBar
              brand={activeFood.brand ?? 'Alimento'}
              dailyGrams={activeFood.daily_grams}
              bagSize={activeFood.bag_size}
              bagUnit={activeFood.bag_unit ?? 'g'}
              startDate={activeFood.start_date ?? activeFood.created_at}
            />
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

        {/* Preventive reminders */}
        <View style={styles.reminderRow}>
          <View style={styles.reminderCol}>
            <ReminderCard
              type="antipulgas"
              lastDate={petData.lastAntipulgas?.date_given ?? null}
              productName={petData.lastAntipulgas?.product_name}
              onPress={() => router.navigate('/(app)/salud/preventivos' as any)}
            />
          </View>
          <View style={styles.reminderCol}>
            <ReminderCard
              type="desparasitante"
              lastDate={petData.lastDesparasitante?.date_given ?? null}
              productName={petData.lastDesparasitante?.product_name}
              onPress={() => router.navigate('/(app)/salud/preventivos' as any)}
            />
          </View>
        </View>

        {/* Fun fact */}
        <FunFact breed={petData.pet.breed} />

        {/* Premium upsell */}
        {!isPremium && (
          <TouchableOpacity
            style={styles.premiumBanner}
            onPress={() => router.push('/paywall' as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="star" size={18} color={Colors.accent} />
            <View style={styles.premiumBannerInfo}>
              <Text style={styles.premiumBannerTitle}>Desbloquea estadísticas avanzadas</Text>
              <Text style={styles.premiumBannerDesc}>Gráficos, tendencias, exportar PDF y más</Text>
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
  reminderRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  reminderCol: {
    flex: 1,
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
  errorCard: {
    backgroundColor: Colors.bad + '12',
    borderColor: Colors.bad,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.bad,
  },
});
