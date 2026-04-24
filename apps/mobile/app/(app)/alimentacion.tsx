import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Text as SvgText, Line, G } from 'react-native-svg';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { usePetContext } from '../../contexts/PetContext';
import { useSubscription } from '../../hooks/useSubscription';
import { formatDate } from '@vivra/shared';
import { FOOD_TYPES } from '@vivra/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FormField } from '../../components/ui/FormField';
import { DatePickerField } from '../../components/ui/DatePickerField';
import { SelectField } from '../../components/ui/SelectField';
import type { Food, Treat } from '../../types/supabase';

const FOOD_OPTIONS = Object.entries(FOOD_TYPES).map(([key, label]) => ({ key, label }));
const UNIT_OPTIONS = [
  { key: 'kg', label: 'kg' },
  { key: 'g', label: 'g' },
  { key: 'lb', label: 'lb' },
];
const FREQUENCY_OPTIONS = [
  { key: '1x', label: '1 vez al día' },
  { key: '2x', label: '2 veces al día' },
  { key: '3x', label: '3 veces al día' },
  { key: 'libre', label: 'Libre acceso' },
];

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function TreatSpendChart({ treats }: { treats: Treat[] }) {
  const monthly = useMemo(() => {
    const now = new Date();
    const months: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const total = treats
        .filter(t => t.price && t.purchase_date?.startsWith(key))
        .reduce((s, t) => s + (t.price ?? 0), 0);
      months.push({ label: MONTH_LABELS[d.getMonth()], total });
    }
    return months;
  }, [treats]);

  const maxVal = Math.max(...monthly.map(m => m.total), 1);
  const W = 320;
  const H = 140;
  const PAD = { top: 12, bottom: 24, left: 8, right: 8 };
  const barW = 32;
  const gap = (W - PAD.left - PAD.right - barW * 6) / 5;

  return (
    <Card>
      <Text style={styles.chartTitle}>Gasto en snacks (últimos 6 meses)</Text>
      <Svg width={W} height={H}>
        <Line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke={Colors.cardBorder} strokeWidth={1} />
        {monthly.map((m, i) => {
          const x = PAD.left + i * (barW + gap);
          const barH = maxVal > 0 ? (m.total / maxVal) * (H - PAD.top - PAD.bottom) : 0;
          const y = H - PAD.bottom - barH;
          return (
            <G key={i}>
              {m.total > 0 && (
                <Rect x={x} y={y} width={barW} height={barH} rx={4} fill={Colors.accent} opacity={0.8} />
              )}
              {m.total > 0 && (
                <SvgText x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill={Colors.ink}>
                  ${m.total}
                </SvgText>
              )}
              <SvgText x={x + barW / 2} y={H - PAD.bottom + 14} textAnchor="middle" fontSize={10} fill={Colors.muted}>
                {m.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
    </Card>
  );
}

function bagToGrams(size: number, unit: string): number {
  if (unit === 'kg') return size * 1000;
  if (unit === 'lb') return size * 453.592;
  return size;
}

interface FoodWithCalc extends Food {
  daysTotal: number | null;
  daysRemaining: number | null;
  progressPct: number | null;
}

function enrichFood(food: Food): FoodWithCalc {
  const totalGrams = food.bag_size ? bagToGrams(food.bag_size, food.bag_unit ?? 'kg') : null;
  const daysTotal = (totalGrams && food.daily_grams) ? Math.floor(totalGrams / food.daily_grams) : null;
  // Use start_date if the user set one; otherwise fall back to created_at so
  // pets with older rows still show a bag-progress bar instead of an empty state.
  const bagStartStr = food.start_date || food.created_at || null;
  const bagStart = bagStartStr
    ? new Date(bagStartStr.length > 10 ? bagStartStr : bagStartStr + 'T00:00:00')
    : null;
  const daysElapsed = bagStart
    ? Math.floor((Date.now() - bagStart.getTime()) / 86400000)
    : null;
  const daysRemaining = (daysTotal && daysElapsed !== null)
    ? Math.max(0, daysTotal - daysElapsed)
    : null;
  const progressPct = (daysTotal && daysRemaining !== null)
    ? Math.round((daysRemaining / daysTotal) * 100)
    : null;
  return { ...food, daysTotal, daysRemaining, progressPct };
}

export default function AlimentacionScreen() {
  const router = useRouter();
  const { pet } = usePetContext();
  const { isPremium } = useSubscription();
  const [foods, setFoods] = useState<FoodWithCalc[]>([]);
  const [treats, setTreats] = useState<Treat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Food form
  const [showFoodForm, setShowFoodForm] = useState(false);
  const [savingFood, setSavingFood] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [brand, setBrand] = useState('');
  const [foodType, setFoodType] = useState('');
  const [dailyGrams, setDailyGrams] = useState('');
  const [frequency, setFrequency] = useState('');
  const [bagSize, setBagSize] = useState('');
  const [bagUnit, setBagUnit] = useState('kg');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [foodNotes, setFoodNotes] = useState('');

  // Treat form
  const [showTreatForm, setShowTreatForm] = useState(false);
  const [savingTreat, setSavingTreat] = useState(false);
  const [editingTreat, setEditingTreat] = useState<Treat | null>(null);
  const [treatName, setTreatName] = useState('');
  const [treatBrand, setTreatBrand] = useState('');
  const [treatPrice, setTreatPrice] = useState('');
  const [treatDate, setTreatDate] = useState(new Date().toISOString().slice(0, 10));
  const [treatNotes, setTreatNotes] = useState('');

  const fetchData = useCallback(async () => {
    if (!pet) { setLoading(false); return; }

    const [foodsRes, treatsRes] = await Promise.all([
      supabase.from('foods').select('*').eq('pet_id', pet.id).order('created_at', { ascending: false }),
      supabase.from('treats').select('*').eq('pet_id', pet.id).order('created_at', { ascending: false }),
    ]);

    if (foodsRes.error) console.warn('[Alimentacion] foods error:', foodsRes.error.message);
    if (treatsRes.error) console.warn('[Alimentacion] treats error:', treatsRes.error.message);
    setFoods(((foodsRes.data as Food[]) ?? []).map(enrichFood));
    setTreats((treatsRes.data as Treat[]) ?? []);
    setLoading(false);
  }, [pet?.id]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Food form helpers
  const resetFoodForm = () => {
    setBrand(''); setFoodType(''); setDailyGrams(''); setFrequency('');
    setBagSize(''); setBagUnit('kg'); setStartDate(new Date().toISOString().slice(0, 10));
    setFoodNotes(''); setEditingFood(null);
  };

  const openAddFood = () => { resetFoodForm(); setShowFoodForm(true); };

  const duplicateFromFood = (food: Food) => {
    setBrand(food.brand);
    setFoodType(food.food_type ?? food.type ?? '');
    setDailyGrams(food.daily_grams?.toString() ?? '');
    setFrequency(food.frequency ?? '');
    setBagSize(food.bag_size?.toString() ?? '');
    setBagUnit(food.bag_unit ?? 'kg');
    setStartDate(new Date().toISOString().slice(0, 10));
    setFoodNotes(food.notes ?? '');
    setEditingFood(null);
  };

  const duplicateFromTreat = (treat: Treat) => {
    setTreatName(treat.name);
    setTreatBrand(treat.brand ?? '');
    setTreatPrice(treat.price?.toString() ?? '');
    setTreatDate(new Date().toISOString().slice(0, 10));
    setTreatNotes(treat.notes ?? '');
  };

  const openEditFood = (food: Food) => {
    setEditingFood(food);
    setBrand(food.brand);
    setFoodType(food.food_type ?? food.type ?? '');
    setDailyGrams(food.daily_grams?.toString() ?? '');
    setFrequency(food.frequency ?? '');
    setBagSize(food.bag_size?.toString() ?? '');
    setBagUnit(food.bag_unit ?? 'kg');
    setStartDate(food.start_date ?? new Date().toISOString().slice(0, 10));
    setFoodNotes(food.notes ?? '');
    setShowFoodForm(true);
  };

  const handleSaveFood = async () => {
    if (!pet) return;
    if (!brand.trim()) { Alert.alert('Error', 'Ingresa la marca'); return; }

    setSavingFood(true);
    const payload = {
      pet_id: pet.id,
      brand: brand.trim(),
      food_type: foodType || null,
      type: foodType || null,
      daily_grams: dailyGrams ? parseFloat(dailyGrams) : null,
      frequency: frequency || null,
      bag_size: bagSize ? parseFloat(bagSize) : null,
      bag_unit: bagUnit,
      start_date: startDate || null,
      notes: foodNotes || null,
    };

    const { error } = editingFood
      ? await supabase.from('foods').update(payload).eq('id', editingFood.id)
      : await supabase.from('foods').insert(payload);

    setSavingFood(false);
    if (error) { Alert.alert('Error', error.message); return; }
    resetFoodForm();
    setShowFoodForm(false);
    fetchData();
  };

  const handleDeleteFood = (id: string) => {
    Alert.alert('Eliminar alimento', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('foods').delete().eq('id', id);
          fetchData();
        },
      },
    ]);
  };

  // Treat form helpers
  const resetTreatForm = () => {
    setTreatName(''); setTreatBrand(''); setTreatPrice('');
    setTreatDate(new Date().toISOString().slice(0, 10)); setTreatNotes('');
    setEditingTreat(null);
  };

  const openEditTreat = (treat: Treat) => {
    setEditingTreat(treat);
    setTreatName(treat.name);
    setTreatBrand(treat.brand ?? '');
    setTreatPrice(treat.price?.toString() ?? '');
    setTreatDate(treat.purchase_date ?? new Date().toISOString().slice(0, 10));
    setTreatNotes(treat.notes ?? '');
    setShowTreatForm(true);
  };

  const handleSaveTreat = async () => {
    if (!pet) return;
    if (!treatName.trim()) { Alert.alert('Error', 'Ingresa el nombre del snack'); return; }

    setSavingTreat(true);
    const payload = {
      name: treatName.trim(),
      brand: treatBrand || null,
      price: treatPrice ? parseFloat(treatPrice) : null,
      purchase_date: treatDate || null,
      notes: treatNotes || null,
    };
    const { error } = editingTreat
      ? await supabase.from('treats').update(payload).eq('id', editingTreat.id)
      : await supabase.from('treats').insert({ ...payload, pet_id: pet.id });
    setSavingTreat(false);
    if (error) { Alert.alert('Error', error.message); return; }
    resetTreatForm();
    setShowTreatForm(false);
    fetchData();
  };

  const handleDeleteTreat = (id: string) => {
    Alert.alert('Eliminar snack', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('treats').delete().eq('id', id);
          fetchData();
        },
      },
    ]);
  };

  const currentFood = foods[0] ?? null;
  const totalTreatSpend = treats.filter(t => t.price).reduce((s, t) => s + (t.price ?? 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Alimentación</Text>
        <TouchableOpacity onPress={openAddFood}>
          <Ionicons name="add-circle" size={28} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Active food hero */}
        {currentFood ? (
          <TouchableOpacity activeOpacity={0.7} onPress={() => openEditFood(currentFood)}>
            <Card>
              <Text style={styles.heroLabel}>ALIMENTO ACTUAL</Text>
              <View style={styles.heroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroBrand} numberOfLines={1}>{currentFood.brand}</Text>
                  <Text style={styles.heroSub}>
                    {FOOD_TYPES[currentFood.food_type ?? currentFood.type ?? ''] ?? ''}
                    {currentFood.daily_grams ? ` · ${currentFood.daily_grams}g/día` : ''}
                  </Text>
                </View>
                {currentFood.daysRemaining !== null && (
                  <View style={styles.heroRight}>
                    <Text style={styles.heroDays}>≈{currentFood.daysRemaining}</Text>
                    <Text style={styles.heroDaysLabel}>días</Text>
                  </View>
                )}
              </View>
              {currentFood.progressPct !== null && (
                <View style={styles.progressBg}>
                  <View style={[
                    styles.progressFill,
                    {
                      width: `${currentFood.progressPct}%`,
                      backgroundColor: currentFood.progressPct < 20 ? Colors.bad
                        : currentFood.progressPct < 40 ? Colors.warn : Colors.good,
                    },
                  ]} />
                </View>
              )}
            </Card>
          </TouchableOpacity>
        ) : (
          <Card>
            <View style={styles.emptyCard}>
              <Ionicons name="restaurant-outline" size={36} color={Colors.cardBorder} />
              <Text style={styles.emptyTitle}>Sin alimento registrado</Text>
              <Text style={styles.emptyText}>Agrega el alimento actual para ver progreso</Text>
              <Button title="Agregar alimento" onPress={openAddFood} style={{ marginTop: Spacing.sm }} />
            </View>
          </Card>
        )}

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{foods.length}</Text>
            <Text style={styles.statLabel}>Alimentos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{treats.length}</Text>
            <Text style={styles.statLabel}>Snacks</Text>
          </View>
          {totalTreatSpend > 0 && (
            <View style={styles.statBox}>
              <Text style={styles.statValue} numberOfLines={1}>${totalTreatSpend}</Text>
              <Text style={styles.statLabel}>En snacks</Text>
            </View>
          )}
        </View>

        {/* Monthly spend chart (premium) */}
        {isPremium && treats.some(t => t.price) && (
          <TreatSpendChart treats={treats} />
        )}

        {/* Add buttons row */}
        <View style={styles.addRow}>
          <TouchableOpacity style={styles.addBtn} onPress={openAddFood} activeOpacity={0.7}>
            <View style={[styles.addIcon, { backgroundColor: Colors.accentLight }]}>
              <Ionicons name="add" size={16} color={Colors.accent} />
            </View>
            <Text style={styles.addLabel}>Alimento</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => { resetTreatForm(); setShowTreatForm(true); }} activeOpacity={0.7}>
            <View style={[styles.addIcon, { backgroundColor: Colors.accentLight }]}>
              <Ionicons name="add" size={16} color={Colors.accentDark} />
            </View>
            <Text style={styles.addLabel}>Snack</Text>
          </TouchableOpacity>
        </View>

        {/* Food history */}
        {foods.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Historial de alimentos</Text>
            {(isPremium ? foods : foods.slice(0, 3)).map(food => (
              <TouchableOpacity key={food.id} activeOpacity={0.7} onPress={() => openEditFood(food)}>
                <Card>
                  <View style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{food.brand}</Text>
                      <Text style={styles.itemSub}>
                        {FOOD_TYPES[food.food_type ?? food.type ?? ''] ?? food.type ?? ''}
                        {food.daily_grams ? ` · ${food.daily_grams}g/día` : ''}
                      </Text>
                      {food.daysRemaining !== null && (
                        <Text style={[
                          styles.itemStatus,
                          { color: food.daysRemaining === 0 ? Colors.bad : food.daysRemaining <= 5 ? Colors.warn : Colors.good },
                        ]}>
                          {food.daysRemaining === 0 ? 'Se terminó' : `${food.daysRemaining}d restantes`}
                        </Text>
                      )}
                      {food.start_date && <Text style={styles.itemDate}>Desde {formatDate(food.start_date)}</Text>}
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteFood(food.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="trash-outline" size={20} color={Colors.muted} />
                    </TouchableOpacity>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
            {!isPremium && foods.length > 3 && (
              <TouchableOpacity
                style={styles.historyGate}
                onPress={() => router.push('/premium' as any)}
                activeOpacity={0.7}
              >
                <Ionicons name="lock-closed-outline" size={16} color={Colors.accent} />
                <Text style={styles.historyGateText}>+{foods.length - 3} alimentos · Ver historial completo</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Treats */}
        {treats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Snacks y premios</Text>
            {treats.map(treat => (
              <TouchableOpacity key={treat.id} activeOpacity={0.7} onPress={() => openEditTreat(treat)}>
                <Card>
                  <View style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{treat.name}</Text>
                      {treat.brand && <Text style={styles.itemSub}>{treat.brand}</Text>}
                      {treat.purchase_date && <Text style={styles.itemDate}>{formatDate(treat.purchase_date)}</Text>}
                      {treat.notes && <Text style={styles.itemNotes}>{treat.notes}</Text>}
                    </View>
                    <View style={styles.itemRight}>
                      {treat.price !== null && treat.price > 0 && (
                        <View style={styles.costBadge}>
                          <Text style={styles.costText}>${treat.price}</Text>
                        </View>
                      )}
                      <View style={styles.rowActions}>
                        <TouchableOpacity onPress={() => openEditTreat(treat)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="pencil-outline" size={20} color={Colors.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteTreat(treat.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={20} color={Colors.muted} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Food form */}
      <BottomSheet visible={showFoodForm} onClose={() => setShowFoodForm(false)} title={editingFood ? 'Editar alimento' : 'Agregar alimento'}>
        {!editingFood && foods.length > 0 && (
          <TouchableOpacity
            style={styles.duplicateBtn}
            onPress={() => duplicateFromFood(foods[0])}
            activeOpacity={0.7}
          >
            <Ionicons name="copy-outline" size={15} color={Colors.accent} />
            <Text style={styles.duplicateBtnText}>Repetir: {foods[0].brand}</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
          </TouchableOpacity>
        )}
        <FormField label="Marca" value={brand} onChangeText={setBrand} placeholder="Ej: Royal Canin, Hills..." />
        <SelectField label="Tipo" value={foodType} options={FOOD_OPTIONS} onSelect={setFoodType} />
        <FormField label="Ración diaria (g)" value={dailyGrams} onChangeText={setDailyGrams} placeholder="Ej: 200" keyboardType="decimal-pad" />
        <SelectField label="Frecuencia" value={frequency} options={FREQUENCY_OPTIONS} onSelect={setFrequency} />
        <View style={styles.formRow}>
          <View style={{ flex: 2 }}>
            <FormField label="Tamaño bolsa" value={bagSize} onChangeText={setBagSize} placeholder="Ej: 10" keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <SelectField label="Unidad" value={bagUnit} options={UNIT_OPTIONS} onSelect={setBagUnit} />
          </View>
        </View>
        <DatePickerField label="Fecha de inicio" value={startDate} onChange={setStartDate} maxDate={new Date()} />
        <FormField label="Notas (opcional)" value={foodNotes} onChangeText={setFoodNotes} placeholder="Observaciones..." multiline style={{ minHeight: 60 }} />
        <Button title="Guardar" onPress={handleSaveFood} loading={savingFood} />
      </BottomSheet>

      {/* Treat form */}
      <BottomSheet visible={showTreatForm} onClose={() => { setShowTreatForm(false); resetTreatForm(); }} title={editingTreat ? 'Editar snack' : 'Agregar snack'}>
        {!editingTreat && treats.length > 0 && (
          <TouchableOpacity
            style={styles.duplicateBtn}
            onPress={() => duplicateFromTreat(treats[0])}
            activeOpacity={0.7}
          >
            <Ionicons name="copy-outline" size={15} color={Colors.accent} />
            <Text style={styles.duplicateBtnText}>Repetir: {treats[0].name}</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
          </TouchableOpacity>
        )}
        <FormField label="Nombre" value={treatName} onChangeText={setTreatName} placeholder="Ej: Dentastix, hueso..." />
        <FormField label="Marca (opcional)" value={treatBrand} onChangeText={setTreatBrand} placeholder="Marca" />
        <FormField label="Precio (opcional)" value={treatPrice} onChangeText={setTreatPrice} placeholder="0.00" keyboardType="decimal-pad" />
        <DatePickerField label="Fecha de compra" value={treatDate} onChange={setTreatDate} maxDate={new Date()} />
        <FormField label="Notas (opcional)" value={treatNotes} onChangeText={setTreatNotes} placeholder="Observaciones..." multiline style={{ minHeight: 60 }} />
        <Button title="Guardar" onPress={handleSaveTreat} loading={savingTreat} />
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
  // Hero card
  heroLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.muted, letterSpacing: 1, marginBottom: Spacing.xs },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBrand: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.ink },
  heroSub: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  heroRight: { alignItems: 'center' },
  heroDays: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.ink },
  heroDaysLabel: { fontSize: FontSize.xs, color: Colors.muted },
  progressBg: { height: 6, backgroundColor: Colors.cardBorder, borderRadius: Radius.full, overflow: 'hidden', marginTop: Spacing.sm },
  progressFill: { height: 6, borderRadius: Radius.full },
  // Empty
  emptyCard: { alignItems: 'center', paddingVertical: Spacing.md },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statBox: {
    flex: 1, backgroundColor: Colors.card, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.cardBorder, padding: Spacing.md, alignItems: 'center',
  },
  statValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.ink },
  statLabel: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  // Add buttons
  addRow: { flexDirection: 'row', gap: Spacing.sm },
  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.cardBorder, padding: Spacing.md,
  },
  addIcon: { width: 28, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  addLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  // Lists
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: Spacing.sm },
  itemRow: { flexDirection: 'row', gap: Spacing.sm },
  itemRight: { alignItems: 'flex-end', gap: Spacing.sm },
  rowActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  itemTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  itemSub: { fontSize: FontSize.sm, color: Colors.muted, marginTop: 2 },
  itemStatus: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, marginTop: 2 },
  itemDate: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 2 },
  itemNotes: { fontSize: FontSize.xs, color: Colors.muted, fontStyle: 'italic', marginTop: 2 },
  costBadge: { backgroundColor: Colors.accentLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  costText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.accent },
  // Chart
  chartTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink, marginBottom: Spacing.sm },
  // Form
  formRow: { flexDirection: 'row', gap: Spacing.sm },
  duplicateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.md,
  },
  duplicateBtnText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
  },
  historyGate: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.canvas, borderRadius: Radius.lg, borderWidth: 1,
    borderColor: Colors.cardBorder, padding: Spacing.md, marginTop: Spacing.xs,
  },
  historyGateText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.accent },
});
