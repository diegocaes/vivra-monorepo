import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../../constants/theme';
import { supabase } from '../../../lib/supabase';
import { useSubscription } from '../../../hooks/useSubscription';
import { formatDate } from '@vivra/shared';
import { usePetContext } from '../../../contexts/PetContext';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { FormField } from '../../../components/ui/FormField';
import { PremiumGate } from '../../../components/ui/PremiumGate';
import type { WeightRecord } from '../../../types/supabase';

// Mini weight chart
function WeightChart({ records }: { records: WeightRecord[] }) {
  if (records.length < 2) return null;

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const W = 320;
  const H = 160;
  const PAD = { top: 16, right: 16, bottom: 28, left: 44 };

  const weights = sorted.map(r => r.weight_kg);
  const minW = Math.min(...weights) - 0.5;
  const maxW = Math.max(...weights) + 0.5;
  const rangeW = maxW - minW || 1;

  const xScale = (i: number) => PAD.left + (i / (sorted.length - 1)) * (W - PAD.left - PAD.right);
  const yScale = (w: number) => PAD.top + (1 - (w - minW) / rangeW) * (H - PAD.top - PAD.bottom);

  // Build line path
  const linePath = sorted.map((r, i) => {
    const x = xScale(i);
    const y = yScale(r.weight_kg);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Area path for gradient fill
  const areaPath = linePath
    + ` L ${xScale(sorted.length - 1)} ${H - PAD.bottom}`
    + ` L ${PAD.left} ${H - PAD.bottom} Z`;

  // Date labels (show 3-5 evenly spaced)
  const labelCount = Math.min(sorted.length, 5);
  const labelIndices = Array.from({ length: labelCount }, (_, i) =>
    Math.round(i * (sorted.length - 1) / (labelCount - 1))
  );

  const formatShort = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <Card>
      <Text style={styles.chartTitle}>Evolución de peso</Text>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={Colors.accent} stopOpacity={0.15} />
            <Stop offset="1" stopColor={Colors.accent} stopOpacity={0.01} />
          </LinearGradient>
        </Defs>

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const w = minW + pct * rangeW;
          const y = yScale(w);
          return (
            <SvgText key={pct} x={PAD.left - 6} y={y + 4} textAnchor="end"
              fontSize={10} fill={Colors.muted}>
              {w.toFixed(1)}
            </SvgText>
          );
        })}

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = yScale(minW + pct * rangeW);
          return (
            <Line key={`g${pct}`} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke={Colors.cardBorder} strokeWidth={0.5} />
          );
        })}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#grad)" />

        {/* Line */}
        <Path d={linePath} fill="none" stroke={Colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {sorted.map((r, i) => (
          <Circle key={r.id} cx={xScale(i)} cy={yScale(r.weight_kg)}
            r={3.5} fill={Colors.card} stroke={Colors.accent} strokeWidth={2} />
        ))}

        {/* X-axis labels */}
        {labelIndices.map(idx => (
          <SvgText key={idx} x={xScale(idx)} y={H - 6} textAnchor="middle"
            fontSize={10} fill={Colors.muted}>
            {formatShort(sorted[idx].date)}
          </SvgText>
        ))}
      </Svg>
    </Card>
  );
}

