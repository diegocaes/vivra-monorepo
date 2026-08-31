import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { formatDate, friendlyError, preventiveNextDue } from '@vivra/shared';
import { usePetContext } from '../../../contexts/PetContext';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { FormField } from '../../../components/ui/FormField';
import { DatePickerField } from '../../../components/ui/DatePickerField';
import { schedulePreventiveReminder, requestPushPermissionAndRegister } from '../../../hooks/useNotifications';
import type { PreventiveTreatment } from '@vivra/shared/lib/database';
import { track } from '../../../lib/analytics';
import { HistoryChart } from '../../../components/pet/HistoryChart';
import { useSubscription } from '../../../contexts/SubscriptionContext';

type TreatmentType = 'antipulgas' | 'desparasitante' | 'combinado';

interface StatusCardProps {
  type: 'antipulgas' | 'desparasitante';
  last: PreventiveTreatment | null;
  onAdd: () => void;
}

function StatusCard({ type, last, onAdd }: StatusCardProps) {
  const config = {
    antipulgas: { icon: 'shield-checkmark' as const, iconColor: Colors.warn, label: 'Antipulgas' },
    desparasitante: { icon: 'medical' as const, iconColor: '#E879F9', label: 'Desparasitante' },
  }[type];

  let statusColor = Colors.muted;
  let statusText = 'Sin registro';
  let isUrgent = false;

  if (last) {
    if (!last.next_due) {
      statusText = 'Sin próxima fecha';
    } else {
    const nextDate = new Date(`${last.next_due}T00:00:00`);
    const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      statusColor = Colors.bad;
      statusText = `Vencido hace ${Math.abs(daysLeft)}d`;
      isUrgent = true;
    } else if (daysLeft <= 5) {
      statusColor = Colors.warn;
      statusText = `En ${daysLeft}d`;
      isUrgent = true;
    } else {
      statusColor = Colors.good;
      statusText = `En ${daysLeft}d`;
    }
    }
  } else {
    isUrgent = true;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onAdd}
      style={[
        styles.statusCard,
        isUrgent && { borderColor: statusColor, borderWidth: 2, backgroundColor: `${statusColor}12` },
      ]}
    >
      <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
      <Ionicons name={config.icon} size={22} color={config.iconColor} />
      <View style={styles.statusInfo}>
        <Text style={styles.statusLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{config.label}</Text>
        <Text style={[styles.statusText, { color: statusColor, fontWeight: isUrgent ? FontWeight.bold : FontWeight.medium }]}>{statusText}</Text>
      </View>
      <Ionicons name="add-circle" size={26} color={Colors.accent} />
    </TouchableOpacity>
  );
}

/** Quita duplicados por id: un 'combinado' aparece en antipulgas Y en
 *  desparasitante, y sin esto se contaría (y cobraría) dos veces. */
function dedupePorId<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map(i => [i.id, i])).values()];
}

