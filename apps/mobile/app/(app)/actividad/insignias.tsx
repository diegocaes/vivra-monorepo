import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { usePetContext } from '../../../contexts/PetContext';
import { evaluateBadges, type EarnedBadge } from '@vivra/shared';

// Static require map for badge PNG images
const BADGE_IMAGES: Record<string, ImageSourcePropType> = {
  'perfil-completo':    require('../../../assets/badges/perfil-completo.png'),
  'primera-vacuna':     require('../../../assets/badges/primera-vacuna.png'),
  'vacunas-al-dia':     require('../../../assets/badges/vacunas-al-dia.png'),
  'veterinario':        require('../../../assets/badges/veterinario.png'),
  'preventivos-al-dia': require('../../../assets/badges/preventivos-al-dia.png'),
  'primer-peso':        require('../../../assets/badges/primer-peso.png'),
  'control-peso':       require('../../../assets/badges/control-peso.png'),
  'grooming':           require('../../../assets/badges/grooming.png'),
  'nutricion':          require('../../../assets/badges/nutricion.png'),
  'primer-vuelo':       require('../../../assets/badges/primer-vuelo.png'),
  'vac-rabia':          require('../../../assets/badges/vacunas/rabia.png'),
  'vac-parvo':          require('../../../assets/badges/vacunas/parvo.png'),
  'vac-moquillo':       require('../../../assets/badges/vacunas/moquillo.png'),
  'vac-bordetella':     require('../../../assets/badges/vacunas/bordetella.png'),
  'vac-lepto':          require('../../../assets/badges/vacunas/lepto.png'),
  'vac-hepatitis':      require('../../../assets/badges/vacunas/hepatitis.png'),
};

function BadgeCard({ id, name, description, earned }: {
  id: string;
  name: string;
  description: string;
  earned: boolean;
}) {
  const imgSource = BADGE_IMAGES[id];

  return (
    <View style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
      <View style={[
        styles.badgeIconWrap,
        { backgroundColor: earned ? Colors.accentLight : Colors.cardBorder + '60' },
      ]}>
        {earned && imgSource ? (
          <Image source={imgSource} style={styles.badgeImg} />
        ) : (
          <Ionicons name="lock-closed" size={28} color={Colors.cardBorder} />
        )}
      </View>
      <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.badgeDesc} numberOfLines={3}>{description}</Text>
    </View>
  );
}

export default function InsigniasScreen() {
  const router = useRouter();
  const petData = usePetContext();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await petData.refresh();
    setRefreshing(false);
  }, [petData.refresh]);

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

  const { engagement, vaccines, earnedCount, totalCount } = evaluateBadges(badgeCounts);

  const allBadges: { id: string; name: string; description: string; earned: boolean }[] = [
    ...engagement.map(b => ({ id: b.id, name: b.name, description: b.description, earned: b.earned })),
    ...vaccines.map(v => ({ id: v.id, name: v.name, description: `Vacuna de ${v.name} registrada`, earned: v.earned })),
  ];

  const petName = petData.pet?.name ?? 'tu mascota';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Insignias</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Progress header */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <Ionicons name="ribbon" size={24} color={Colors.warn} />
            <Text style={styles.progressText}>
              <Text style={styles.progressCount}>{earnedCount}</Text>
              {' '}de {totalCount} insignias ganadas
            </Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${Math.round((earnedCount / totalCount) * 100)}%` }]} />
          </View>
        </View>

        {/* CTA if 0 earned */}
        {earnedCount === 0 && (
          <TouchableOpacity style={styles.ctaCard} onPress={() => router.push('/(app)/perfil' as any)} activeOpacity={0.8}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.accent} />
            <Text style={styles.ctaText}>Completa el perfil de {petName} para ganar tu primera insignia</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
          </TouchableOpacity>
        )}


        {/* Badge grid */}
        <View style={styles.grid}>
          {allBadges.map(badge => (
            <BadgeCard
              key={badge.id}
              id={badge.id}
              name={badge.name}
              description={badge.description}
              earned={badge.earned}
            />
          ))}
        </View>
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
  // Progress
  progressCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, gap: Spacing.sm,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressText: { fontSize: FontSize.md, color: Colors.ink },
  progressCount: { fontWeight: FontWeight.bold },
  progressBg: {
    height: 6, backgroundColor: Colors.cardBorder,
    borderRadius: Radius.full, overflow: 'hidden',
  },
  progressFill: {
    height: 6, backgroundColor: Colors.warn,
    borderRadius: Radius.full,
  },
  // CTA
  ctaCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accentLight, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.accent + '30', padding: Spacing.md,
  },
  ctaText: { flex: 1, fontSize: FontSize.sm, color: Colors.ink },
  // Premium banner
  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badgeCard: {
    width: '47.5%', backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder,
    padding: Spacing.md, alignItems: 'center', gap: Spacing.xs,
  },
  badgeCardLocked: { opacity: 0.7 },
  badgeIconWrap: {
    width: 56, height: 56, borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeImg: {
    width: 48, height: 48, resizeMode: 'contain',
  },
  badgeName: {
    fontSize: FontSize.sm, fontWeight: FontWeight.semibold,
    color: Colors.ink, textAlign: 'center',
  },
  badgeNameLocked: { color: Colors.muted },
  badgeDesc: { fontSize: FontSize.xs, color: Colors.muted, textAlign: 'center' },
});
