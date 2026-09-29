import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';
import { CategoryIcon } from '../ui/CategoryIcon';

const categories = [
  { label: 'Vacunas', icon: 'vaccine', color: Colors.good, background: Colors.sage, route: '/(app)/salud/vacunas' },
  { label: 'Visitas vet', icon: 'calendar-outline', color: Colors.rose, background: Colors.coral, route: '/(app)/salud/historial' },
  { label: 'Alimentación', icon: 'bowl', color: Colors.gold, background: Colors.sand, route: '/(app)/cuidado/alimentacion' },
  { label: 'Viajes', icon: 'airplane', color: Colors.blue, background: Colors.sky, route: '/(app)/viajes' },
] as const;

export function CategoryGrid() {
  const router = useRouter();
  return (
    <View style={styles.grid}>
      {categories.map(item => (
        <TouchableOpacity key={item.label} accessibilityRole="button" accessibilityLabel={item.label} activeOpacity={0.75}
          style={[styles.tile, { backgroundColor: item.background }]} onPress={() => router.navigate(item.route)}>
          <CategoryIcon name={item.icon} color={item.color} size={32} />
          <Text style={styles.label}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, minHeight: 99, borderRadius: 17, paddingVertical: 17, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', gap: 12 },
  label: { fontSize: 12, fontWeight: '500', color: Colors.ink, textAlign: 'center' },
});
