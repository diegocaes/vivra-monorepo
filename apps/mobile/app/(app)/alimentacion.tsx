import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Text as SvgText, Line, G } from 'react-native-svg';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { usePetContext } from '../../contexts/PetContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { formatDateShort, computeFoodStats, formatCurrency, friendlyError } from '@vivra/shared';
import { FOOD_TYPES } from '@vivra/shared';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { FormField } from '../../components/ui/FormField';
import { DatePickerField } from '../../components/ui/DatePickerField';
import { SelectField } from '../../components/ui/SelectField';
import type { Food, Treat } from '../../types/supabase';
import { track } from '../../lib/analytics';
import { AddButton } from '../../components/ui/AddButton';
import { DataLoadNotice } from '../../components/shared/DataLoadNotice';

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

/**
 * Monthly food + treat spend, stacked bars over the last 6 months.
 * Answers the real question — "¿cuánto me cuesta alimentar a mi perro?" —
 * in one glance: orange = food bags (attributed to their start month),
 * amber = snacks (attributed to purchase month). Premium analytics.
 */
function FoodSpendChart({ foods, treats }: { foods: Food[]; treats: Treat[] }) {
  const monthly = useMemo(() => {
    const now = new Date();
    const months: { label: string; food: number; treats: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const foodTotal = foods
        .filter(f => f.price && (f.start_date ?? f.created_at ?? '').startsWith(key))
        .reduce((s, f) => s + (f.price ?? 0), 0);
      const treatTotal = treats
        .filter(t => t.price && t.purchase_date?.startsWith(key))
        .reduce((s, t) => s + (t.price ?? 0), 0);
      months.push({ label: MONTH_LABELS[d.getMonth()], food: foodTotal, treats: treatTotal });
    }
    return months;
  }, [foods, treats]);

  const maxVal = Math.max(...monthly.map(m => m.food + m.treats), 1);
  const avgMonthly = monthly.reduce((s, m) => s + m.food + m.treats, 0) / 6;
  const W = 320;
  const H = 172;
  // top padding reserves room for the $ total above each bar so it never clips
  const PAD = { top: 30, bottom: 26, left: 8, right: 8 };
  const barW = 32;
  const gap = (W - PAD.left - PAD.right - barW * 6) / 5;
  const plotH = H - PAD.top - PAD.bottom;

  return (
    <Card>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Gasto en alimentación</Text>
        {avgMonthly > 0 && (
          <Text style={styles.chartAvg}>~${Math.round(avgMonthly)}/mes</Text>
        )}
      </View>
      <Svg width={W} height={H}>
        <Line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke={Colors.cardBorder} strokeWidth={1} />
        {monthly.map((m, i) => {
          const x = PAD.left + i * (barW + gap);
          const total = m.food + m.treats;
          const foodH = maxVal > 0 ? (m.food / maxVal) * plotH : 0;
          const treatH = maxVal > 0 ? (m.treats / maxVal) * plotH : 0;
          const foodY = H - PAD.bottom - foodH;
          const treatY = foodY - treatH;
          return (
            <G key={i}>
              {m.food > 0 && (
                <Rect x={x} y={foodY} width={barW} height={foodH} rx={3} fill={Colors.accent} opacity={0.85} />
              )}
              {m.treats > 0 && (
                <Rect x={x} y={treatY} width={barW} height={treatH} rx={3} fill={Colors.warn} opacity={0.85} />
              )}
              {total > 0 && (
                <SvgText
                  x={x + barW / 2}
                  y={Math.max(PAD.top - 8, treatY - 6)}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight="600"
                  fill={Colors.ink}
                >
                  {/* Un solo hijo string: con hijos múltiples ("$" + número),
                      react-native-svg centra cada tspan en el mismo punto y se pisan */}
                  {`$${Math.round(total)}`}
                </SvgText>
              )}
              <SvgText x={x + barW / 2} y={H - PAD.bottom + 14} textAnchor="middle" fontSize={10} fill={Colors.muted}>
                {m.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.accent }]} />
          <Text style={styles.legendText}>Comida</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.warn }]} />
          <Text style={styles.legendText}>Snacks</Text>
        </View>
      </View>
    </Card>
  );
}

