import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontWeight, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/Card';

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
    const [vetRes, groomRes, flightRes, treatRes, prevRes, foodRes] = await Promise.all([
      supabase.from('vet_visits').select('cost').eq('pet_id', petId),
      supabase.from('groomings').select('cost').eq('pet_id', petId),
      supabase.from('flights').select('ticket_price').eq('pet_id', petId),
      supabase.from('treats').select('price').eq('pet_id', petId),
      supabase.from('preventive_treatments').select('cost').eq('pet_id', petId),
      supabase.from('foods').select('price').eq('pet_id', petId),
    ]);

    const sum = (arr: any[] | null, key: string) =>
      (arr ?? []).reduce((s: number, r: any) => s + (r[key] ?? 0), 0);

    setCategories([
      { label: 'Alimento', icon: 'nutrition', iconColor: Colors.accent, total: sum(foodRes.data, 'price') },
      { label: 'Veterinario', icon: 'medical', iconColor: '#E879F9', total: sum(vetRes.data, 'cost') },
      { label: 'Grooming', icon: 'cut', iconColor: Colors.accentDark, total: sum(groomRes.data, 'cost') },
      { label: 'Vuelos', icon: 'airplane', iconColor: '#3B82F6', total: sum(flightRes.data, 'ticket_price') },
      { label: 'Snacks', icon: 'restaurant', iconColor: '#22C55E', total: sum(treatRes.data, 'price') },
      { label: 'Preventivos', icon: 'shield-checkmark', iconColor: Colors.warn, total: sum(prevRes.data, 'cost') },
    ]);
    setLoading(false);
  }, [petId]);

  useEffect(() => { fetchSpending(); }, [fetchSpending]);

  const grandTotal = categories.reduce((s, c) => s + c.total, 0);

  if (!isPremium) {
    return (
      <TouchableOpacity onPress={() => router.push('/paywall' as any)} activeOpacity={0.8}>
        <Card>
          <View style={styles.lockedRow}>
            <View style={styles.lockedLeft}>
              <Ionicons name="wallet-outline" size={22} color={Colors.accent} />
              <View>
                <Text style={styles.lockedTitle}>Gastos totales</Text>
                <Text style={styles.lockedDesc}>Ve cuánto has invertido en tu mascota</Text>
              </View>
            </View>
            <Ionicons name="lock-closed" size={18} color={Colors.muted} />
          </View>
        </Card>
      </TouchableOpacity>
    );
  }

  if (loading) return null;

  return (
    <Card>
      <View style={styles.header}>
        <Ionicons name="wallet-outline" size={20} color={Colors.accent} />
        <Text style={styles.headerTitle}>Gastos totales</Text>
        <Text style={styles.grandTotal}>${grandTotal.toLocaleString()}</Text>
      </View>
      <View style={styles.list}>
        {categories.filter(c => c.total > 0).map(c => (
          <View key={c.label} style={styles.row}>
            <Ionicons name={c.icon} size={16} color={c.iconColor} />
            <Text style={styles.catLabel}>{c.label}</Text>
            <Text style={styles.catTotal}>${c.total.toLocaleString()}</Text>
          </View>
        ))}
        {grandTotal === 0 && (
          <Text style={styles.noData}>Aún no hay gastos registrados</Text>
        )}
      </View>
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
