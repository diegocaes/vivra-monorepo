import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/Card';
import { formatCurrency } from '@vivra/shared';

interface SpendingSummaryProps {
  petId: string;
  isPremium: boolean;
}

interface SpendingCategory {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  total: number;
}

export function SpendingSummary({ petId, isPremium }: SpendingSummaryProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<SpendingCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSpending = useCallback(async () => {
    try {
      const [vetRes, groomRes, flightRes, treatRes, prevRes, foodRes] = await Promise.all([
        supabase.from('vet_visits').select('cost').eq('pet_id', petId),
        supabase.from('groomings').select('cost').eq('pet_id', petId),
        supabase.from('flights').select('ticket_price').eq('pet_id', petId),
        supabase.from('treats').select('price').eq('pet_id', petId),
        supabase.from('preventive_treatments').select('cost').eq('pet_id', petId),
        supabase.from('foods').select('price').eq('pet_id', petId),
      ]);

      // Log silent errors so they surface in dev without breaking the UI.
      for (const [name, res] of [
        ['vet_visits', vetRes], ['groomings', groomRes], ['flights', flightRes],
        ['treats', treatRes], ['preventive_treatments', prevRes], ['foods', foodRes],
      ] as const) {
        if (res.error) console.warn(`[SpendingSummary] ${name} error:`, res.error.message);
      }

      const sum = (arr: any[] | null, key: string) =>
        (arr ?? []).reduce((s: number, r: any) => s + (Number(r[key]) || 0), 0);

      setCategories([
        { label: 'Alimento', icon: 'nutrition', iconColor: Colors.accent, total: sum(foodRes.data, 'price') },
        { label: 'Veterinario', icon: 'medical', iconColor: '#E879F9', total: sum(vetRes.data, 'cost') },
        { label: 'Grooming', icon: 'cut', iconColor: Colors.accentDark, total: sum(groomRes.data, 'cost') },
        { label: 'Vuelos', icon: 'airplane', iconColor: '#3B82F6', total: sum(flightRes.data, 'ticket_price') },
        { label: 'Snacks', icon: 'restaurant', iconColor: '#22C55E', total: sum(treatRes.data, 'price') },
        { label: 'Preventivos', icon: 'shield-checkmark', iconColor: Colors.warn, total: sum(prevRes.data, 'cost') },
      ]);
    } catch (e: any) {
      console.warn('[SpendingSummary] unexpected error:', e?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => { fetchSpending(); }, [fetchSpending]);

  const grandTotal = categories.reduce((s, c) => s + c.total, 0);

  if (loading) return null;

  // El TOTAL es visible para todos. El desglose por categoría es premium.
  return (
    <Card>
      <View style={styles.header}>
        <Ionicons name="wallet-outline" size={20} color={Colors.accent} />
        <Text style={styles.headerTitle}>Gastos totales</Text>
        <Text style={styles.grandTotal}>${formatCurrency(grandTotal)}</Text>
      </View>
      {grandTotal === 0 ? (
        <Text style={styles.noData}>Aún no hay gastos registrados</Text>
      ) : isPremium ? (
        <View style={styles.list}>
          {categories.filter(c => c.total > 0).map(c => (
            <View key={c.label} style={styles.row}>
              <Ionicons name={c.icon} size={16} color={c.iconColor} />
              <Text style={styles.catLabel}>{c.label}</Text>
              <Text style={styles.catTotal}>${formatCurrency(c.total)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <TouchableOpacity onPress={() => router.push('/paywall' as any)} activeOpacity={0.8}>
          <View style={styles.lockedRow}>
            <View style={styles.lockedLeft}>
              <Ionicons name="lock-closed" size={16} color={Colors.muted} />
              <Text style={styles.lockedDesc}>Ver el desglose por categoría con Premium</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
          </View>
        </TouchableOpacity>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  headerTitle: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  grandTotal: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.accent },
  list: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  catLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.ink },
  catTotal: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.ink },
  noData: { fontSize: FontSize.sm, color: Colors.muted, fontStyle: 'italic' },
  lockedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  lockedLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  lockedTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.ink },
  lockedDesc: { fontSize: FontSize.xs, color: Colors.muted, marginTop: 1 },
});
