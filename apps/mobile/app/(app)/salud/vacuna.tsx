import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDate, vaccineScheduleStatus } from '@vivra/shared';
import { useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRemoteData } from '../../../hooks/useRemoteData';
import { usePetContext } from '../../../contexts/PetContext';
import { Colors } from '../../../constants/theme';
import { Button } from '../../../components/ui/Button';
import { CategoryIcon } from '../../../components/ui/CategoryIcon';
import { DataLoadNotice } from '../../../components/shared/DataLoadNotice';

export default function VaccineDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pet } = usePetContext();
  const loadVaccine = useCallback(async (signal: AbortSignal) => {
    const { data, error } = await supabase.from('vaccines').select('*').eq('pet_id', pet!.id).eq('id', id).abortSignal(signal).maybeSingle();
    if (error) throw error;
    return data;
  }, [pet?.id, id]);
  const { data: vaccine, loading, error, refresh } = useRemoteData(pet?.id && id ? `vaccine:${pet.id}:${id}` : null, loadVaccine);
  const back = () => router.canGoBack() ? router.back() : router.replace('/(app)/salud/vacunas');
  const status = vaccine ? vaccineScheduleStatus(vaccine) : null;
  const needsReview = status === 'overdue' || status === 'due_soon';
  const edit = () => router.replace({ pathname: '/(app)/salud/vacunas', params: { edit: id } });
  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="screen-vaccine-detail">
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver a Vacunas" style={styles.headerButton} onPress={back}><Ionicons name="arrow-back" size={25} color={Colors.ink} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Vacunas</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Editar aplicación" style={styles.headerButton} onPress={edit} disabled={!vaccine}><Ionicons name="create-outline" size={23} color={Colors.ink} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DataLoadNotice message={error ? 'No pudimos cargar esta aplicación. Inténtalo de nuevo.' : null} onRetry={refresh} />
        {!vaccine ? <Text style={styles.description}>{error ? '' : loading ? 'Cargando aplicación…' : 'No encontramos esta aplicación para la mascota seleccionada.'}</Text> : <>
          <View style={styles.icon}><CategoryIcon name="vaccine" color={Colors.good} size={54} /></View>
          <Text style={styles.title}>{vaccine.name}</Text>
          <Text style={styles.description}>{pet?.name} · Registro de vacunación</Text>
          <Text style={styles.description}>La información de esta dosis, sus fechas y las observaciones de su veterinario, en un solo lugar.</Text>
          <View style={[styles.status, needsReview && { backgroundColor: Colors.sand }]}>
            <Ionicons name={needsReview ? 'calendar-outline' : 'checkmark-circle'} size={35} color={needsReview ? Colors.gold : Colors.good} />
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>{status === 'overdue' ? 'Fecha por confirmar' : status === 'due_soon' ? 'Próxima dosis cercana' : 'Dosis registrada'}</Text>
              <Text style={styles.statusText}>Aplicada el {formatDate(vaccine.date_given)}</Text>
              <Text style={styles.statusText}>{vaccine.next_due ? `Próxima: ${formatDate(vaccine.next_due)}` : 'Sin próxima fecha registrada'}</Text>
            </View>
          </View>
          <DetailRow icon="calendar-outline" label="Próxima dosis" value={vaccine.next_due ? formatDate(vaccine.next_due) : 'Sin fecha'} />
          <DetailRow icon="medical-outline" label="Veterinario" value={vaccine.vet_name || 'Sin registrar'} />
          <DetailRow icon="document-text-outline" label="Marca" value={vaccine.brand || 'Sin registrar'} />
          <DetailRow icon="barcode-outline" label="Lote" value={vaccine.lot_number || 'Sin registrar'} />
          <View style={styles.notes}><Ionicons name="reader-outline" size={23} color={Colors.ink} /><View style={styles.statusCopy}><Text style={styles.rowLabel}>Notas</Text><Text style={styles.description}>{vaccine.notes || 'Todavía no hay notas'}</Text></View></View>
          {needsReview && <Text style={styles.note}>Confirma la próxima aplicación con tu veterinario.</Text>}
        </>}
      </ScrollView>
      {vaccine && <View style={styles.footer}><Button title="Agregar nuevo registro" onPress={() => router.replace({ pathname: '/(app)/salud/vacunas', params: { add: '1' } })} /></View>}
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return <View style={styles.row}><Ionicons name={icon} size={23} color={Colors.ink} /><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: Colors.ink },
  content: { paddingHorizontal: 26, paddingBottom: 24 },
  icon: { marginTop: 26, marginBottom: 22 },
  title: { fontSize: 29, lineHeight: 35, fontWeight: '600', letterSpacing: -0.6, color: Colors.ink },
  description: { fontSize: 15, lineHeight: 23, color: Colors.muted, marginTop: 10 },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: 17, backgroundColor: Colors.accentLight, borderRadius: 18, padding: 20, marginTop: 26, marginBottom: 16 },
  statusCopy: { flex: 1 },
  statusTitle: { fontSize: 17, fontWeight: '600', color: Colors.accentDark, marginBottom: 5 },
  statusText: { fontSize: 13, lineHeight: 21, color: Colors.accentDark },
  row: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  rowLabel: { fontSize: 14, color: Colors.ink, flex: 1 },
  rowValue: { fontSize: 13, color: Colors.muted, flex: 1, textAlign: 'right' },
  notes: { flexDirection: 'row', gap: 15, paddingVertical: 20 },
  note: { fontSize: 12, lineHeight: 18, color: Colors.muted },
  footer: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: Colors.canvas },
});
