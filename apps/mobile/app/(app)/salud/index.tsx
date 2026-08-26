import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { usePetContext } from '../../../contexts/PetContext';
import { useVitality } from '../../../hooks/useVitality';
import { VitalityWidget } from '../../../components/pet/VitalityWidget';
import { Card } from '../../../components/ui/Card';

interface NavCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  badge?: string;
}

function NavCard({ icon, iconColor, title, subtitle, onPress, badge }: NavCardProps) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card>
        <View style={styles.navRow}>
          <View style={[styles.navIconCircle, { backgroundColor: iconColor + '15' }]}>
            <Ionicons name={icon} size={22} color={iconColor} />
          </View>
          <View style={styles.navInfo}>
            <Text style={styles.navTitle}>{title}</Text>
            <Text style={styles.navSub}>{subtitle}</Text>
          </View>
          {badge && (
            <View style={styles.navBadge}>
              <Text style={styles.navBadgeText}>{badge}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={Colors.muted} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default function SaludScreen() {
  const router = useRouter();
  const petData = usePetContext();
  const vitality = useVitality(petData);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await petData.refresh();
    setRefreshing(false);
  }, [petData.refresh]);

  const latestWeight = petData.weightRecords[0];
  const vaccineCount = petData.vaccines.length;
  const visitCount = petData.vetVisits.length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Salud</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >

        {vitality && (
          <VitalityWidget
            vitality={vitality}
            onNavigate={(route) => router.push(route as any)}
          />
        )}

        {/* Active score suggestions — the engine's flags, rendered as
            actionable cards. Each one says what's off and links to the
            screen where the user can fix it. */}
        {vitality && vitality.flags.length > 0 && (
          <View style={styles.flagsWrap}>
            {vitality.flags.slice(0, 3).map(flag => {
              const flagColor =
                flag.severity === 'suggestion' ? Colors.accent
                : flag.severity === 'reminder' ? '#3B82F6'
                : Colors.warn;
              // Engine hrefs are web routes; map to the mobile equivalents.
              const mobileRoute =
                flag.href.includes('peso') ? '/(app)/salud/peso'
                : flag.href.includes('preventivos') ? '/(app)/salud/preventivos'
                : flag.href.includes('vacunas') ? '/(app)/salud/vacunas'
                : flag.href.includes('alimentacion') ? '/(app)/alimentacion'
                : flag.href.includes('perfil') ? '/(app)/perfil'
                : '/(app)/salud';
              return (
                <TouchableOpacity
                  key={flag.id}
                  style={[styles.flagCard, { borderLeftColor: flagColor }]}
                  onPress={() => router.push(mobileRoute as any)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={flag.message}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flagMessage}>{flag.message}</Text>
                    <Text style={[styles.flagAction, { color: flagColor }]}>{flag.action} →</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {latestWeight ? `${latestWeight.weight_kg} kg` : '—'}
            </Text>
            <Text style={styles.statLabel}>Último peso</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{vaccineCount}</Text>
            <Text style={styles.statLabel}>Vacunas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{visitCount}</Text>
            <Text style={styles.statLabel}>Visitas vet</Text>
          </View>
        </View>

        {/* Navigation cards — ordered by frequency of use */}
        <NavCard
          icon="shield-checkmark"
          iconColor={Colors.warn}
          title="Preventivos"
          subtitle="Antipulgas y desparasitante"
          onPress={() => router.push('/(app)/salud/preventivos')}
        />
        <NavCard
          icon="scale"
          iconColor={Colors.accent}
          title="Peso"
          subtitle="Historial y gráfica de peso"
          onPress={() => router.push('/(app)/salud/peso')}
          badge={latestWeight ? `${latestWeight.weight_kg} kg` : undefined}
        />
        <NavCard
          icon="medical"
          iconColor="#E879F9"
          title="Historial veterinario"
          subtitle="Visitas, diagnósticos y costos"
          onPress={() => router.push('/(app)/salud/historial')}
          badge={visitCount > 0 ? `${visitCount}` : undefined}
        />
        <NavCard
          icon="medkit"
          iconColor={Colors.good}
          title="Vacunas"
          subtitle="Historial de dosis y próximas fechas"
          onPress={() => router.push('/(app)/salud/vacunas')}
          badge={vaccineCount > 0 ? `${vaccineCount}` : undefined}
        />
        <NavCard
          icon="cut"
          iconColor="#8B5CF6"
          title="Grooming"
          subtitle="Baños y cortes"
          onPress={() => router.push('/(app)/actividad/grooming' as any)}
          badge={petData.groomings.length > 0 ? `${petData.groomings.length}` : undefined}
        />
        <NavCard
          icon="document-text"
          iconColor="#3B82F6"
          title="Pasaporte"
          subtitle="Identidad, vacunas y viajes"
          onPress={() => router.push('/(app)/actividad/pasaporte' as any)}
        />

        {/* Disclaimer: the score is informational, not diagnostic */}
        <Text style={styles.disclaimer}>
          El Vitality Score es orientativo, no un diagnóstico médico.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  navIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navInfo: {
    flex: 1,
  },
  navTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  navSub: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 1,
  },
  navBadge: {
    backgroundColor: Colors.accentLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  navBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
  },
  flagsWrap: { gap: Spacing.xs },
  flagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 3,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  flagMessage: {
    fontSize: FontSize.xs,
    color: Colors.ink,
    lineHeight: 17,
  },
  flagAction: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
  disclaimer: {
    fontSize: 11,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 15,
  },
});
