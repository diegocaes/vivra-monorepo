import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { formatDate, timeUntil, friendlyError } from '@vivra/shared';
import { usePetContext } from '../../../contexts/PetContext';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { FormField } from '../../../components/ui/FormField';
import { DatePickerField } from '../../../components/ui/DatePickerField';
import { SelectField } from '../../../components/ui/SelectField';
import type { Vaccine } from '../../../types/supabase';
import { track } from '../../../lib/analytics';
import { AddButton } from '../../../components/ui/AddButton';

const VACCINE_OPTIONS = [
  { key: 'Rabia', label: 'Rabia' },
  { key: 'Parvovirus', label: 'Parvovirus' },
  { key: 'Moquillo', label: 'Moquillo' },
  { key: 'Bordetella', label: 'Bordetella' },
  { key: 'Leptospirosis', label: 'Leptospirosis' },
  { key: 'Hepatitis', label: 'Hepatitis' },
  { key: 'Otra', label: 'Otra' },
];

export default function VacunasScreen() {
  const router = useRouter();
  const { pet } = usePetContext();
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [customName, setCustomName] = useState('');
  const [dateGiven, setDateGiven] = useState(new Date().toISOString().slice(0, 10));
  const [nextDue, setNextDue] = useState('');
  const [vetName, setVetName] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async () => {
    if (!pet?.id) return;

    const { data } = await supabase
      .from('vaccines').select('*').eq('pet_id', pet.id).order('date_given', { ascending: false });
    setVaccines((data as Vaccine[]) ?? []);
    setLoading(false);
  }, [pet?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const resetForm = () => {
    setName(''); setCustomName(''); setNextDue(''); setVetName(''); setNotes('');
    setDateGiven(new Date().toISOString().slice(0, 10));
    setEditingVaccine(null);
  };

  const openEdit = (v: Vaccine) => {
    setEditingVaccine(v);
    // If the stored name matches a known option, select it; otherwise use "Otra"
    const knownOption = VACCINE_OPTIONS.find(o => o.key === v.name);
    setName(knownOption ? v.name : 'Otra');
    setCustomName(knownOption ? '' : v.name);
    setDateGiven(v.date_given);
    setNextDue(v.next_due ?? '');
    setVetName(v.vet_name ?? '');
    setNotes(v.notes ?? '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!pet) return;
    const vaccineName = name === 'Otra' ? customName.trim() : name;
    if (!vaccineName) { Alert.alert('Error', 'Selecciona una vacuna'); return; }
    if (!dateGiven) { Alert.alert('Error', 'Ingresa la fecha'); return; }

    setSaving(true);
    const payload = {
      name: vaccineName,
      date_given: dateGiven,
      next_due: nextDue || null,
      vet_name: vetName || null,
      notes: notes || null,
    };
    const { error } = editingVaccine
      ? await supabase.from('vaccines').update(payload).eq('id', editingVaccine.id)
      : await supabase.from('vaccines').insert({ ...payload, pet_id: pet.id });
    setSaving(false);

    if (error) {
      console.warn('[vacunas] save error:', error.message);
      Alert.alert('Error', friendlyError(error));
      return;
    }

    // Solo se registra el guardado exitoso: los intentos fallidos ya se ven
    // en Sentry y aquí solo ensuciarían las métricas de uso.
    track('crud', `vacuna_${editingVaccine ? 'editar' : 'crear'}`);
    resetForm();
    setShowForm(false);
    fetchData();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar vacuna', '¿Estás seguro? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('vaccines').delete().eq('id', id).eq('pet_id', pet!.id);
          fetchData();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Vacunas</Text>
        <AddButton label="Vacuna" onPress={() => { resetForm(); setShowForm(true); }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Vaccine list */}
        {vaccines.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Ionicons name="medkit-outline" size={48} color={Colors.cardBorder} />
            <Text style={styles.emptyText}>No hay vacunas registradas</Text>
          </View>
        ) : (
          vaccines.map(v => {
            const isOverdue = v.next_due && new Date(v.next_due) < new Date();
            return (
              <TouchableOpacity key={v.id} activeOpacity={0.7} onPress={() => openEdit(v)}>
                <Card>
                  <View style={styles.vaccineRow}>
                    <View style={styles.vaccineInfo}>
                      <Text style={styles.vaccineName}>{v.name}</Text>
                      <Text style={styles.vaccineDate}>{formatDate(v.date_given)}</Text>
                      {v.next_due && (
                        <Text style={[styles.vaccineNext, isOverdue && styles.overdue]}>
                          Próxima: {timeUntil(v.next_due)}
                        </Text>
                      )}
                      {v.vet_name && <Text style={styles.vaccineVet}>Dr. {v.vet_name}</Text>}
                    </View>
                    <View style={styles.rowActions}>
                      <TouchableOpacity onPress={() => openEdit(v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="pencil-outline" size={20} color={Colors.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(v.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={20} color={Colors.muted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit form bottom sheet */}
      <BottomSheet visible={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingVaccine ? 'Editar vacuna' : 'Agregar vacuna'}>
        <SelectField
          label="Vacuna"
          value={name}
          options={VACCINE_OPTIONS}
          onSelect={setName}
        />
        {name === 'Otra' && (
          <FormField
            label="Nombre de la vacuna"
            value={customName}
            onChangeText={setCustomName}
            placeholder="Ej: Lyme, Influenza..."
          />
        )}
        <DatePickerField
          label="Fecha de aplicación"
          value={dateGiven}
          onChange={setDateGiven}
          maxDate={new Date()}
        />
        <DatePickerField
          label="Próxima dosis (opcional)"
          value={nextDue}
          onChange={setNextDue}
          clearable
        />
        <FormField
          label="Veterinario (opcional)"
          value={vetName}
          onChangeText={setVetName}
          placeholder="Nombre del veterinario"
        />
        <FormField
          label="Notas (opcional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Observaciones..."
          multiline
          style={{ minHeight: 60 }}
        />
        <Button title="Guardar" onPress={handleSave} loading={saving} />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
    marginBottom: Spacing.sm,
  },
  vaccineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  vaccineInfo: { flex: 1 },
  rowActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  vaccineName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  vaccineDate: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: 2,
  },
  vaccineNext: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    marginTop: 2,
  },
  overdue: {
    color: Colors.bad,
  },
  vaccineVet: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: { fontSize: FontSize.md, color: Colors.muted },
});
