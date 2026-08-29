import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { formatDate, timeUntil, friendlyError, vaccineOptionsForSpecies } from '@vivra/shared';
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
  const [brand, setBrand] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [notes, setNotes] = useState('');
  const vaccineOptions = vaccineOptionsForSpecies(pet?.species);

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
    setName(''); setCustomName(''); setNextDue(''); setVetName(''); setBrand(''); setLotNumber(''); setNotes('');
    setDateGiven(new Date().toISOString().slice(0, 10));
    setEditingVaccine(null);
  };

  const openEdit = (v: Vaccine) => {
    setEditingVaccine(v);
    // If the stored name matches a known option, select it; otherwise use "Otra"
    const knownOption = vaccineOptions.find(o => o.key === v.name);
    setName(knownOption ? v.name : 'Otra');
    setCustomName(knownOption ? '' : v.name);
    setDateGiven(v.date_given);
    setNextDue(v.next_due ?? '');
    setVetName(v.vet_name ?? '');
    setBrand(v.brand ?? '');
    setLotNumber(v.lot_number ?? '');
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
      brand: brand.trim() || null,
      lot_number: lotNumber.trim() || null,
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

  // The most actionable order is the chronological next-dose timeline first;
  // historic doses without a confirmed next date follow newest-first. This
  // keeps an overdue or upcoming vaccine from being buried in old records.
  const orderedVaccines = [...vaccines].sort((a, b) => {
    const aNext = a.next_due ? new Date(`${a.next_due}T00:00:00`).getTime() : null;
    const bNext = b.next_due ? new Date(`${b.next_due}T00:00:00`).getTime() : null;
    if (aNext !== null && bNext !== null) return aNext - bNext;
    if (aNext !== null) return -1;
    if (bNext !== null) return 1;
    return b.date_given.localeCompare(a.date_given);
  });

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
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="shield-checkmark" size={22} color={Colors.accent} />
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>Historial de vacunación</Text>
            <Text style={styles.introText}>Tus próximas dosis aparecen primero. Guarda cada aplicación tal como aparece en el carné.</Text>
          </View>
        </View>

        {/* Vaccine list */}
        {vaccines.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Ionicons name="medkit-outline" size={48} color={Colors.cardBorder} />
            <Text style={styles.emptyText}>No hay vacunas registradas</Text>
          </View>
        ) : loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.loadingText}>Cargando vacunas…</Text>
          </View>
        ) : (
          orderedVaccines.map(v => {
            const isOverdue = Boolean(v.next_due && new Date(`${v.next_due}T00:00:00`) < new Date(new Date().setHours(0, 0, 0, 0)));
            const isUpcoming = Boolean(v.next_due && !isOverdue);
            return (
              <Card key={v.id} style={styles.vaccineCard}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => openEdit(v)}>
                  <View style={styles.vaccineHeader}>
                    <View style={[styles.vaccineIcon, isOverdue ? styles.vaccineIconOverdue : isUpcoming ? styles.vaccineIconUpcoming : styles.vaccineIconRecorded]}>
                      <Ionicons name="shield-checkmark" size={22} color={isOverdue ? Colors.bad : isUpcoming ? '#C2410C' : Colors.good} />
                    </View>
                    <View style={styles.vaccineInfo}>
                      <Text style={styles.vaccineName}>{v.name}</Text>
                      <Text style={styles.vaccineDate}>Aplicada: {formatDate(v.date_given)}</Text>
                    </View>
                    <View style={[styles.statusPill, isOverdue ? styles.statusPillOverdue : isUpcoming ? styles.statusPillUpcoming : styles.statusPillRecorded]}>
                      <Text style={[styles.statusPillText, isOverdue ? styles.statusTextOverdue : isUpcoming ? styles.statusTextUpcoming : styles.statusTextRecorded]}>
                        {isOverdue ? 'Pendiente' : isUpcoming ? 'Programada' : 'Registrada'}
                      </Text>
                    </View>
                  </View>

                  {v.next_due && (
                    <View style={[styles.nextDose, isOverdue && styles.nextDoseOverdue]}>
                      <Ionicons name={isOverdue ? 'alert-circle' : 'calendar-outline'} size={18} color={isOverdue ? Colors.bad : Colors.accent} />
                      <View style={styles.nextDoseCopy}>
                        <Text style={[styles.nextDoseLabel, isOverdue && styles.overdue]}>Próxima dosis</Text>
                        <Text style={[styles.nextDoseValue, isOverdue && styles.overdue]}>{formatDate(v.next_due)} · {timeUntil(v.next_due)}</Text>
                      </View>
                    </View>
                  )}

                  {(v.brand || v.lot_number || v.vet_name) && (
                    <Text style={styles.vaccineMeta}>
                      {[v.brand, v.lot_number ? `Lote ${v.lot_number}` : null, v.vet_name ? `Dr. ${v.vet_name}` : null].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editAction} onPress={() => openEdit(v)} activeOpacity={0.7}>
                    <Ionicons name="pencil-outline" size={17} color={Colors.accent} />
                    <Text style={styles.editActionText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteAction} onPress={() => handleDelete(v.id)} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={17} color={Colors.bad} />
                    <Text style={styles.deleteActionText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit form bottom sheet */}
      <BottomSheet visible={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingVaccine ? 'Editar vacuna' : 'Agregar vacuna'}>
        <SelectField
          label="Vacuna"
          value={name}
          options={vaccineOptions}
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
          label="Marca o laboratorio (opcional)"
          value={brand}
          onChangeText={setBrand}
          placeholder="Tal como aparece en el carné"
        />
        <FormField
          label="Lote (opcional)"
          value={lotNumber}
          onChangeText={setLotNumber}
          placeholder="Número de lote"
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
  introCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 16,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  introIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEDD5',
  },
  introCopy: { flex: 1 },
  introTitle: {
    color: Colors.ink,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  introText: {
    color: Colors.muted,
    fontSize: FontSize.xs,
    lineHeight: 17,
    marginTop: 2,
  },
  loading: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    color: Colors.muted,
    fontSize: FontSize.sm,
  },
  vaccineCard: {
    padding: Spacing.md,
  },
  vaccineHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  vaccineIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaccineIconRecorded: { backgroundColor: '#ECFDF5' },
  vaccineIconUpcoming: { backgroundColor: '#FFF7ED' },
  vaccineIconOverdue: { backgroundColor: '#FEF2F2' },
  vaccineInfo: { flex: 1 },
  vaccineName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  vaccineDate: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: 3,
  },
  vaccineMeta: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: Spacing.sm,
    lineHeight: 17,
  },
  nextDose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: 12,
    backgroundColor: Colors.accentLight,
  },
  nextDoseOverdue: { backgroundColor: '#FEF2F2' },
  nextDoseCopy: { flex: 1 },
  nextDoseLabel: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  nextDoseValue: {
    color: Colors.ink,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
  },
  overdue: { color: Colors.bad },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusPillRecorded: { backgroundColor: '#ECFDF5' },
  statusPillUpcoming: { backgroundColor: '#FFF7ED' },
  statusPillOverdue: { backgroundColor: '#FEF2F2' },
  statusPillText: { fontSize: 10, fontWeight: FontWeight.semibold },
  statusTextRecorded: { color: Colors.good },
  statusTextUpcoming: { color: '#C2410C' },
  statusTextOverdue: { color: Colors.bad },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  editAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: 10,
    backgroundColor: Colors.accentLight,
  },
  editActionText: {
    color: Colors.accent,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  deleteAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
  },
  deleteActionText: {
    color: Colors.bad,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: { fontSize: FontSize.md, color: Colors.muted },
});
