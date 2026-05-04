import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { usePetContext } from '../../../contexts/PetContext';
import { useSubscription } from '../../../hooks/useSubscription';
import { evaluateBadges } from '@vivra/shared';

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
    if (!isPremium) {
      router.push('/paywall' as any);
      return;
    }
    Linking.openURL(`https://vivrapet.com/print?petId=${petData.pet.id}`).catch(() => {});
  }, [petData.pet?.id, isPremium, router]);

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

        {/* Viajes */}
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(app)/actividad/vuelos' as any)}>
          <View style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: '#3B82F618' }]}>
              <Ionicons name="airplane" size={24} color="#3B82F6" />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Viajes</Text>
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

        {/* Pasaporte */}
        <TouchableOpacity activeOpacity={0.7} onPress={openPasaporte}>
          <View style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: Colors.accent + '18' }]}>
              <Ionicons name="document-text" size={24} color={Colors.accent} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Pasaporte</Text>
              <Text style={styles.cardSub}>
                {isPremium ? `Exporta el historial médico de ${petName}` : 'Disponible con Premium'}
              </Text>
            </View>
            <Ionicons name={isPremium ? 'chevron-forward' : 'lock-closed'} size={20} color={Colors.muted} />
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
