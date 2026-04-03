import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { formatDate, timeUntil } from '@vivra/shared';
import { usePetContext } from '../../../contexts/PetContext';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { FormField } from '../../../components/ui/FormField';
import { SelectField } from '../../../components/ui/SelectField';
import type { Vaccine } from '../../../types/supabase';

const VACCINE_OPTIONS = [
  { key: 'Rabia', label: 'Rabia' },
  { key: 'Parvovirus', label: 'Parvovirus' },
  { key: 'Moquillo', label: 'Moquillo' },
  { key: 'Bordetella', label: 'Bordetella' },
  { key: 'Leptospirosis', label: 'Leptospirosis' },
  { key: 'Hepatitis', label: 'Hepatitis' },
  { key: 'Otra', label: 'Otra' },
];

const BADGE_IMAGES: Record<string, any> = {
  rabia: require('../../../assets/badges/vacunas/rabia.png'),
  parvo: require('../../../assets/badges/vacunas/parvo.png'),
  moquillo: require('../../../assets/badges/vacunas/moquillo.png'),
  bordetella: require('../../../assets/badges/vacunas/bordetella.png'),
  lepto: require('../../../assets/badges/vacunas/lepto.png'),
  hepatitis: require('../../../assets/badges/vacunas/hepatitis.png'),
};

function getVaccineBadgeImage(name: string): any | null {
  const lower = name.toLowerCase();
  for (const [keyword, img] of Object.entries(BADGE_IMAGES)) {
    if (lower.includes(keyword)) return img;
  }
  return null;
}

export default function VacunasScreen() {
  const router = useRouter();
  const { pet } = usePetContext();
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const handleSave = async () => {
    if (!pet) return;
    const vaccineName = name === 'Otra' ? customName.trim() : name;
    if (!vaccineName) { Alert.alert('Error', 'Selecciona una vacuna'); return; }
    if (!dateGiven) { Alert.alert('Error', 'Ingresa la fecha'); return; }

    setSaving(true);
    const { error } = await supabase.from('vaccines').insert({
      pet_id: pet.id,
      name: vaccineName,
      date_given: dateGiven,
      next_due: nextDue || null,
      vet_name: vetName || null,
      notes: notes || null,
    });
    setSaving(false);

    if (error) { Alert.alert('Error', error.message); return; }

    // Reset form
    setName(''); setCustomName(''); setNextDue(''); setVetName(''); setNotes('');
    setDateGiven(new Date().toISOString().slice(0, 10));
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

  // Badge gallery: count unique vaccine names
  const badgeCounts = new Map<string, number>();
  vaccines.forEach(v => {
    const key = v.name.toLowerCase();
    badgeCounts.set(key, (badgeCounts.get(key) ?? 0) + 1);
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Vacunas</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Badge gallery */}
        {badgeCounts.size > 0 && (
          <Card>
            <Text style={styles.sectionTitle}>Badges de vacunación</Text>
            <View style={styles.badgeGrid}>
              {Array.from(badgeCounts.entries()).map(([key, count]) => {
                const img = getVaccineBadgeImage(key);
                return (
                  <View key={key} style={styles.badgeItem}>
                    {img ? (
                      <Image source={img} style={styles.badgeImg} />
                    ) : (
                      <View style={[styles.badgeImg, styles.badgePlaceholder]}>
                        <Ionicons name="medkit" size={24} color={Colors.accent} />
                      </View>
                    )}
                    <Text style={styles.badgeName} numberOfLines={1}>{key}</Text>
                    {count > 1 && (
                      <View style={styles.doseBadge}>
                        <Text style={styles.doseText}>×{count}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        )}

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
              <Card key={v.id}>
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
                  <TouchableOpacity onPress={() => handleDelete(v.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={20} color={Colors.muted} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Add form bottom sheet */}
      <BottomSheet visible={showForm} onClose={() => setShowForm(false)} title="Agregar vacuna">
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
        <FormField
          label="Fecha de aplicación"
          value={dateGiven}
          onChangeText={setDateGiven}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
        />
        <FormField
          label="Próxima dosis (opcional)"
          value={nextDue}
          onChangeText={setNextDue}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
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
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  badgeItem: {
    alignItems: 'center',
    width: 64,
  },
  badgeImg: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
  },
  badgePlaceholder: {
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  doseBadge: {
    position: 'absolute',
    top: -4,
    right: 2,
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  doseText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  vaccineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  vaccineInfo: { flex: 1 },
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
