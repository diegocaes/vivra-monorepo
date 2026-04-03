import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { formatDate } from '@vivra/shared';
import { usePetContext } from '../../../contexts/PetContext';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { FormField } from '../../../components/ui/FormField';
import type { VetVisit } from '../../../types/supabase';

export default function HistorialScreen() {
  const router = useRouter();
  const { pet } = usePetContext();
  const [visits, setVisits] = useState<VetVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [vetName, setVetName] = useState('');
  const [location, setLocation] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async () => {
    if (!pet?.id) return;

    const { data } = await supabase
      .from('vet_visits').select('*').eq('pet_id', pet.id).order('date', { ascending: false });
    setVisits((data as VetVisit[]) ?? []);
    setLoading(false);
  }, [pet?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setReason(''); setVetName(''); setLocation('');
    setDiagnosis(''); setTreatment(''); setCost(''); setNotes('');
  };

  const handleSave = async () => {
    if (!pet) return;
    if (!reason.trim()) { Alert.alert('Error', 'Ingresa el motivo de la visita'); return; }
    if (!date) { Alert.alert('Error', 'Ingresa la fecha'); return; }

    setSaving(true);
    const { error } = await supabase.from('vet_visits').insert({
      pet_id: pet.id,
      date,
      reason: reason.trim(),
      vet_name: vetName || null,
      location: location || null,
      diagnosis: diagnosis || null,
      treatment: treatment || null,
      cost: cost ? parseFloat(cost) : null,
      notes: notes || null,
    });
    setSaving(false);

    if (error) { Alert.alert('Error', error.message); return; }
    resetForm();
    setShowForm(false);
    fetchData();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar visita', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('vet_visits').delete().eq('id', id).eq('pet_id', pet!.id);
          fetchData();
        },
      },
    ]);
  };

  // Stats
  const totalCost = visits.reduce((sum, v) => sum + (v.cost ?? 0), 0);
  const lastVisit = visits[0];
  const daysSinceLast = lastVisit
    ? Math.floor((Date.now() - new Date(lastVisit.date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Historial veterinario</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{visits.length}</Text>
            <Text style={styles.statLabel}>Visitas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{daysSinceLast !== null ? `${daysSinceLast}d` : '—'}</Text>
            <Text style={styles.statLabel}>Desde última</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>${totalCost.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total gastado</Text>
          </View>
        </View>

        {visits.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Ionicons name="medical-outline" size={48} color={Colors.cardBorder} />
            <Text style={styles.emptyText}>No hay visitas registradas</Text>
          </View>
        ) : (
          visits.map(v => (
            <Card key={v.id}>
              <View style={styles.visitRow}>
                <View style={styles.visitInfo}>
                  <Text style={styles.visitReason}>{v.reason}</Text>
                  <Text style={styles.visitDate}>{formatDate(v.date)}</Text>
                  {v.vet_name && <Text style={styles.visitDetail}>Dr. {v.vet_name}</Text>}
                  {v.location && <Text style={styles.visitDetail}>{v.location}</Text>}
                  {v.diagnosis && (
                    <Text style={styles.visitDiagnosis}>Diagnóstico: {v.diagnosis}</Text>
                  )}
                  {v.treatment && (
                    <Text style={styles.visitDetail}>Tratamiento: {v.treatment}</Text>
                  )}
                  {v.notes && <Text style={styles.visitNotes}>{v.notes}</Text>}
                </View>
                <View style={styles.visitRight}>
                  {v.cost !== null && v.cost > 0 && (
                    <View style={styles.costBadge}>
                      <Text style={styles.costText}>${v.cost}</Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => handleDelete(v.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={20} color={Colors.muted} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <BottomSheet visible={showForm} onClose={() => setShowForm(false)} title="Agregar visita">
        <FormField label="Motivo" value={reason} onChangeText={setReason} placeholder="Ej: Revisión anual, Urgencia..." />
        <FormField label="Fecha" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <FormField label="Veterinario (opcional)" value={vetName} onChangeText={setVetName} placeholder="Nombre del veterinario" />
        <FormField label="Clínica / Ubicación (opcional)" value={location} onChangeText={setLocation} placeholder="Nombre de la clínica" />
        <FormField label="Diagnóstico (opcional)" value={diagnosis} onChangeText={setDiagnosis} placeholder="Diagnóstico..." multiline style={{ minHeight: 60 }} />
        <FormField label="Tratamiento (opcional)" value={treatment} onChangeText={setTreatment} placeholder="Medicamentos, instrucciones..." multiline style={{ minHeight: 60 }} />
        <FormField label="Costo (opcional)" value={cost} onChangeText={setCost} placeholder="0.00" keyboardType="decimal-pad" />
        <FormField label="Notas (opcional)" value={notes} onChangeText={setNotes} placeholder="Observaciones..." multiline style={{ minHeight: 60 }} />
        <Button title="Guardar" onPress={handleSave} loading={saving} />
      </BottomSheet>
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
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, alignItems: 'center',
  },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },
  statLabel: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  visitRow: { flexDirection: 'row', gap: Spacing.sm },
  visitInfo: { flex: 1 },
  visitRight: { alignItems: 'flex-end', gap: Spacing.sm },
  visitReason: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  visitDate: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  visitDetail: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  visitDiagnosis: { fontSize: FontSize.xs, color: Colors.ink, marginTop: 4, fontWeight: FontWeight.medium },
  visitNotes: { fontSize: FontSize.xs, color: Colors.muted, fontStyle: 'italic', marginTop: 4 },
  costBadge: {
    backgroundColor: Colors.accentLight, paddingHorizontal: Spacing.sm,
    paddingVertical: 2, borderRadius: Radius.full,
  },
  costText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.accent },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSize.md, color: Colors.muted },
});
