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
import type { PreventiveTreatment } from '../../../types/supabase';

type TreatmentType = 'antipulgas' | 'desparasitante';

interface StatusCardProps {
  type: TreatmentType;
  last: PreventiveTreatment | null;
  onAdd: () => void;
}

function StatusCard({ type, last, onAdd }: StatusCardProps) {
  const config = {
    antipulgas: { icon: 'shield-checkmark' as const, iconColor: Colors.warn, label: 'Antipulgas', cycleDays: 30 },
    desparasitante: { icon: 'medical' as const, iconColor: '#E879F9', label: 'Desparasitante', cycleDays: 30 },
  }[type];

  let statusColor = Colors.muted;
  let statusText = 'Sin registro';

  if (last) {
    const nextDate = new Date(last.date_given);
    nextDate.setDate(nextDate.getDate() + config.cycleDays);
    const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      statusColor = Colors.bad;
      statusText = `Vencido hace ${Math.abs(daysLeft)}d`;
    } else if (daysLeft <= 5) {
      statusColor = Colors.warn;
      statusText = `En ${daysLeft}d`;
    } else {
      statusColor = Colors.good;
      statusText = `En ${daysLeft}d`;
    }
  }

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onAdd} style={styles.statusCard}>
      <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
      <Ionicons name={config.icon} size={22} color={config.iconColor} />
      <View style={styles.statusInfo}>
        <Text style={styles.statusLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{config.label}</Text>
        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
      </View>
      <Ionicons name="add-circle-outline" size={24} color={Colors.accent} />
    </TouchableOpacity>
  );
}

export default function PreventivosScreen() {
  const router = useRouter();
  const { pet } = usePetContext();
  const [antipulgas, setAntipulgas] = useState<PreventiveTreatment[]>([]);
  const [desparasitante, setDesparasitante] = useState<PreventiveTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<TreatmentType>('antipulgas');
  const [saving, setSaving] = useState(false);

  // Form
  const [dateApplied, setDateApplied] = useState(new Date().toISOString().slice(0, 10));
  const [productName, setProductName] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async () => {
    if (!pet?.id) return;

    const [antiRes, desRes] = await Promise.all([
      supabase.from('preventive_treatments').select('*').eq('pet_id', pet.id).eq('type', 'antipulgas').order('date_given', { ascending: false }),
      supabase.from('preventive_treatments').select('*').eq('pet_id', pet.id).eq('type', 'desparasitante').order('date_given', { ascending: false }),
    ]);

    setAntipulgas((antiRes.data as PreventiveTreatment[]) ?? []);
    setDesparasitante((desRes.data as PreventiveTreatment[]) ?? []);
    setLoading(false);
  }, [pet?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const openForm = (type: TreatmentType) => {
    setFormType(type);
    setDateApplied(new Date().toISOString().slice(0, 10));
    setProductName('');
    setCost('');
    setNotes('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!pet) return;
    if (!dateApplied) { Alert.alert('Error', 'Ingresa la fecha'); return; }

    setSaving(true);
    const { error } = await supabase.from('preventive_treatments').insert({
      pet_id: pet.id,
      type: formType,
      date_given: dateApplied,
      product_name: productName || null,
      cost: cost ? parseFloat(cost) : null,
      notes: notes || null,
    });
    setSaving(false);

    if (error) { Alert.alert('Error', error.message); return; }
    setShowForm(false);
    fetchData();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar registro', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('preventive_treatments').delete().eq('id', id);
          fetchData();
        },
      },
    ]);
  };

  const renderList = (items: PreventiveTreatment[], label: string) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{label}</Text>
      {items.length === 0 ? (
        <Text style={styles.noRecords}>Sin registros</Text>
      ) : (
        items.map(item => (
          <Card key={item.id}>
            <View style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemDate}>{formatDate(item.date_given)}</Text>
                {item.product_name && <Text style={styles.itemProduct}>{item.product_name}</Text>}
                {item.cost != null && item.cost > 0 && (
                  <View style={styles.costBadge}>
                    <Text style={styles.costText}>${item.cost}</Text>
                  </View>
                )}
                {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={20} color={Colors.muted} />
              </TouchableOpacity>
            </View>
          </Card>
        ))
      )}
    </View>
  );

  const formLabel = formType === 'antipulgas' ? 'Antipulgas' : 'Desparasitante';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Preventivos</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Status cards */}
        <View style={styles.statusRow}>
          <StatusCard type="antipulgas" last={antipulgas[0] ?? null} onAdd={() => openForm('antipulgas')} />
          <StatusCard type="desparasitante" last={desparasitante[0] ?? null} onAdd={() => openForm('desparasitante')} />
        </View>

        {/* History lists */}
        {renderList(antipulgas, 'Historial Antipulgas')}
        {renderList(desparasitante, 'Historial Desparasitante')}
      </ScrollView>

      <BottomSheet visible={showForm} onClose={() => setShowForm(false)} title={`Agregar ${formLabel}`}>
        <FormField
          label="Fecha de aplicación"
          value={dateApplied}
          onChangeText={setDateApplied}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
        />
        <FormField
          label="Producto (opcional)"
          value={productName}
          onChangeText={setProductName}
          placeholder="Ej: Frontline, Drontal..."
        />
        <FormField
          label="Costo (opcional)"
          value={cost}
          onChangeText={setCost}
          placeholder="0.00"
          keyboardType="decimal-pad"
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.ink },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md, paddingBottom: Spacing.xxl },
  statusRow: { flexDirection: 'row', gap: Spacing.sm },
  statusCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.cardBorder, padding: Spacing.md, overflow: 'hidden',
  },
  statusIndicator: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
  },
  statusInfo: { flex: 1 },
  statusLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginTop: 2 },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: Spacing.sm,
  },
  noRecords: { fontSize: FontSize.sm, color: Colors.muted, fontStyle: 'italic' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  itemInfo: { flex: 1 },
  itemDate: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.ink },
  itemProduct: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  itemNotes: { fontSize: FontSize.xs, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  costBadge: {
    backgroundColor: Colors.accentLight, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 1, alignSelf: 'flex-start', marginTop: 2,
  },
  costText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.accent },
});
