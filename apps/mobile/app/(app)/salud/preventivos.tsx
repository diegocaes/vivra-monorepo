import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { formatDate, friendlyError, preventiveNextDue, localDateKey, daysUntilDate, formatCurrency } from '@vivra/shared';
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
import { HealthPetIdentity } from '../../../components/health/HealthPetIdentity';
import { HealthTabs, type HealthTab } from '../../../components/health/HealthTabs';
import { DataLoadNotice } from '../../../components/shared/DataLoadNotice';
import { SelectField } from '../../../components/ui/SelectField';
import { useRemoteData } from '../../../hooks/useRemoteData';
import { useAuth } from '../../../hooks/useAuth';

type TreatmentType = 'antipulgas' | 'desparasitante' | 'combinado';

interface StatusCardProps {
  type: 'antipulgas' | 'desparasitante';
  last: PreventiveTreatment | null;
  onPress: () => void;
}

function StatusCard({ type, last, onPress }: StatusCardProps) {
  const config = {
    antipulgas: { icon: 'bug-outline' as const, color: Colors.accent, background: Colors.accentLight, label: 'Antipulgas' },
    desparasitante: { icon: 'medical-outline' as const, color: Colors.rose, background: Colors.coral, label: 'Desparasitación interna' },
  }[type];
  const days = last?.next_due ? daysUntilDate(last.next_due) : null;
  const statusColor = days === null ? Colors.muted : days < 0 ? Colors.bad : days <= 5 ? Colors.warn : Colors.good;
  const statusText = !last ? 'Sin registro' : days === null ? 'Sin fecha' : days < 0 ? 'Revisar' : days === 0 ? 'Hoy' : `En ${days}d`;
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${config.label}: ${statusText}`} activeOpacity={0.7} onPress={onPress} style={styles.statusCard}>
      <View style={[styles.statusIcon, { backgroundColor: config.background }]}><Ionicons name={config.icon} size={25} color={config.color} /></View>
      <View style={styles.statusInfo}>
        <Text style={styles.statusLabel}>{config.label}</Text>
        <Text style={styles.statusDetail}>{last?.product_name || 'Producto sin registrar'}</Text>
        <Text style={styles.statusDetail}>{last ? `Última: ${formatDate(last.date_given)}` : 'Agrega la primera aplicación'}</Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: `${statusColor}12` }]}><Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text></View>
      <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
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
  const { user } = useAuth();
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [activeTab, setActiveTab] = useState<HealthTab>('summary');
  const { pet, refresh: refreshPetData } = usePetContext();
  const { isPremium } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<TreatmentType>('antipulgas');
  const [saving, setSaving] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<PreventiveTreatment | null>(null);

  // Form
  const [dateApplied, setDateApplied] = useState(localDateKey());
  const [nextDue, setNextDue] = useState('');
  const [productName, setProductName] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const loadTreatments = useCallback(async (signal: AbortSignal) => {
    const { data, error } = await supabase
      .from('preventive_treatments').select('*').eq('pet_id', pet!.id)
      .order('date_given', { ascending: false }).abortSignal(signal);
    if (error) throw error;
    return (data ?? []).map(treatment => ({
      ...treatment,
      next_due: preventiveNextDue(pet?.species, treatment.date_given, treatment.next_due),
    }));
  }, [pet?.id, pet?.species]);
  const { data, loading, error: loadError, refresh: fetchData } = useRemoteData(pet?.id ? `preventives:${user?.id}:${pet.id}:${pet.species}` : null, loadTreatments);
  // Combined doses appear in both category summaries, once in the full history.
  const antipulgas = (data ?? []).filter(t => t.type === 'antipulgas' || t.type === 'combinado');
  const desparasitante = (data ?? []).filter(t => t.type === 'desparasitante' || t.type === 'combinado');
  const history = dedupePorId([...antipulgas, ...desparasitante]).sort((a, b) => b.date_given.localeCompare(a.date_given));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshPetData()]);
    setRefreshing(false);
  }, [fetchData, refreshPetData]);

  const resetForm = () => {
    setDateApplied(localDateKey());
    setNextDue(pet?.species === 'dog' ? preventiveNextDue('dog', localDateKey(), null) ?? '' : '');
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

  useEffect(() => {
    if (add) {
      openForm('antipulgas');
      router.setParams({ add: undefined });
    }
  }, [add]);

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
      ? await supabase.from('preventive_treatments').update(payload).eq('id', editingTreatment.id).eq('pet_id', pet.id)
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
          const { error } = await supabase.from('preventive_treatments').delete().eq('id', id).eq('pet_id', pet!.id);
          if (error) { Alert.alert('No se pudo eliminar', friendlyError(error)); return; }
          await Promise.all([fetchData(), refreshPetData()]);
        },
      },
    ]);
  };

  const latest = [antipulgas[0], desparasitante[0]];
  const missingCount = latest.filter(item => !item?.next_due).length;
  const overdueCount = latest.filter(item => item?.next_due && daysUntilDate(item.next_due) < 0).length;
  const statusTitle = history.length === 0 ? 'Empieza su registro' : overdueCount > 0 ? 'Hay fechas por revisar' : missingCount > 0 ? 'Completa las próximas fechas' : 'Fechas al día';
  const statusText = history.length === 0 ? 'Guarda los productos y fechas de sus cuidados preventivos.' : overdueCount > 0 ? 'Revisa las próximas aplicaciones con tu veterinario.' : missingCount > 0 ? 'Faltan fechas o registros para completar este resumen.' : 'No hay fechas pendientes en los dos cuidados registrados.';

  const formLabel =
    formType === 'antipulgas' ? 'Antipulgas'
    : formType === 'desparasitante' ? 'Desparasitante'
    : 'Combinado (antipulgas + desparasitante)';

  return (
    <SafeAreaView testID="screen-preventives" style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver a Salud" onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/salud')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Preventivos</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <HealthPetIdentity />
        <HealthTabs value={activeTab} onChange={setActiveTab} />
        <DataLoadNotice message={loadError ? 'No pudimos cargar los preventivos. Inténtalo de nuevo.' : null} onRetry={fetchData} />
        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={Colors.accent} /><Text style={styles.noRecords}>Cargando preventivos…</Text></View>
        ) : loadError ? null : activeTab === 'summary' ? (
          <>
            <View style={[styles.summary, overdueCount > 0 && { backgroundColor: Colors.sand }]}>
              <View style={[styles.summaryIcon, { backgroundColor: overdueCount > 0 ? Colors.warn : missingCount > 0 ? Colors.muted : Colors.good }]}>
                <Ionicons name={overdueCount > 0 || missingCount > 0 ? 'calendar-outline' : 'checkmark'} size={29} color={Colors.white} />
              </View>
              <View style={styles.statusInfo}>
                <Text style={styles.summaryTitle}>{statusTitle}</Text>
                <Text style={styles.summaryText}>{statusText}</Text>
              </View>
            </View>
            <Card padded={false}>
              <StatusCard type="antipulgas" last={antipulgas[0] ?? null} onPress={() => antipulgas[0] ? openEdit(antipulgas[0]) : openForm('antipulgas')} />
              <View style={styles.rowDivider} />
              <StatusCard type="desparasitante" last={desparasitante[0] ?? null} onPress={() => desparasitante[0] ? openEdit(desparasitante[0]) : openForm('desparasitante')} />
            </Card>
          </>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Todas las aplicaciones</Text><Text style={styles.historyCount}>{history.length}</Text></View>
            {history.length === 0 ? <Card><Text style={styles.noRecords}>Todavía no hay aplicaciones registradas.</Text></Card> : (
              <Card padded={false}>
                {history.map((item, index) => (
                  <View key={item.id} style={[styles.itemRow, index < history.length - 1 && styles.itemBorder]}>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Editar preventivo ${item.product_name || item.type}, ${formatDate(item.date_given)}`} activeOpacity={0.7} onPress={() => openEdit(item)} style={styles.itemMain}>
                      <View style={styles.historyIcon}><Ionicons name={item.type === 'antipulgas' ? 'bug-outline' : item.type === 'combinado' ? 'sparkles-outline' : 'medical-outline'} size={21} color={Colors.accent} /></View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemProduct}>{item.product_name || (item.type === 'combinado' ? 'Combinado' : item.type === 'antipulgas' ? 'Antipulgas' : 'Desparasitante')}</Text>
                        <Text style={styles.itemDate}>{formatDate(item.date_given)} · {item.type === 'combinado' ? 'Combinado' : item.type === 'antipulgas' ? 'Antipulgas' : 'Desparasitante'}</Text>
                        {item.next_due && <Text style={styles.itemDate}>Próxima: {formatDate(item.next_due)}</Text>}
                        {item.cost != null && item.cost > 0 && <View style={styles.costBadge}><Text style={styles.costText}>${formatCurrency(item.cost)}</Text></View>}
                        {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Eliminar preventivo ${item.product_name || item.type}`} onPress={() => handleDelete(item.id)} style={styles.deleteAction}><Ionicons name="trash-outline" size={19} color={Colors.muted} /></TouchableOpacity>
                  </View>
                ))}
              </Card>
            )}
            <HistoryChart items={history.map(t => ({ date: t.date_given, amount: t.cost }))} noun="dosis" showMoney={isPremium} />
          </View>
        )}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Registrar combinado" activeOpacity={0.7} onPress={() => openForm('combinado')} style={styles.combinedCta}>
          <Ionicons name="sparkles-outline" size={20} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.combinedCtaLabel}>Registrar combinado</Text>
            <Text style={styles.combinedCtaSub}>Un producto para ambos cuidados</Text>
          </View>
          <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}><Button title="Agregar preventivo" onPress={() => openForm('antipulgas')} /></View>

      <BottomSheet visible={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingTreatment ? `Editar ${formLabel}` : `Agregar ${formLabel}`} footer={<Button title="Guardar" onPress={handleSave} loading={saving} />}>
        {!editingTreatment && <SelectField label="Tipo de preventivo" value={formType} options={[{ key: 'antipulgas', label: 'Antipulgas' }, { key: 'desparasitante', label: 'Desparasitante' }, { key: 'combinado', label: 'Combinado' }]} onSelect={value => setFormType(value as TreatmentType)} />}
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
          testID="preventive-product"
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
          testID="preventive-notes"
          label="Notas (opcional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Observaciones..."
          multiline
          style={{ minHeight: 60 }}
        />
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, color: Colors.ink },
  scroll: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md, paddingBottom: Spacing.md },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, backgroundColor: Colors.canvas },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.accentLight },
  summaryIcon: { width: 53, height: 53, borderRadius: 27, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: '#FFFFFF70' },
  summaryTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  summaryText: { fontSize: FontSize.xs, lineHeight: 19, color: Colors.muted, marginTop: 4 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, minHeight: 106 },
  statusIcon: { width: 45, height: 50, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  statusInfo: { flex: 1 },
  statusLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  statusDetail: { fontSize: FontSize.xs, lineHeight: 18, color: Colors.muted, marginTop: 3 },
  statusPill: { borderRadius: Radius.full, paddingVertical: 5, paddingHorizontal: 7, maxWidth: 75 },
  statusText: { fontSize: 10, fontWeight: FontWeight.medium, textAlign: 'center' },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.cardBorder, marginLeft: Spacing.md },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  historyCount: { fontSize: FontSize.xs, color: Colors.muted },
  loading: { padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  noRecords: { fontSize: FontSize.sm, color: Colors.muted, lineHeight: 21 },
  nextDueHint: { fontSize: FontSize.xs, color: Colors.muted, marginTop: -Spacing.sm, marginBottom: Spacing.sm, lineHeight: 17 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemMain: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, flex: 1 },
  itemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  historyIcon: { width: 35, height: 38, borderRadius: 12, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemDate: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 3, lineHeight: 18 },
  itemProduct: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  itemNotes: { fontSize: FontSize.xs, color: Colors.muted, fontStyle: 'italic', marginTop: 4, lineHeight: 18 },
  deleteAction: { width: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  costBadge: { backgroundColor: Colors.accentLight, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 5 },
  costText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.accent },
  combinedCta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: Spacing.md, paddingVertical: 13 },
  combinedCtaLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  combinedCtaSub: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 3 },
});
