import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Colors } from '../../../constants/theme';
import { usePetContext } from '../../../contexts/PetContext';
import { Card } from '../../../components/ui/Card';
import { PassportRow } from '../../../components/pet/PassportContent';
import { DataLoadNotice } from '../../../components/shared/DataLoadNotice';
import { CategoryIcon } from '../../../components/ui/CategoryIcon';

export default function CareScreen() {
  const router = useRouter();
  const data = usePetContext();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); try { await data.refresh(); } finally { setRefreshing(false); } };
  return <SafeAreaView style={styles.safe} edges={['top']} testID="screen-care">
    <View style={styles.header}><Text style={styles.title}>Cuidado</Text><Text style={styles.subtitle}>Pequeños cuidados. Más días felices.</Text></View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}>
      <View style={styles.hero}><CategoryIcon name="paw-outline" color={Colors.accent} size={42} /><Text style={styles.heroTitle}>El día a día de {data.pet?.name ?? 'tu mascota'}</Text><Text style={styles.subtitle}>Sus rutinas y todo lo que le hace bien.</Text></View>
      <Card>
        <PassportRow icon="restaurant-outline" title="Alimentación" subtitle="Su comida, porciones y compras" onPress={() => router.navigate('/(app)/cuidado/alimentacion')} />
        <PassportRow icon="cut-outline" title="Grooming" subtitle="Baños, cortes y próximos cuidados" onPress={() => router.push('/grooming?from=cuidado')} />
      </Card>
      <DataLoadNotice message={data.error} onRetry={data.refresh} />
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '600', color: Colors.ink },
  subtitle: { fontSize: 14, lineHeight: 21, color: Colors.muted, marginTop: 7 },
  content: { padding: 24, paddingTop: 4, gap: 20, paddingBottom: 44 },
  hero: { backgroundColor: Colors.sage, padding: 24, borderRadius: 22 },
  heroTitle: { fontSize: 24, lineHeight: 30, letterSpacing: -0.5, fontWeight: '600', color: Colors.ink, marginTop: 24 },
});
