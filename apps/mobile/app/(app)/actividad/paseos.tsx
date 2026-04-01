import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { usePetContext } from '../../../contexts/PetContext';
import { formatDate } from '@vivra/shared';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { SelectField } from '../../../components/ui/SelectField';
import { FormField } from '../../../components/ui/FormField';

interface ActivityLog {
  id: string;
  date: string;
  walks: number;
  duration_minutes: number | null;
  notes: string | null;
}

const WALK_OPTIONS = [
  { key: '1', label: '1 paseo' },
  { key: '2', label: '2 paseos' },
  { key: '3', label: '3 paseos' },
  { key: '4', label: '4+ paseos' },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function PaseosScreen() {
  const router = useRouter();
  const { pet, refresh: refreshPetData } = usePetContext();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [walks, setWalks] = useState('1');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async () => {
    if (!pet) return;
    const { data } = await supabase
      .from('activity_logs')
      .select('id, date, walks, duration_minutes, notes')
      .eq('pet_id', pet.id)
      .order('date', { ascending: false })
      .limit(30);
    setLogs((data as ActivityLog[]) ?? []);
  }, [pet?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const resetForm = () => {
    setDate(todayISO());
    setWalks('1');
    setDuration('');
    setNotes('');
  };

  const handleSave = async () => {
    if (!pet) return;
    const walksNum = parseInt(walks, 10);
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Error', 'Usa el formato YYYY-MM-DD para la fecha'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('activity_logs').insert({
      pet_id: pet.id,
      date,
      walks: walksNum,
      duration_minutes: duration ? parseInt(duration, 10) : null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    resetForm();
    setShowForm(false);
    fetchData();
    refreshPetData();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar registro', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          await supabase.from('activity_logs').delete().eq('id', id);
          fetchData();
          refreshPetData();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Paseos</Text>
        <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }}>
          <Ionicons name="add-circle" size={28} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Stats cards */}
        {logs.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{logs.reduce((s, l) => s + l.walks, 0)}</Text>
              <Text style={styles.statLabel}>Total paseos</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{logs.length}</Text>
              <Text style={styles.statLabel}>Registros</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>
                {logs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0) > 0
                  ? `${logs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0)}m`
                  : '—'}
              </Text>
              <Text style={styles.statLabel}>Minutos</Text>
            </View>
          </View>
        )}

        {logs.length === 0 ? (
          <Card>
            <View style={styles.emptyCard}>
              <Ionicons name="walk-outline" size={40} color={Colors.cardBorder} />
              <Text style={styles.emptyTitle}>Sin paseos registrados</Text>
              <Text style={styles.emptyText}>Registra los paseos diarios de {pet?.name ?? 'tu mascota'}</Text>
              <Button title="Registrar paseo" onPress={() => { resetForm(); setShowForm(true); }} style={{ marginTop: Spacing.sm }} />
            </View>
          </Card>
        ) : (
          logs.map(log => {
            const active = log.walks > 0;
            return (
              <TouchableOpacity key={log.id} activeOpacity={0.7} onPress={() => handleDelete(log.id)}>
                <Card>
                  <View style={styles.logRow}>
                    <View style={[styles.dot, { backgroundColor: active ? Colors.good : Colors.bad }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logDate}>{formatDate(log.date)}</Text>
                      <Text style={styles.logDetail}>
                        {active
                          ? `${log.walks} paseo${log.walks !== 1 ? 's' : ''}${log.duration_minutes ? ` · ${log.duration_minutes} min` : ''}`
                          : 'Sin actividad'}
                      </Text>
                      {log.notes ? <Text style={styles.logNotes} numberOfLines={1}>{log.notes}</Text> : null}
                    </View>
                    <Ionicons name="trash-outline" size={18} color={Colors.cardBorder} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <BottomSheet visible={showForm} onClose={() => setShowForm(false)} title="Registrar paseo">
        <FormField
          label="Fecha"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
        />
        <SelectField label="Paseos" value={walks} options={WALK_OPTIONS} onSelect={setWalks} />
        <FormField
          label="Duración (minutos)"
          value={duration}
          onChangeText={setDuration}
          placeholder="Ej: 30"
          keyboardType="number-pad"
        />
        <FormField
          label="Notas (opcional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="¿Cómo estuvo el paseo?"
          multiline
          style={{ minHeight: 60 }}
        />
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
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  statBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, alignItems: 'center',
  },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },
  statLabel: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.md },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2, textAlign: 'center' },
  // Log row
  logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  logDate: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  logDetail: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 1 },
  logNotes: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 1, fontStyle: 'italic' },
});
