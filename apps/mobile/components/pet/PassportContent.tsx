import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { buildVaccineOverview, formatDate } from '@vivra/shared';
import { usePetContext } from '../../contexts/PetContext';
import { Colors } from '../../constants/theme';
import { Card } from '../ui/Card';
import { PassportCard } from './PassportCard';
import { DataLoadNotice } from '../shared/DataLoadNotice';

export function PassportContent() {
  const router = useRouter();
  const { pet, vaccines, weightRecords, error, refresh, loading } = usePetContext();
  const overview = buildVaccineOverview(vaccines);
  if (!pet) return <View style={styles.empty}><Text style={styles.title}>{loading ? 'Cargando pasaporte…' : 'Su próxima aventura empieza aquí'}</Text><Text style={styles.hint}>Agrega una mascota para tener su información a mano.</Text><DataLoadNotice message={error} onRetry={refresh} /></View>;
  const exportPdf = () => {
    Linking.openURL(`https://vivrapet.com/print?petId=${encodeURIComponent(pet.id)}`)
      .catch(() => Alert.alert('No se pudo abrir el pasaporte', 'Inténtalo de nuevo en unos momentos.'));
  };
  return (
    <View style={styles.content}>
      <PassportCard pet={pet} />
      <DataLoadNotice message={error} onRetry={refresh} />
      <Card>
        <Text style={styles.title}>Prepara su próximo viaje</Text>
        <View style={styles.status}>
          <View style={styles.statusIcon}><Ionicons name="document-text-outline" size={24} color={Colors.accent} /></View>
          <View style={styles.copy}><Text style={styles.statusTitle}>Su información, contigo</Text><Text style={styles.hint}>Revisa los documentos y requisitos de cada destino antes de viajar.</Text></View>
        </View>
        <PassportRow icon="airplane-outline" title="Viajes y requisitos" subtitle="Destinos, vuelos y lista de documentos" onPress={() => router.navigate('/(app)/viajes/vuelos')} />
        <PassportRow icon="shield-checkmark-outline" title="Registro de vacunas" subtitle={error ? 'No disponible · vuelve a cargar' : `${vaccines.length} dosis registradas${overview.overdueCount ? ` · ${overview.overdueCount} fechas por revisar` : ''}`} onPress={() => router.navigate('/(app)/salud/vacunas')} />
        <PassportRow icon="map-outline" title="Exportar pasaporte" subtitle="PDF · compartir o imprimir" onPress={exportPdf} />
      </Card>
      <Card>
        <View style={styles.sectionHead}><Text style={styles.title}>Datos de identificación</Text><TouchableOpacity accessibilityRole="button" onPress={() => router.navigate('/(app)/perfil?view=pet')}><Text style={styles.link}>Editar ›</Text></TouchableOpacity></View>
        <Info label="Sexo" value={pet.gender === 'hembra' ? 'Hembra' : pet.gender === 'macho' ? 'Macho' : null} />
        <Info label="Peso actual" value={(weightRecords[0]?.weight_kg ?? pet.weight_kg) ? `${weightRecords[0]?.weight_kg ?? pet.weight_kg} kg` : null} />
        <Info label="Pelaje" value={pet.color} />
        <Info label="Lugar de nacimiento" value={[pet.birth_city, pet.birth_country].filter(Boolean).join(', ')} />
        {pet.support_type && <Info label="Asistencia" value={pet.support_type === 'emotional_support' ? 'Apoyo emocional' : 'Perro de servicio'} />}
      </Card>
      {vaccines.length > 0 && <Card><Text style={styles.title}>Historial de vacunación</Text>{vaccines.map(vaccine => <View key={vaccine.id} style={styles.record}><Text style={styles.recordName}>{vaccine.name}</Text><Text style={styles.hint}>{formatDate(vaccine.date_given)}{vaccine.next_due ? ` · Próxima: ${formatDate(vaccine.next_due)}` : ''}</Text>{(vaccine.brand || vaccine.lot_number) && <Text style={styles.hint}>{[vaccine.brand, vaccine.lot_number ? `Lote ${vaccine.lot_number}` : null].filter(Boolean).join(' · ')}</Text>}</View>)}</Card>}
      <Text style={styles.legal}>Resumen personal de Vivra; no sustituye los documentos oficiales de viaje o sanitarios.</Text>
    </View>
  );
}

export function PassportRow({ icon, title, subtitle, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} onPress={onPress} activeOpacity={0.7} style={styles.row}><Ionicons name={icon} size={25} color={Colors.ink} /><View style={styles.copy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.hint}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={17} color={Colors.muted} /></TouchableOpacity>;
}
function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <View style={styles.info}><Text style={styles.hint}>{label}</Text><Text style={styles.infoValue}>{value || 'Sin registrar'}</Text></View>;
}
const styles = StyleSheet.create({
  content: { gap: 18 },
  empty: { padding: 24, gap: 12 },
  title: { fontSize: 17, fontWeight: '600', color: Colors.ink },
  status: { flexDirection: 'row', gap: 14, paddingVertical: 20, alignItems: 'center' },
  statusIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.sage, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { fontSize: 17, fontWeight: '600', color: Colors.ink, marginBottom: 4 },
  copy: { flex: 1 },
  hint: { fontSize: 12, color: Colors.muted, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 15, alignItems: 'center', paddingVertical: 17, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  rowTitle: { fontSize: 14, fontWeight: '500', color: Colors.ink, marginBottom: 3 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  link: { fontSize: 12, color: Colors.accent, padding: 8 },
  info: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 12, color: Colors.ink },
  record: { paddingTop: 14, gap: 3 },
  recordName: { fontSize: 14, color: Colors.ink, fontWeight: '500' },
  legal: { fontSize: 11, lineHeight: 17, color: Colors.muted, textAlign: 'center', paddingHorizontal: 12 },
});
