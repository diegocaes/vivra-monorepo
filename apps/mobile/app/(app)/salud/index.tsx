import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { buildVaccineOverview, daysUntilDate, formatDate, localDateKey } from '@vivra/shared';
import { Colors } from '../../../constants/theme';
import { usePetContext } from '../../../contexts/PetContext';
import { useVitality } from '../../../hooks/useVitality';
import { VitalityWidget } from '../../../components/pet/VitalityWidget';
import { HealthPetIdentity } from '../../../components/health/HealthPetIdentity';
import { BrandLogo } from '../../../components/ui/BrandLogo';
import { CategoryIcon } from '../../../components/ui/CategoryIcon';
import { Card } from '../../../components/ui/Card';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { Button } from '../../../components/ui/Button';
import { DataLoadNotice } from '../../../components/shared/DataLoadNotice';

interface HealthRowProps {
  icon: React.ComponentProps<typeof CategoryIcon>['name'];
  color: string;
  background: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  testID: string;
  last?: boolean;
}

function HealthRow({ icon, color, background, title, subtitle, onPress, testID, last }: HealthRowProps) {
  return (
    <TouchableOpacity testID={testID} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} activeOpacity={0.7} onPress={onPress} style={[styles.navRow, !last && styles.rowBorder]}>
      <View style={[styles.navIcon, { backgroundColor: background }]}><CategoryIcon name={icon} size={25} color={color} /></View>
      <View style={styles.navCopy}><Text style={styles.navTitle}>{title}</Text><Text style={styles.navSub}>{subtitle}</Text></View>
      <Ionicons name="chevron-forward" size={17} color={Colors.muted} />
    </TouchableOpacity>
  );
}

function mobileFlagRoute(href: string): Href {
  if (href.includes('historial')) return '/(app)/salud/historial';
  if (href.includes('grooming')) return '/grooming?from=cuidado';
  if (href.includes('peso')) return '/(app)/salud/peso';
  if (href.includes('preventivos')) return '/(app)/salud/preventivos';
  if (href.includes('vacunas')) return '/(app)/salud/vacunas';
  if (href.includes('alimentacion')) return '/(app)/cuidado/alimentacion';
  if (href.includes('perfil')) return '/(app)/perfil?view=pet';
  return '/(app)/salud';
}

