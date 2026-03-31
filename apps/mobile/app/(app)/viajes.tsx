import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { usePetContext } from '../../contexts/PetContext';
import { formatDate } from '@vivra/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FormField } from '../../components/ui/FormField';
import { SelectField } from '../../components/ui/SelectField';
import type { Flight } from '../../types/supabase';

const CABIN_OPTIONS = [
  { key: 'cabina', label: 'Cabina' },
  { key: 'bodega', label: 'Bodega' },
];

const CHECKLIST_ITEMS: { key: keyof Pick<Flight, 'vet_certificate' | 'health_certificate' | 'chip_verified' | 'vaccines_updated' | 'import_permit' | 'crate_approved'>; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'vet_certificate', label: 'Certificado veterinario', icon: 'document-text-outline' },
  { key: 'health_certificate', label: 'Certificado salud intl.', icon: 'medical-outline' },
  { key: 'chip_verified', label: 'Microchip verificado', icon: 'hardware-chip-outline' },
  { key: 'vaccines_updated', label: 'Vacunas al día', icon: 'medkit-outline' },
  { key: 'import_permit', label: 'Permiso de importación', icon: 'document-outline' },
  { key: 'crate_approved', label: 'Transportín IATA', icon: 'cube-outline' },
];

export default function ViajesScreen() {
  const { pet } = usePetContext();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null);
  const [airline, setAirline] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [flightDate, setFlightDate] = useState('');
  const [cabinOrCargo, setCabinOrCargo] = useState('cabina');
  const [ticketPrice, setTicketPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState({
    vet_certificate: false,
    health_certificate: false,
    chip_verified: false,
    vaccines_updated: false,
    import_permit: false,
    crate_approved: false,
  });

  const fetchData = useCallback(async () => {
    if (!pet) return;

    const { data } = await supabase
      .from('flights').select('*').eq('pet_id', pet.id).order('flight_date', { ascending: false });
    setFlights((data as Flight[]) ?? []);
  }, [pet?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const today = new Date().toISOString().slice(0, 10);
  const upcomingFlights = flights.filter(f => f.flight_date >= today);
  const pastFlights = flights.filter(f => f.flight_date < today);
  const displayFlights = tab === 'upcoming' ? upcomingFlights : pastFlights;

  const totalCost = flights.reduce((s, f) => s + (f.ticket_price ?? 0), 0);
  const destinations = new Set(flights.map(f => f.destination)).size;

  const resetForm = () => {
    setAirline(''); setFlightNumber(''); setOrigin(''); setDestination('');
    setFlightDate(''); setCabinOrCargo('cabina'); setTicketPrice(''); setNotes('');
    setChecklist({ vet_certificate: false, health_certificate: false, chip_verified: false, vaccines_updated: false, import_permit: false, crate_approved: false });
    setEditingFlight(null);
  };

  const openAdd = () => { resetForm(); setShowForm(true); };

  const openEdit = (f: Flight) => {
    setEditingFlight(f);
    setAirline(f.airline); setFlightNumber(f.flight_number ?? '');
    setOrigin(f.origin); setDestination(f.destination);
    setFlightDate(f.flight_date); setCabinOrCargo(f.cabin_or_cargo ?? 'cabina');
    setTicketPrice(f.ticket_price?.toString() ?? ''); setNotes(f.notes ?? '');
    setChecklist({
      vet_certificate: f.vet_certificate, health_certificate: f.health_certificate,
      chip_verified: f.chip_verified, vaccines_updated: f.vaccines_updated,
      import_permit: f.import_permit, crate_approved: f.crate_approved,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!pet) return;
    if (!airline.trim() || !origin.trim() || !destination.trim() || !flightDate.trim()) {
      Alert.alert('Error', 'Completa aerolínea, origen, destino y fecha'); return;
    }
    setSaving(true);
    const payload = {
      pet_id: pet.id,
      airline: airline.trim(),
      flight_number: flightNumber || null,
      origin: origin.trim(),
      destination: destination.trim(),
      flight_date: flightDate,
      cabin_or_cargo: cabinOrCargo,
      ticket_price: ticketPrice ? parseFloat(ticketPrice) : null,
      notes: notes || null,
      ...checklist,
    };
    const { error } = editingFlight
      ? await supabase.from('flights').update(payload).eq('id', editingFlight.id)
      : await supabase.from('flights').insert(payload);
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    resetForm(); setShowForm(false); fetchData();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar vuelo', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await supabase.from('flights').delete().eq('id', id); fetchData(); } },
    ]);
  };

  function daysUntil(date: string): number {
    return Math.ceil((new Date(date + 'T00:00:00').getTime() - Date.now()) / 86400000);
  }

  function checklistProgress(f: Flight): number {
    const done = [f.vet_certificate, f.health_certificate, f.chip_verified, f.vaccines_updated, f.import_permit, f.crate_approved].filter(Boolean).length;
    return Math.round((done / 6) * 100);
  }

  const toggleCheck = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Viajes</Text>
        <TouchableOpacity onPress={openAdd}>
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
            <Text style={styles.statValue}>{flights.length}</Text>
            <Text style={styles.statLabel}>Vuelos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{destinations}</Text>
            <Text style={styles.statLabel}>Destinos</Text>
          </View>
          {totalCost > 0 && (
            <View style={styles.statBox}>
              <Text style={styles.statValue} numberOfLines={1}>${totalCost}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'upcoming' && styles.tabActive]} onPress={() => setTab('upcoming')}>
            <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>
              Próximos {upcomingFlights.length > 0 ? `(${upcomingFlights.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === 'past' && styles.tabActive]} onPress={() => setTab('past')}>
            <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>
              Historial {pastFlights.length > 0 ? `(${pastFlights.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Flight list */}
        {displayFlights.length === 0 ? (
          <Card>
            <View style={styles.emptyCard}>
              <Ionicons name="airplane-outline" size={36} color={Colors.cardBorder} />
              <Text style={styles.emptyTitle}>
                {tab === 'upcoming' ? 'No hay vuelos próximos' : 'Sin vuelos anteriores'}
              </Text>
              <Text style={styles.emptyText}>Registra los vuelos de tu mascota</Text>
              {tab === 'upcoming' && (
                <Button title="Agregar vuelo" onPress={openAdd} style={{ marginTop: Spacing.sm }} />
              )}
            </View>
          </Card>
        ) : (
          displayFlights.map(flight => {
            const days = daysUntil(flight.flight_date);
            const progress = checklistProgress(flight);
            return (
              <TouchableOpacity key={flight.id} activeOpacity={0.7} onPress={() => openEdit(flight)}>
                <Card>
                  <View style={styles.flightHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.flightRoute} numberOfLines={1}>{flight.origin} → {flight.destination}</Text>
                      <Text style={styles.flightAirline} numberOfLines={1}>
                        {flight.airline}{flight.flight_number ? ` · ${flight.flight_number}` : ''}
                      </Text>
                    </View>
                    {tab === 'upcoming' && days >= 0 && (
                      <View style={[styles.daysBadge, { backgroundColor: days <= 3 ? Colors.bad + '18' : Colors.accent + '18' }]}>
                        <Text style={[styles.daysBadgeText, { color: days <= 3 ? Colors.bad : Colors.accent }]}>
                          {days === 0 ? 'HOY' : days === 1 ? 'MAÑANA' : `${days}d`}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.flightMeta}>
                    <Text style={styles.flightDate}>{formatDate(flight.flight_date)}</Text>
                    <View style={styles.cabinRow}>
                      <Ionicons name={flight.cabin_or_cargo === 'cabina' ? 'airplane' : 'cube'} size={14} color={Colors.muted} />
                      <Text style={styles.flightCabin}>{flight.cabin_or_cargo === 'cabina' ? 'Cabina' : 'Bodega'}</Text>
                    </View>
                    {flight.ticket_price !== null && flight.ticket_price > 0 && (
                      <Text style={styles.flightPrice}>${flight.ticket_price}</Text>
                    )}
                  </View>

                  {/* Checklist progress bar */}
                  <View style={styles.checkProgressRow}>
                    <View style={styles.checkProgressBg}>
                      <View style={[styles.checkProgressFill, { width: `${progress}%`, backgroundColor: progress === 100 ? Colors.good : Colors.accent }]} />
                    </View>
                    <Text style={styles.checkProgressText}>{progress}%</Text>
                  </View>

                  <View style={styles.flightActions}>
                    <TouchableOpacity onPress={() => handleDelete(flight.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={18} color={Colors.muted} />
                    </TouchableOpacity>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Flight form */}
      <BottomSheet visible={showForm} onClose={() => setShowForm(false)} title={editingFlight ? 'Editar vuelo' : 'Nuevo vuelo'}>
        <FormField label="Aerolínea" value={airline} onChangeText={setAirline} placeholder="Ej: Copa Airlines" />
        <FormField label="Nro. de vuelo (opcional)" value={flightNumber} onChangeText={setFlightNumber} placeholder="Ej: CM 391" />
        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <FormField label="Origen" value={origin} onChangeText={setOrigin} placeholder="Ej: PTY" />
          </View>
          <View style={{ flex: 1 }}>
            <FormField label="Destino" value={destination} onChangeText={setDestination} placeholder="Ej: MIA" />
          </View>
        </View>
        <FormField label="Fecha del vuelo" value={flightDate} onChangeText={setFlightDate} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <SelectField label="Tipo" value={cabinOrCargo} options={CABIN_OPTIONS} onSelect={setCabinOrCargo} />
        <FormField label="Precio ticket (USD)" value={ticketPrice} onChangeText={setTicketPrice} placeholder="0.00" keyboardType="decimal-pad" />
        <FormField label="Notas (opcional)" value={notes} onChangeText={setNotes} placeholder="Detalles adicionales..." multiline style={{ minHeight: 60 }} />

        {/* Document checklist */}
        <Text style={styles.checklistTitle}>Documentos</Text>
        {CHECKLIST_ITEMS.map(item => (
          <TouchableOpacity key={item.key} style={styles.checkItem} onPress={() => toggleCheck(item.key)} activeOpacity={0.7}>
            <Ionicons
              name={checklist[item.key] ? 'checkbox' : 'square-outline'}
              size={22}
              color={checklist[item.key] ? Colors.good : Colors.muted}
            />
            <Ionicons name={item.icon} size={16} color={Colors.muted} style={{ marginRight: 4 }} />
            <Text style={styles.checkLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}

        <Button title="Guardar" onPress={handleSave} loading={saving} style={{ marginTop: Spacing.md }} />
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
  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, alignItems: 'center',
  },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },
  statLabel: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  // Tabs
  tabRow: { flexDirection: 'row', gap: Spacing.sm, marginVertical: Spacing.xs },
  tabBtn: {
    flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder,
  },
  tabActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.muted },
  tabTextActive: { color: Colors.white },
  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.md },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  // Flight card
  flightHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  flightRoute: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.ink },
  flightAirline: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  daysBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  daysBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  flightMeta: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs, flexWrap: 'wrap' },
  flightDate: { fontSize: FontSize.xs, color: Colors.muted },
  cabinRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  flightCabin: { fontSize: FontSize.xs, color: Colors.muted },
  flightPrice: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.accent },
  // Checklist progress
  checkProgressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  checkProgressBg: { flex: 1, height: 4, backgroundColor: Colors.cardBorder, borderRadius: Radius.full, overflow: 'hidden' },
  checkProgressFill: { height: 4, borderRadius: Radius.full },
  checkProgressText: { fontSize: FontSize.xs, color: Colors.muted, width: 32, textAlign: 'right' },
  // Actions
  flightActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.xs },
  // Form
  formRow: { flexDirection: 'row', gap: Spacing.sm },
  checklistTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: Spacing.md, marginBottom: Spacing.xs },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  checkLabel: { fontSize: FontSize.sm, color: Colors.ink },
});