/** Compute "duration display" for one bag: real (with end_date), projected
 *  (from bag_size/daily_grams) or running (active). Used for list cards. */
function describeFoodDuration(food: Food): { line: string; isActive: boolean } {
  const start = food.start_date ?? food.created_at?.slice(0, 10) ?? null;

  if (food.end_date && start) {
    const days = Math.max(0, Math.floor(
      (new Date(food.end_date + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000
    ));
    return {
      line: `${formatDateShort(start)} – ${formatDateShort(food.end_date)} (${days} días)`,
      isActive: false,
    };
  }
  if (start) {
    return { line: `${formatDateShort(start)} – actual`, isActive: true };
  }
  return { line: '—', isActive: true };
}

export default function AlimentacionScreen() {
  const router = useRouter();
  const petData = usePetContext();
  const { pet } = petData;
  const { isPremium } = useSubscription();
  const [foods, setFoods] = useState<Food[]>([]);
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
  const [foodPrice, setFoodPrice] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(''); // Empty = bag still in use
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

  // depende de `pet?.id`
  // a propósito, no de `pet`. Con el objeto completo, cualquier cambio de la
  // mascota dispararía un refetch innecesario de alimentos y snacks.
  const fetchData = useCallback(async () => {
    if (!pet) { setLoading(false); return; }

    const [foodsRes, treatsRes] = await Promise.all([
      supabase.from('foods').select('*').eq('pet_id', pet.id).order('created_at', { ascending: false }),
      supabase.from('treats').select('*').eq('pet_id', pet.id).order('created_at', { ascending: false }),
    ]);

    if (foodsRes.error) console.warn('[Alimentacion] foods error:', foodsRes.error.message);
    if (treatsRes.error) console.warn('[Alimentacion] treats error:', treatsRes.error.message);
    setFoods((foodsRes.data as Food[]) ?? []);
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
    setBagSize(''); setBagUnit('kg'); setFoodPrice('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');
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
    setFoodPrice(food.price?.toString() ?? '');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate(''); // new bag = active
    setFoodNotes('');
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
    setFoodPrice(food.price?.toString() ?? '');
    setStartDate(food.start_date ?? new Date().toISOString().slice(0, 10));
    setEndDate(food.end_date ?? '');
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
      price: foodPrice ? parseFloat(foodPrice) : null,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: foodNotes || null,
    };

    // Auto-close the previous still-active bag when the user logs a NEW one.
    // Strategy: set previous bag's end_date to the new bag's start_date.
    // Skipped if the new bag is in edit mode, or if its start_date is before
    // the previous bag's start_date (out-of-order log of an old bag).
    if (!editingFood && startDate) {
      const { data: prevFoods } = await supabase
        .from('foods')
        .select('id, start_date, created_at')
        .eq('pet_id', pet.id)
        .is('end_date', null)
        .order('created_at', { ascending: false })
        .limit(1);

      const prev = prevFoods?.[0];
      if (prev) {
        const prevStart = prev.start_date || prev.created_at?.slice(0, 10);
        if (prevStart && startDate >= prevStart) {
          await supabase.from('foods').update({ end_date: startDate }).eq('id', prev.id);
        }
      }
    }

    const { error } = editingFood
      ? await supabase.from('foods').update(payload).eq('id', editingFood.id)
      : await supabase.from('foods').insert(payload);

    setSavingFood(false);
    if (error) {
      console.warn('[alimentacion] food save error:', error.message);
      Alert.alert('Error', friendlyError(error));
      return;
    }

    // Solo se registra el guardado exitoso: los intentos fallidos ya se ven
    // en Sentry y aquí solo ensuciarían las métricas de uso.
    track('crud', `alimento_${editingFood ? 'editar' : 'crear'}`);
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
    if (error) {
      console.warn('[alimentacion] treat save error:', error.message);
      Alert.alert('Error', friendlyError(error));
      return;
    }
    track('crud', `snack_${editingTreat ? 'editar' : 'crear'}`);
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

  const stats = computeFoodStats(foods);
  const totalTreatSpend = treats.filter(t => t.price).reduce((s, t) => s + (t.price ?? 0), 0);

  return (
    <SafeAreaView testID="screen-food" style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Alimentación</Text>
        <AddButton label="Alimento" onPress={openAddFood} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <DataLoadNotice message={petData.error} onRetry={petData.refresh} />

        {/* Stats card — averages and trazabilidad. No countdown, no alarm. */}
        {stats.totalBags > 0 ? (
          <Card>
            <Text style={styles.heroLabel}>PROMEDIOS DE ALIMENTACIÓN</Text>
            {stats.latestFood && (
              <Text style={styles.heroSub}>
                Último: <Text style={{ fontWeight: FontWeight.semibold, color: Colors.ink }}>{stats.latestFood.brand}</Text>
                {stats.latestFood.type && ` · ${FOOD_TYPES[stats.latestFood.type] ?? stats.latestFood.type}`}
              </Text>
            )}
            <View style={styles.statsGrid}>
              <View style={styles.statCell}>
                <Text style={styles.statCellValue}>
                  {stats.avgPricePerDay !== null ? `$${formatCurrency(stats.avgPricePerDay)}` : '—'}
                </Text>
                <Text style={styles.statCellLabel}>$/día prom.</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statCellValue}>
                  {stats.avgDaysPerBag !== null ? `${stats.avgDaysPerBag}d` : '—'}
                </Text>
                <Text style={styles.statCellLabel}>dura/bolsa</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statCellValue}>
                  {stats.avgDailyGrams !== null ? `${stats.avgDailyGrams}g` : '—'}
                </Text>
                <Text style={styles.statCellLabel}>g/día prom.</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statCellValue}>{stats.totalBags}</Text>
                <Text style={styles.statCellLabel}>{stats.totalBags === 1 ? 'bolsa' : 'bolsas'}</Text>
              </View>
            </View>
            {stats.totalSpent > 0 && (isPremium ? (
              <Text style={styles.totalSpentText}>
                Total gastado en alimentación: <Text style={{ fontWeight: FontWeight.semibold, color: Colors.ink }}>${formatCurrency(stats.totalSpent)}</Text>
              </Text>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  track('click', 'upsell_total_alimentacion');
                  router.push('/paywall' as any);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.totalSpentText}>
                  <Ionicons name="lock-closed" size={11} color={Colors.muted} /> Total gastado en alimentación: <Text style={{ fontWeight: FontWeight.semibold, color: Colors.accent }}>ver con Premium</Text>
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        ) : (
          <Card>
            <View style={styles.emptyCard}>
              <Ionicons name="restaurant-outline" size={36} color={Colors.cardBorder} />
              <Text style={styles.emptyTitle}>Aún no has registrado comida</Text>
              <Text style={styles.emptyText}>Agrega el primer alimento para empezar a ver promedios de costo y duración</Text>
              <Button title="Agregar alimento" onPress={openAddFood} style={{ marginTop: Spacing.sm }} />
            </View>
          </Card>
        )}

        {/* Treats stats — only show if user has logged any */}
        {treats.length > 0 && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{treats.length}</Text>
              <Text style={styles.statLabel}>Snacks</Text>
            </View>
            {totalTreatSpend > 0 && (
              <View style={styles.statBox}>
                <Text style={styles.statValue} numberOfLines={1}>${formatCurrency(totalTreatSpend)}</Text>
                <Text style={styles.statLabel}>En snacks</Text>
              </View>
            )}
          </View>
        )}

        {/* Monthly spend chart — food + treats stacked (premium analytics) */}
        {isPremium && (foods.some(f => f.price) || treats.some(t => t.price)) && (
          <FoodSpendChart foods={foods} treats={treats} />
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

        {/* Food list — full CRUD, no countdown/alarm UI */}
        {foods.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tus alimentos</Text>
            {foods.map(food => {
              const dur = describeFoodDuration(food);
              const typeLabel = FOOD_TYPES[food.food_type ?? food.type ?? ''] ?? food.type ?? '';
              return (
                <TouchableOpacity key={food.id} activeOpacity={0.7} onPress={() => openEditFood(food)}>
                  <Card>
                    <View style={styles.itemRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.itemTitleRow}>
                          <Text style={styles.itemTitle} numberOfLines={1}>{food.brand}</Text>
                          {dur.isActive && (
                            <View style={styles.activeChip}>
                              <Text style={styles.activeChipText}>actual</Text>
                            </View>
                          )}
                        </View>
                        {!!typeLabel && (
                          <Text style={styles.itemSub}>{typeLabel}</Text>
                        )}
                        <View style={styles.itemMetaRow}>
                          {food.daily_grams != null && <Text style={styles.itemMeta}>{food.daily_grams}g/día</Text>}
                          {food.bag_size != null && <Text style={styles.itemMeta}>{food.bag_size}{food.bag_unit ?? 'kg'}</Text>}
                          {food.price != null && <Text style={styles.itemMeta}>${formatCurrency(food.price)}</Text>}
                          {food.frequency && <Text style={styles.itemMeta}>{food.frequency}</Text>}
                        </View>
                        <Text style={styles.itemDate}>{dur.line}</Text>
                        {food.notes && <Text style={styles.itemNotes}>"{food.notes}"</Text>}
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteFood(food.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="trash-outline" size={20} color={Colors.muted} />
                      </TouchableOpacity>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })}
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
                      {treat.purchase_date && <Text style={styles.itemDate}>{formatDateShort(treat.purchase_date)}</Text>}
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
        <FormField label="Precio ($)" value={foodPrice} onChangeText={setFoodPrice} placeholder="Ej: 45.00" keyboardType="decimal-pad" />
        <DatePickerField label="Fecha de inicio" value={startDate} onChange={setStartDate} maxDate={new Date()} />
        <DatePickerField
          label="Fecha de fin (opcional)"
          value={endDate}
          onChange={setEndDate}
          maxDate={new Date()}
          clearable
        />
        <Text style={styles.formHint}>
          Vacío = bolsa actual. Se autocompleta cuando registras la siguiente.
        </Text>
        <FormField label="Notas (opcional)" value={foodNotes} onChangeText={setFoodNotes} placeholder="Observaciones, reacciones, dónde la compraste..." multiline style={{ minHeight: 60 }} />
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
  heroDateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.md, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.cardBorder,
  },
  heroDateCol: { flex: 1 },
  heroDateLabel: {
    fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.muted,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  heroDateValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink, marginTop: 2 },
  hintBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, marginTop: Spacing.sm,
  },
  hintText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, flex: 1 },
  // New stats grid (4-col averages)
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statCellValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.ink,
  },
  statCellLabel: {
    fontSize: 10,
    color: Colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  totalSpentText: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    textAlign: 'center',
  },
  // List item additions
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  activeChip: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  activeChipText: {
    fontSize: 10,
    fontWeight: FontWeight.semibold,
    color: Colors.good,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  itemMeta: {
    fontSize: FontSize.xs,
    color: Colors.muted,
  },
  formHint: {
    fontSize: 11,
    color: Colors.muted,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
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
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  chartAvg: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.accent,
  },
  chartLegend: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: FontSize.xs, color: Colors.muted },
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
});