export default function SaludScreen() {
  const router = useRouter();
  const petData = usePetContext();
  const vitality = useVitality(petData);
  const [refreshing, setRefreshing] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const { pet, loading, error } = petData;
  const ready = !!pet && !loading && !error;
  const today = localDateKey();
  const overview = buildVaccineOverview(ready ? petData.vaccines : []);
  const lastVisit = ready ? petData.vetVisits.find(visit => visit.date <= today) : null;
  const visitsThisYear = ready ? petData.vetVisits.filter(visit => visit.date.slice(0, 4) === today.slice(0, 4) && visit.date <= today).length : 0;
  const latestWeight = petData.weightRecords[0]?.weight_kg ?? pet?.weight_kg;
  const nextVaccine = overview.schedule[0];
  const vaccineSubtitle = !ready ? 'Cargando registros…'
    : overview.history.length === 0 ? 'Agrega su primera aplicación'
    : overview.overdueCount > 0 ? `${overview.overdueCount} fecha${overview.overdueCount === 1 ? '' : 's'} por revisar`
    : nextVaccine?.next_due ? `Próxima: ${formatDate(nextVaccine.next_due)}`
    : `${overview.history.length} dosis registradas · sin próxima fecha`;
  const preventiveDates = ready ? [petData.lastAntipulgas?.next_due, petData.lastDesparasitante?.next_due].filter((date): date is string => !!date).sort() : [];
  const overduePreventive = preventiveDates.some(date => daysUntilDate(date) < 0);
  const preventiveSubtitle = !ready ? 'Cargando registros…'
    : !petData.preventives.length ? 'Antipulgas y desparasitación'
    : overduePreventive ? 'Hay fechas pendientes de revisar'
    : preventiveDates[0] ? `Próxima: ${formatDate(preventiveDates[0])}` : 'Aplicaciones sin próxima fecha';
  const unavailable = error ? 'No disponible · vuelve a cargar' : 'Cargando registros…';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await petData.refresh(); } finally { setRefreshing(false); }
  }, [petData.refresh]);
  const addRecord = (route: Href) => { setShowAdd(false); router.push(route); };

  return (
    <SafeAreaView testID="screen-health" style={styles.safe} edges={['top']}>
      <View style={styles.brandHeader}><BrandLogo width={124} /><TouchableOpacity testID="health-add" accessibilityRole="button" accessibilityLabel="Agregar registro de salud" onPress={() => setShowAdd(true)} disabled={!pet} style={[styles.add, !pet && { opacity: 0.4 }]}><Ionicons name="add" size={25} color={Colors.white} /></TouchableOpacity></View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}>
        <View style={styles.heading}><Text style={styles.title}>Salud</Text><Text style={styles.subtitle}>Todo el historial médico{pet ? ` de ${pet.name}` : ' de tu mascota'}, en un solo lugar.</Text></View>
        <DataLoadNotice message={error} onRetry={petData.refresh} />
        {!pet ? <Card><Text style={styles.emptyTitle}>{loading ? 'Cargando su información…' : error ? 'No pudimos cargar su perfil' : 'Su salud empieza con su perfil'}</Text>{!loading && !error && <><Text style={styles.emptyCopy}>Agrega una mascota para organizar sus vacunas y cuidados.</Text><Button title="Agregar mascota" onPress={() => router.push('/onboarding')} /></>}</Card> : <>
          <View style={styles.identityCard}>
            <HealthPetIdentity size="regular" />
            <View style={styles.metrics}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={ready && vitality?.showScore ? `Bienestar ${vitality.total} de 100, ${vitality.headline}. Ver detalles` : 'Ver detalles de bienestar'} accessibilityState={{ expanded: showScore }} onPress={() => setShowScore(!showScore)} style={[styles.metric, styles.sage]} disabled={!ready}>
                <View style={styles.metricValueRow}><Ionicons name="heart-outline" size={18} color={Colors.accent} /><Text style={styles.metricValue}>{ready && vitality?.showScore ? vitality.total : '—'}</Text></View><Text style={styles.metricLabel}>{ready && vitality?.showScore ? vitality.headline : 'Bienestar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={ready && latestWeight ? `Último peso ${latestWeight} kilogramos. Ver registros` : 'Ver registros de peso'} onPress={() => router.push('/(app)/salud/peso')} style={[styles.metric, styles.sage]}><View style={styles.metricValueRow}><Ionicons name="scale-outline" size={18} color={Colors.accent} /><Text style={styles.metricValue}>{ready && latestWeight ? `${latestWeight} kg` : '—'}</Text></View><Text style={styles.metricLabel}>Último peso</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Microchip ${pet.chip_id ? 'registrado' : 'sin registrar'}. Ver perfil`} onPress={() => router.navigate('/(app)/perfil?view=pet')} style={[styles.metric, styles.sand]}><View style={styles.metricValueRow}><Ionicons name="document-text-outline" size={17} color={Colors.gold} /><Text style={[styles.metricValue, styles.chipLabel]}>Microchip</Text></View><Text style={[styles.metricLabel, { color: Colors.gold }]}>{pet.chip_id ? 'Registrado' : 'Sin registrar'}</Text></TouchableOpacity>
            </View>
          </View>
          <View style={styles.navigation}>
            <HealthRow testID="health-vaccines" icon="vaccine" color={Colors.good} background="#EAF3E8" title="Vacunas" subtitle={error ? unavailable : vaccineSubtitle} onPress={() => router.push('/(app)/salud/vacunas')} />
            <HealthRow testID="health-history" icon="vet" color={Colors.blue} background="#E8F0F4" title="Visitas veterinarias" subtitle={!ready ? unavailable : lastVisit ? `${visitsThisYear} este año · última: ${formatDate(lastVisit.date)}` : 'Consultas, diagnósticos y tratamientos'} onPress={() => router.push('/(app)/salud/historial')} />
            <HealthRow testID="health-preventives" icon="pill" color={Colors.gold} background="#FAF0DF" title="Preventivos" subtitle={error ? unavailable : preventiveSubtitle} onPress={() => router.push('/(app)/salud/preventivos')} />
            <HealthRow testID="health-weight" icon="scale-outline" color={Colors.good} background="#EAF3E8" title="Peso" subtitle={!ready ? unavailable : petData.weightRecords[0] ? `Último registro: ${formatDate(petData.weightRecords[0].date)}` : 'Acompaña su evolución'} onPress={() => router.push('/(app)/salud/peso')} last />
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showScore }} accessibilityLabel="Detalles del bienestar" onPress={() => setShowScore(!showScore)} style={styles.detailsToggle}><Text style={styles.detailsText}>Detalles del bienestar</Text><Ionicons name={showScore ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.accent} /></TouchableOpacity>
          {ready && showScore && vitality && <><VitalityWidget vitality={vitality} onNavigate={route => router.push(mobileFlagRoute(route))} />{vitality.flags.slice(0, 3).map(flag => <TouchableOpacity key={flag.id} accessibilityRole="button" accessibilityLabel={flag.message} style={styles.flag} onPress={() => router.push(mobileFlagRoute(flag.href))}><Text style={styles.flagMessage}>{flag.message}</Text><Text style={styles.flagAction}>{flag.action} →</Text></TouchableOpacity>)}</>}
          <Text style={styles.disclaimer}>El indicador de bienestar es orientativo; no es un diagnóstico médico.</Text>
        </>}
      </ScrollView>
      <BottomSheet visible={showAdd} onClose={() => setShowAdd(false)} title="Agregar registro">
        <View style={styles.addOptions}>
          <HealthRow testID="health-add-vaccine" icon="vaccine" color={Colors.good} background="#EAF3E8" title="Vacuna" subtitle="Una nueva aplicación en su carné" onPress={() => addRecord('/(app)/salud/vacunas?add=1')} />
          <HealthRow testID="health-add-visit" icon="vet" color={Colors.blue} background="#E8F0F4" title="Visita veterinaria" subtitle="Consulta, diagnóstico y tratamiento" onPress={() => addRecord('/(app)/salud/historial?add=1')} />
          <HealthRow testID="health-add-preventive" icon="pill" color={Colors.gold} background="#FAF0DF" title="Preventivo" subtitle="Antipulgas, desparasitación o combinado" onPress={() => addRecord('/(app)/salud/preventivos?add=1')} last />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  brandHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 6 },
  add: { width: 39, height: 39, borderRadius: 20, backgroundColor: Colors.accent, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingTop: 13, gap: 18, paddingBottom: 35 },
  heading: { paddingHorizontal: 4, gap: 5 },
  title: { fontSize: 31, fontWeight: '600', color: Colors.ink, letterSpacing: -0.8 },
  subtitle: { fontSize: 15, color: Colors.muted, lineHeight: 21 },
  identityCard: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 19, padding: 12, gap: 11, shadowColor: Colors.ink, shadowOpacity: 0.025, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, paddingHorizontal: 4, paddingVertical: 12, borderRadius: 11, justifyContent: 'center', alignItems: 'center', gap: 5 },
  sage: { backgroundColor: '#EDF3E9' }, sand: { backgroundColor: '#FAF0E1' },
  metricValueRow: { flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 13, fontWeight: '600', color: Colors.accent },
  metricLabel: { fontSize: 10, lineHeight: 14, textAlign: 'center', color: Colors.accent },
  chipLabel: { fontSize: 11, color: Colors.gold, fontWeight: '500' },
  navigation: { paddingHorizontal: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18 },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  navIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  navCopy: { flex: 1, gap: 4 },
  navTitle: { fontSize: 15, fontWeight: '500', color: Colors.ink },
  navSub: { fontSize: 11, lineHeight: 16, color: Colors.muted },
  detailsToggle: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5, paddingVertical: 9 },
  detailsText: { fontSize: 13, fontWeight: '500', color: Colors.accent },
  flag: { padding: 16, backgroundColor: Colors.accentLight, borderRadius: 14, gap: 7 },
  flagMessage: { fontSize: 13, lineHeight: 19, color: Colors.ink },
  flagAction: { fontSize: 12, color: Colors.accent, fontWeight: '600' },
  disclaimer: { fontSize: 11, lineHeight: 16, textAlign: 'center', color: Colors.muted, paddingHorizontal: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.ink },
  emptyCopy: { fontSize: 14, lineHeight: 20, color: Colors.muted, marginVertical: 16 },
  addOptions: { paddingBottom: 8 },
});
