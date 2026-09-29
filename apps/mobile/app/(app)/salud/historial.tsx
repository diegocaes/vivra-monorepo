import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { formatDate, friendlyError, formatCurrency, sumAmounts, localDateKey } from '@vivra/shared';
import { usePetContext } from '../../../contexts/PetContext';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { Card } from '../../../components/ui/Card';
import { DatePickerField } from '../../../components/ui/DatePickerField';
import { Button } from '../../../components/ui/Button';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { FormField } from '../../../components/ui/FormField';
import type { VetVisit } from '@vivra/shared/lib/database';
import { track } from '../../../lib/analytics';
import { HealthPetIdentity } from '../../../components/health/HealthPetIdentity';
import { HealthTabs, type HealthTab } from '../../../components/health/HealthTabs';
import { DataLoadNotice } from '../../../components/shared/DataLoadNotice';
import { useRemoteData } from '../../../hooks/useRemoteData';
import { useAuth } from '../../../hooks/useAuth';
import { HistoryChart } from '../../../components/pet/HistoryChart';

export default function HistorialScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [activeTab, setActiveTab] = useState<HealthTab>('summary');
  const { isPremium } = useSubscription();
  const { pet, refresh: refreshPetData } = usePetContext();
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingVisit, setEditingVisit] = useState<VetVisit | null>(null);

  // Form
  const [date, setDate] = useState(localDateKey());
  const [reason, setReason] = useState('');
  const [vetName, setVetName] = useState('');
  const [location, setLocation] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');

  const loadVisits = useCallback(async (signal: AbortSignal) => {
    const { data, error } = await supabase
      .from('vet_visits').select('*').eq('pet_id', pet!.id).order('date', { ascending: false }).abortSignal(signal);
    if (error) throw error;
    return data ?? [];
  }, [pet?.id]);
  const { data, loading, error: loadError, refresh: fetchData } = useRemoteData(pet?.id ? `vet-visits:${user?.id}:${pet.id}` : null, loadVisits);
  const visits = data ?? [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshPetData()]);
    setRefreshing(false);
  }, [fetchData, refreshPetData]);

  const resetForm = () => {
    setDate(localDateKey());
    setReason(''); setVetName(''); setLocation('');
    setDiagnosis(''); setTreatment(''); setCost(''); setNotes('');
    setEditingVisit(null);
  };

  const openNew = () => { resetForm(); setShowForm(true); };

  useEffect(() => {
    if (add) {
      openNew();
      router.setParams({ add: undefined });
    }
  }, [add]);

  const openEdit = (v: VetVisit) => {
    setEditingVisit(v);
    setDate(v.date);
    setReason(v.reason);
    setVetName(v.vet_name ?? '');
    setLocation(v.location ?? '');
    setDiagnosis(v.diagnosis ?? '');
    setTreatment(v.treatment ?? '');
    setCost(v.cost?.toString() ?? '');
    setNotes(v.notes ?? '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!pet) return;
    if (!reason.trim()) { Alert.alert('Error', 'Ingresa el motivo de la visita'); return; }
    if (!date) { Alert.alert('Error', 'Ingresa la fecha'); return; }

    setSaving(true);
    const payload = {
      date,
      reason: reason.trim(),
      vet_name: vetName || null,
      location: location || null,
      diagnosis: diagnosis || null,
      treatment: treatment || null,
      cost: cost ? parseFloat(cost) : null,
      notes: notes || null,
    };
    const { error } = editingVisit
      ? await supabase.from('vet_visits').update(payload).eq('id', editingVisit.id).eq('pet_id', pet.id)
      : await supabase.from('vet_visits').insert({ ...payload, pet_id: pet.id });
    setSaving(false);

    if (error) {
      console.warn('[historial] save error:', error.message);
      Alert.alert('Error', friendlyError(error));
      return;
    }

    // Solo se registra el guardado exitoso: los intentos fallidos ya se ven
    // en Sentry y aquí solo ensuciarían las métricas de uso.
    track('crud', `vet_visit_${editingVisit ? 'editar' : 'crear'}`);
    resetForm();
    setShowForm(false);
    await Promise.all([fetchData(), refreshPetData()]);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar visita', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('vet_visits').delete().eq('id', id).eq('pet_id', pet!.id);
          if (error) { Alert.alert('No se pudo eliminar', friendlyError(error)); return; }
          await Promise.all([fetchData(), refreshPetData()]);
        },
      },
    ]);
  };

  // Stats
  // Mismo criterio y formato que el perfil. `toLocaleString()` además dependía
  // del idioma del teléfono: en español salía "427,99" y en el perfil "427.99".
  const totalCost = sumAmounts(visits, 'cost');
  const lastVisit = visits[0];
  const visitsThisYear = visits.filter(visit => visit.date.slice(0, 4) === String(new Date().getFullYear())).length;
  const visibleVisits = activeTab === 'summary' ? visits.slice(0, 3) : visits;

  return (
    <SafeAreaView testID="screen-vet-visits" style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Volver a Salud" onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/salud')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Visitas veterinarias</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <HealthPetIdentity />
        <HealthTabs value={activeTab} onChange={setActiveTab} />
        <DataLoadNotice message={loadError ? 'No pudimos cargar las visitas. Inténtalo de nuevo.' : null} onRetry={fetchData} />
        {loading ? (
          <View style={styles.empty}><ActivityIndicator color={Colors.accent} /><Text style={styles.emptyText}>Cargando visitas…</Text></View>
        ) : loadError ? null : (
          <>
            {activeTab === 'summary' ? (
              <>
                <Card style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Ionicons name="medical-outline" size={22} color={Colors.blue} />
                    <Text style={styles.statValue}>{visitsThisYear}</Text>
                    <Text style={styles.statLabel}>Visitas este año</Text>
                  </View>
                  <View style={[styles.statBox, styles.statDivider]}>
                    <Ionicons name="calendar-outline" size={22} color={Colors.blue} />
                    <Text style={styles.statLabel}>Última visita</Text>
                    <Text style={styles.statDetail}>{lastVisit ? formatDate(lastVisit.date) : 'Sin registro'}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Ionicons name="person-outline" size={22} color={Colors.blue} />
                    <Text style={styles.statLabel}>Último veterinario</Text>
                    <Text style={styles.statDetail}>{lastVisit?.vet_name || 'Sin registrar'}</Text>
                  </View>
                </Card>
                {lastVisit && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Última visita</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Ver última visita: ${lastVisit.reason}`} style={styles.latestCard} onPress={() => openEdit(lastVisit)} activeOpacity={0.75}>
                      <View style={styles.latestIcon}><Ionicons name="medkit-outline" size={25} color={Colors.accent} /></View>
                      <View style={styles.visitInfo}>
                        <Text style={styles.latestTitle}>{lastVisit.reason}</Text>
                        <Text style={styles.visitDetail}>{formatDate(lastVisit.date)}{lastVisit.location ? ` · ${lastVisit.location}` : ''}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <>
                <Card style={styles.expenseRow}>
                  <View><Text style={styles.sectionTitle}>Historial veterinario</Text><Text style={styles.visitDetail}>{visits.length} visita{visits.length === 1 ? '' : 's'} registrada{visits.length === 1 ? '' : 's'}</Text></View>
                  {isPremium ? <View style={styles.expenseTotal}><Text style={styles.statValue}>${formatCurrency(totalCost)}</Text><Text style={styles.statLabel}>Total gastado</Text></View> : (
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Ver total gastado con Vivra Premium" style={styles.expenseTotal} onPress={() => router.push('/paywall' as any)} activeOpacity={0.8}>
                      <Ionicons name="lock-closed" size={17} color={Colors.muted} /><Text style={styles.statLabel}>Total gastado</Text>
                    </TouchableOpacity>
                  )}
                </Card>
                <HistoryChart items={visits.map(v => ({ date: v.date, amount: v.cost }))} noun="visitas" showMoney={isPremium} />
              </>
            )}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{activeTab === 'summary' ? 'Últimas visitas' : 'Todas las visitas'}</Text>
                {activeTab === 'summary' && visits.length > 0 && (
                  <TouchableOpacity accessibilityRole="button" onPress={() => setActiveTab('history')} style={styles.viewAll}><Text style={styles.viewAllText}>Ver todas</Text><Ionicons name="chevron-forward" size={15} color={Colors.accent} /></TouchableOpacity>
                )}
              </View>
              {visits.length === 0 ? (
                <Card style={styles.empty}>
                  <Ionicons name="medical-outline" size={38} color={Colors.blue} />
                  <Text style={styles.emptyTitle}>Sin visitas registradas</Text>
                  <Text style={styles.emptyText}>Guarda el motivo, las indicaciones y el costo de cada consulta.</Text>
                </Card>
              ) : (
                <Card padded={false}>
                  {visibleVisits.map((v, index) => (
                    <View key={v.id} style={[styles.visitRow, index < visibleVisits.length - 1 && styles.rowBorder]}>
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Ver visita ${v.reason}, ${formatDate(v.date)}`} activeOpacity={0.7} onPress={() => openEdit(v)} style={styles.visitMain}>
                        <View style={styles.visitIcon}><Ionicons name="calendar-outline" size={19} color={Colors.blue} /></View>
                        <View style={styles.visitInfo}>
                          <Text style={styles.visitReason}>{v.reason}</Text>
                          <Text style={styles.visitDate}>{formatDate(v.date)}</Text>
                          {(v.location || v.vet_name) && <Text style={styles.visitDetail}>{v.location || v.vet_name}</Text>}
                          {activeTab === 'history' && <>
                            {v.location && v.vet_name && <Text style={styles.visitDetail}>{v.vet_name}</Text>}
                            {v.diagnosis && <Text style={styles.visitDiagnosis}>Diagnóstico: {v.diagnosis}</Text>}
                            {v.treatment && <Text style={styles.visitDetail}>Tratamiento: {v.treatment}</Text>}
                            {v.notes && <Text style={styles.visitNotes}>{v.notes}</Text>}
                            {v.cost !== null && v.cost > 0 && <View style={styles.costBadge}><Text style={styles.costText}>${formatCurrency(v.cost)}</Text></View>}
                          </>}
                        </View>
                        <Ionicons name="chevron-forward" size={17} color={Colors.muted} />
                      </TouchableOpacity>
                      {activeTab === 'history' && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Eliminar visita ${v.reason}`} onPress={() => handleDelete(v.id)} style={styles.deleteAction}><Ionicons name="trash-outline" size={19} color={Colors.muted} /></TouchableOpacity>}
                    </View>
                  ))}
                </Card>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}><Button title="Agregar visita" onPress={openNew} /></View>

      <BottomSheet visible={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingVisit ? 'Editar visita' : 'Agregar visita'} footer={<Button title="Guardar" onPress={handleSave} loading={saving} />}>
        <FormField label="Motivo" value={reason} onChangeText={setReason} placeholder="Ej: Revisión anual, Urgencia..." />
        <DatePickerField label="Fecha" value={date} onChange={setDate} maxDate={new Date()} />
        <FormField label="Veterinario (opcional)" value={vetName} onChangeText={setVetName} placeholder="Nombre del veterinario" />
        <FormField label="Clínica / Ubicación (opcional)" value={location} onChangeText={setLocation} placeholder="Nombre de la clínica" />
        <FormField label="Diagnóstico (opcional)" value={diagnosis} onChangeText={setDiagnosis} placeholder="Diagnóstico..." multiline style={{ minHeight: 60 }} />
        <FormField label="Tratamiento (opcional)" value={treatment} onChangeText={setTreatment} placeholder="Medicamentos, instrucciones..." multiline style={{ minHeight: 60 }} />
        <FormField label="Costo (opcional)" value={cost} onChangeText={setCost} placeholder="0.00" keyboardType="decimal-pad" />
        <FormField label="Notas (opcional)" value={notes} onChangeText={setNotes} placeholder="Observaciones..." multiline style={{ minHeight: 60 }} />
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
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.lg },
  statBox: { flex: 1, gap: 5, alignItems: 'center', paddingHorizontal: Spacing.xs },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: Colors.cardBorder },
  statValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  statLabel: { fontSize: 10, color: Colors.muted, textAlign: 'center' },
  statDetail: { fontSize: FontSize.xs, color: Colors.ink, textAlign: 'center', lineHeight: 18 },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  viewAllText: { fontSize: FontSize.xs, color: Colors.accent },
  latestCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: Colors.accentLight },
  latestIcon: { width: 45, height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF5EA' },
  latestTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.accent },
  expenseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  expenseTotal: { alignItems: 'center', gap: 3 },
  visitRow: { flexDirection: 'row', alignItems: 'center' },
  visitMain: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', padding: Spacing.md, flex: 1 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  visitIcon: { width: 36, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF0F2' },
  visitInfo: { flex: 1 },
  visitReason: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  visitDate: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 3 },
  visitDetail: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 3, lineHeight: 18 },
  visitDiagnosis: { fontSize: FontSize.xs, color: Colors.ink, marginTop: 5, fontWeight: FontWeight.medium, lineHeight: 18 },
  visitNotes: { fontSize: FontSize.xs, color: Colors.muted, fontStyle: 'italic', marginTop: 4, lineHeight: 18 },
  deleteAction: { width: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  costBadge: { alignSelf: 'flex-start', backgroundColor: Colors.accentLight, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, marginTop: 6 },
  costText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.accent },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, textAlign: 'center' },
  emptyText: { fontSize: FontSize.sm, lineHeight: 21, color: Colors.muted, textAlign: 'center' },
});