export default function PesoScreen() {
  const router = useRouter();
  const { pet } = usePetContext();
  const { isPremium } = useSubscription();
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [weightKg, setWeightKg] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const fetchData = useCallback(async () => {
    if (!pet?.id) return;

    const { data } = await supabase
      .from('weight_records').select('*').eq('pet_id', pet.id).order('date', { ascending: false });
    setRecords((data as WeightRecord[]) ?? []);
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
    const kg = parseFloat(weightKg);
    if (!kg || kg <= 0) { Alert.alert('Error', 'Ingresa un peso válido'); return; }
    if (!date) { Alert.alert('Error', 'Ingresa la fecha'); return; }

    setSaving(true);
    const { error } = await supabase.from('weight_records').insert({
      pet_id: pet.id,
      weight_kg: kg,
      date,
      notes: notes || null,
    });

    // Update pet.weight_kg if this is the latest record
    if (!error) {
      const isLatest = records.length === 0 || date >= records[0].date;
      if (isLatest) {
        await supabase.from('pets').update({ weight_kg: kg }).eq('id', pet.id);
      }
    }

    setSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }

    setWeightKg(''); setNotes('');
    setDate(new Date().toISOString().slice(0, 10));
    setShowForm(false);
    fetchData();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar registro', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('weight_records').delete().eq('id', id).eq('pet_id', pet!.id);
          fetchData();
        },
      },
    ]);
  };

  // Stats
  const latest = records[0];
  const previous = records[1];
  const delta = latest && previous ? latest.weight_kg - previous.weight_kg : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={24} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Peso</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Current weight card */}
        {latest && (
          <Card style={styles.currentCard}>
            <Text style={styles.currentWeight}>{latest.weight_kg} kg</Text>
            {delta !== null && delta !== 0 && (
              <View style={styles.deltaRow}>
                <Ionicons
                  name={delta > 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={delta > 0 ? Colors.warn : Colors.good}
                />
                <Text style={[styles.deltaText, { color: delta > 0 ? Colors.warn : Colors.good }]}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg
                </Text>
              </View>
            )}
            <Text style={styles.currentDate}>Último registro: {formatDate(latest.date)}</Text>
          </Card>
        )}

        {/* Weight chart — premium feature */}
        {isPremium ? (
          <WeightChart records={records} />
        ) : records.length >= 2 ? (
          <Card>
            <View style={styles.chartLocked}>
              <Ionicons name="stats-chart" size={32} color={Colors.cardBorder} />
              <Text style={styles.chartLockedTitle}>Gráfico de evolución</Text>
              <Text style={styles.chartLockedDesc}>Ve tendencias de peso con el tiempo</Text>
              <PremiumGate feature="Los gráficos de peso" compact />
            </View>
          </Card>
        ) : null}

        {/* Advanced stats — premium */}
        {isPremium && records.length >= 3 && (
          <Card>
            <Text style={styles.chartTitle}>Estadísticas</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{Math.min(...records.map(r => r.weight_kg)).toFixed(1)}</Text>
                <Text style={styles.statLabel}>Mín (kg)</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{Math.max(...records.map(r => r.weight_kg)).toFixed(1)}</Text>
                <Text style={styles.statLabel}>Máx (kg)</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{(records.reduce((s, r) => s + r.weight_kg, 0) / records.length).toFixed(1)}</Text>
                <Text style={styles.statLabel}>Promedio</Text>
              </View>
            </View>
          </Card>
        )}

        {/* History list */}
        {records.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Ionicons name="scale-outline" size={48} color={Colors.cardBorder} />
            <Text style={styles.emptyText}>No hay registros de peso</Text>
          </View>
        ) : (
          records.map(r => (
            <Card key={r.id}>
              <View style={styles.recordRow}>
                <View style={styles.recordInfo}>
                  <Text style={styles.recordWeight}>{r.weight_kg} kg</Text>
                  <Text style={styles.recordDate}>{formatDate(r.date)}</Text>
                  {r.notes && <Text style={styles.recordNotes}>{r.notes}</Text>}
                </View>
                <TouchableOpacity onPress={() => handleDelete(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={20} color={Colors.muted} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <BottomSheet visible={showForm} onClose={() => setShowForm(false)} title="Registrar peso">
        <FormField
          label="Peso (kg)"
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="Ej: 12.5"
          keyboardType="decimal-pad"
        />
        <FormField
          label="Fecha"
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
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
  currentCard: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  currentWeight: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  deltaText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  currentDate: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: 4,
  },
  chartTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
    marginBottom: Spacing.sm,
  },
  chartLocked: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  chartLockedTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
    marginTop: Spacing.xs,
  },
  chartLockedDesc: {
    fontSize: FontSize.sm,
    color: Colors.muted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.canvas,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  recordInfo: { flex: 1 },
  recordWeight: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  recordDate: {
    fontSize: FontSize.sm,
    color: Colors.muted,
    marginTop: 2,
  },
  recordNotes: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: { fontSize: FontSize.md, color: Colors.muted },
});