export default function PreventivosScreen() {
  const router = useRouter();
  const { pet, refresh: refreshPetData } = usePetContext();
  const { isPremium } = useSubscription();
  const [antipulgas, setAntipulgas] = useState<PreventiveTreatment[]>([]);
  const [desparasitante, setDesparasitante] = useState<PreventiveTreatment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<TreatmentType>('antipulgas');
  const [saving, setSaving] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<PreventiveTreatment | null>(null);

  // Form
  const [dateApplied, setDateApplied] = useState(new Date().toISOString().slice(0, 10));
  const [nextDue, setNextDue] = useState('');
  const [productName, setProductName] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async () => {
    if (!pet?.id) return;

    // Fetch all treatments in one roundtrip. A 'combinado' row counts as BOTH
    // antipulgas and desparasitante, so we merge it into both lists below.
    const { data, error } = await supabase
      .from('preventive_treatments')
      .select('*')
      .eq('pet_id', pet.id)
      .order('date_given', { ascending: false });

    if (error) console.warn('[Preventivos] fetch error:', error.message);

    const all = (data ?? []).map(treatment => ({
      ...treatment,
      next_due: preventiveNextDue(pet.species, treatment.date_given, treatment.next_due),
    }));
    const anti = all.filter(t => t.type === 'antipulgas' || t.type === 'combinado');
    const des = all.filter(t => t.type === 'desparasitante' || t.type === 'combinado');

    setAntipulgas(anti);
    setDesparasitante(des);
  }, [pet?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const resetForm = () => {
    setDateApplied(new Date().toISOString().slice(0, 10));
    setNextDue(pet?.species === 'dog' ? preventiveNextDue('dog', new Date().toISOString().slice(0, 10), null) ?? '' : '');
    setProductName('');
    setCost('');
    setNotes('');
    setEditingTreatment(null);
  };

  const openForm = (type: TreatmentType) => {
    resetForm();
    setFormType(type);
    setShowForm(true);
  };

  const openEdit = (item: PreventiveTreatment) => {
    setEditingTreatment(item);
    setFormType(item.type as TreatmentType);
    setDateApplied(item.date_given);
    setNextDue(preventiveNextDue(pet?.species, item.date_given, item.next_due) ?? '');
    setProductName(item.product_name ?? '');
    setCost(item.cost?.toString() ?? '');
    setNotes(item.notes ?? '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!pet) return;
    if (!dateApplied) { Alert.alert('Error', 'Ingresa la fecha'); return; }

    setSaving(true);
    const effectiveNextDue = preventiveNextDue(pet.species, dateApplied, nextDue);
    const payload = {
      type: formType,
      date_given: dateApplied,
      next_due: effectiveNextDue,
      product_name: productName || null,
      cost: cost ? parseFloat(cost) : null,
      notes: notes || null,
    };
    const { error } = editingTreatment
      ? await supabase.from('preventive_treatments').update(payload).eq('id', editingTreatment.id)
      : await supabase.from('preventive_treatments').insert({ ...payload, pet_id: pet.id });
    setSaving(false);

    if (error) {
      console.warn('[preventivos] save error:', error.message);
      Alert.alert('Error', friendlyError(error));
      return;
    }

    // Solo se registra el guardado exitoso: los intentos fallidos ya se ven
    // en Sentry y aquí solo ensuciarían las métricas de uso.
    track('crud', `preventivo_${editingTreatment ? 'editar' : 'crear'}`);

    // Schedule reminder only on new entries
    if (!editingTreatment) {
      try {
        // Moment of value: the user just logged a preventive — the reminder
        // IS the benefit. If they haven't granted notification permission
        // yet (e.g. skipped at onboarding), ask now with full context.
        await requestPushPermissionAndRegister();
        if (effectiveNextDue) {
          await schedulePreventiveReminder({ petName: pet.name, type: formType, nextDueDate: new Date(`${effectiveNextDue}T09:00:00`) });
        }
      } catch (e) {
        console.warn('[Preventivos] schedule reminder failed:', e);
      }
    }

    resetForm();
    setShowForm(false);
    fetchData();
    refreshPetData().catch(() => {});
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar registro', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('preventive_treatments').delete().eq('id', id).eq('pet_id', pet!.id);
          fetchData();
          refreshPetData().catch(() => {});
        },
      },
    ]);
  };

  const renderList = (items: PreventiveTreatment[], label: string) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{label}</Text>
      {items.length === 0 ? (
        <Text style={styles.noRecords}>
          Aún no hay registros de {label.toLowerCase()}. Toca el botón
          {' '}+ arriba para agregar el primero.
        </Text>
      ) : (
        items.map(item => (
          <TouchableOpacity key={item.id} activeOpacity={0.7} onPress={() => openEdit(item)}>
            <Card>
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
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="pencil-outline" size={20} color={Colors.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={20} color={Colors.muted} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const formLabel =
    formType === 'antipulgas' ? 'Antipulgas'
    : formType === 'desparasitante' ? 'Desparasitante'
    : 'Combinado (antipulgas + desparasitante)';

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

        {/* Combinado CTA — a single product covering both */}
        <TouchableOpacity activeOpacity={0.7} onPress={() => openForm('combinado')} style={styles.combinedCta}>
          <Ionicons name="sparkles" size={18} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.combinedCtaLabel}>Registrar combinado</Text>
            <Text style={styles.combinedCtaSub}>Un solo producto que cubre antipulgas + desparasitante</Text>
          </View>
          <Ionicons name="add-circle" size={22} color={Colors.accent} />
        </TouchableOpacity>

        {/* Una sola gráfica con todas las dosis: lo que importa aquí es la
            constancia, y separarla por tipo la haría ilegible. */}
        <HistoryChart
          items={dedupePorId([...antipulgas, ...desparasitante]).map(t => ({ date: t.date_given, amount: t.cost }))}
          noun="dosis"
          showMoney={isPremium}
        />

        {/* History lists */}
        {renderList(antipulgas, 'Historial Antipulgas')}
        {renderList(desparasitante, 'Historial Desparasitante')}
      </ScrollView>

      <BottomSheet visible={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingTreatment ? `Editar ${formLabel}` : `Agregar ${formLabel}`}>
        <DatePickerField
          label="Fecha de aplicación"
          value={dateApplied}
          onChange={date => {
            setDateApplied(date);
            if (pet?.species === 'dog') setNextDue(preventiveNextDue('dog', date, null) ?? '');
          }}
          maxDate={new Date()}
        />
        <DatePickerField
          label={pet?.species === 'dog' ? 'Próxima aplicación' : 'Próxima aplicación (opcional)'}
          value={nextDue}
          onChange={setNextDue}
          clearable={pet?.species !== 'dog'}
        />
        <Text style={styles.nextDueHint}>
          {pet?.species === 'dog'
            ? 'Se completa automáticamente un mes después de la aplicación.'
            : 'Confirma la fecha con tu veterinario o la etiqueta del producto.'}
        </Text>
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
  nextDueHint: { fontSize: FontSize.xs, color: Colors.muted, marginTop: -Spacing.sm, marginBottom: Spacing.sm, lineHeight: 17 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  itemInfo: { flex: 1 },
  rowActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  itemDate: { fontSize: FontSize.md, fontWeight: FontWeight.medium, color: Colors.ink },
  itemProduct: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  itemNotes: { fontSize: FontSize.xs, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  costBadge: {
    backgroundColor: Colors.accentLight, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 1, alignSelf: 'flex-start', marginTop: 2,
  },
  costText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.accent },
  combinedCta: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.lg,
    borderWidth: 1, borderColor: `${Colors.accent}33`,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  combinedCtaLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  combinedCtaSub: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 1 },
});
