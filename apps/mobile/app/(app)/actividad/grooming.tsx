import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import {
  formatDate,
  formatGroomingServices,
  friendlyError,
  GROOMING_TYPES,
  normalizeGroomingServices,
} from '@vivra/shared';
import { DatePickerField } from '../../../components/ui/DatePickerField';
import { usePetContext } from '../../../contexts/PetContext';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { FormField } from '../../../components/ui/FormField';
import type { Grooming } from '../../../types/supabase';
import { track } from '../../../lib/analytics';
import { AddButton } from '../../../components/ui/AddButton';
import { HistoryChart } from '../../../components/pet/HistoryChart';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { groomingBackRoute } from '../../../lib/careNavigation';

const GROOMING_OPTIONS = Object.entries(GROOMING_TYPES).map(([key, label]) => ({ key, label }));

export default function GroomingScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { pet } = usePetContext();
  const { isPremium } = useSubscription();
  const [groomings, setGroomings] = useState<Grooming[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingGrooming, setEditingGrooming] = useState<Grooming | null>(null);

  // Form
  const [services, setServices] = useState<string[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [groomerName, setGroomerName] = useState('');
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async () => {
    if (!pet?.id) return;

    const { data } = await supabase
      .from('groomings').select('*').eq('pet_id', pet.id).order('date', { ascending: false });
    setGroomings((data as Grooming[]) ?? []);
    setLoading(false);
  }, [pet?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const resetForm = () => {
    setServices([]); setDate(new Date().toISOString().slice(0, 10));
    setGroomerName(''); setLocation(''); setCost(''); setNotes('');
    setEditingGrooming(null);
  };

  const openEdit = (g: Grooming) => {
    setEditingGrooming(g);
    setServices(normalizeGroomingServices(g.services, g.type));
    setDate(g.date);
    setGroomerName(g.groomer_name ?? '');
    setLocation(g.location ?? '');
    setCost(g.cost?.toString() ?? '');
    setNotes(g.notes ?? '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!pet) return;
    if (services.length === 0) { Alert.alert('Error', 'Selecciona al menos un servicio'); return; }
    if (!date) { Alert.alert('Error', 'Ingresa la fecha'); return; }

    setSaving(true);
    const payload = {
      type: services[0],
      services,
      date,
      groomer_name: groomerName || null,
      location: location || null,
      cost: cost ? parseFloat(cost) : null,
      notes: notes || null,
    };
    const { error } = editingGrooming
      ? await supabase.from('groomings').update(payload).eq('id', editingGrooming.id)
      : await supabase.from('groomings').insert({ ...payload, pet_id: pet.id });
    setSaving(false);

    if (error) {
      console.warn('[grooming] save error:', error.message);
      Alert.alert('Error', friendlyError(error));
      return;
    }

    // Solo se registra el guardado exitoso: los intentos fallidos ya se ven
    // en Sentry y aquí solo ensuciarían las métricas de uso.
    track('crud', `grooming_${editingGrooming ? 'editar' : 'crear'}`);
    resetForm();
    setShowForm(false);
    fetchData();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar registro', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('groomings').delete().eq('id', id).eq('pet_id', pet!.id);
          fetchData();
        },
      },
    ]);
  };

  const totalSessions = groomings.length;
  const lastGrooming = groomings[0];
  const daysSinceLast = lastGrooming
    ? Math.floor((Date.now() - new Date(lastGrooming.date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // `actividad` is a hidden tab that used to remember its last child (often
  // Vuelos). A generic router.back() could therefore open that stale screen.
  // Return explicitly to the visible section that opened Grooming.
  const handleBack = () => {
    router.replace(groomingBackRoute(from));
  };

  const toggleService = (key: string) => {
    setServices(current => current.includes(key)
      ? current.filter(service => service !== key)
      : [...current, key]);
  };

  return (
    <SafeAreaView testID="screen-grooming" style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="grooming-back"
          accessibilityRole="button"
          accessibilityLabel={from === 'inicio' ? 'Volver a Inicio' : 'Volver a Salud'}
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Grooming</Text>
        <AddButton testID="grooming-add" label="Grooming" onPress={() => setShowForm(true)} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Sesiones</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{daysSinceLast !== null ? `${daysSinceLast}d` : '—'}</Text>
            <Text style={styles.statLabel}>Desde último</Text>
          </View>
        </View>

        <HistoryChart
          items={groomings.map(g => ({ date: g.date, amount: g.cost }))}
          noun="sesiones"
          showMoney={isPremium}
        />

        {groomings.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Ionicons name="cut-outline" size={48} color={Colors.cardBorder} />
            <Text style={styles.emptyText}>No hay registros de grooming</Text>
          </View>
        ) : (
          groomings.map(g => (
            <TouchableOpacity key={g.id} activeOpacity={0.7} onPress={() => openEdit(g)}>
              <Card>
                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemType}>{formatGroomingServices(g.services, g.type)}</Text>
                    <Text style={styles.itemDate}>{formatDate(g.date)}</Text>
                    {g.groomer_name && <Text style={styles.itemDetail}>{g.groomer_name}</Text>}
                    {g.location && <Text style={styles.itemDetail}>{g.location}</Text>}
                    {g.notes && <Text style={styles.itemNotes}>{g.notes}</Text>}
                  </View>
                  <View style={styles.itemRight}>
                    {g.cost !== null && g.cost > 0 && (
                      <View style={styles.costBadge}>
                        <Text style={styles.costText}>${g.cost}</Text>
                      </View>
                    )}
                    <View style={styles.rowActions}>
                      <TouchableOpacity onPress={() => openEdit(g)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="pencil-outline" size={20} color={Colors.muted} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(g.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={20} color={Colors.muted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <BottomSheet visible={showForm} onClose={() => setShowForm(false)} title={editingGrooming ? 'Editar grooming' : 'Agregar grooming'}>
        <View style={styles.servicesField}>
          <Text style={styles.servicesLabel}>Servicios incluidos</Text>
          <Text style={styles.servicesHint}>Selecciona uno o varios</Text>
          <View style={styles.servicesWrap}>
            {GROOMING_OPTIONS.map(option => {
              const selected = services.includes(option.key);
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.serviceChip, selected && styles.serviceChipSelected]}
                  onPress={() => toggleService(option.key)}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  {selected && <Ionicons name="checkmark" size={15} color={Colors.white} />}
                  <Text style={[styles.serviceChipText, selected && styles.serviceChipTextSelected]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <DatePickerField label="Fecha" value={date} onChange={setDate} maxDate={new Date()} />
        <FormField label="Peluquero (opcional)" value={groomerName} onChangeText={setGroomerName} placeholder="Nombre" />
        <FormField label="Ubicación (opcional)" value={location} onChangeText={setLocation} placeholder="Pet Spa, clínica..." />
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
  itemRow: { flexDirection: 'row', gap: Spacing.sm },
  itemInfo: { flex: 1 },
  itemRight: { alignItems: 'flex-end', gap: Spacing.sm },
  rowActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  itemType: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  itemDate: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  itemDetail: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  itemNotes: { fontSize: FontSize.xs, color: Colors.muted, fontStyle: 'italic', marginTop: 4 },
  servicesField: { gap: Spacing.xs },
  servicesLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  servicesHint: { fontSize: FontSize.xs, color: Colors.muted },
  servicesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: 2 },
  serviceChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
  },
  serviceChipSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  serviceChipText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.ink },
  serviceChipTextSelected: { color: Colors.white },
  costBadge: {
    backgroundColor: Colors.accentLight, paddingHorizontal: Spacing.sm,
    paddingVertical: 2, borderRadius: Radius.full,
  },
  costText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.accent },
  empty: { alignItems: 'center', paddingVertical: Spacing.xxl },
  emptyText: { fontSize: FontSize.md, color: Colors.muted },
});
