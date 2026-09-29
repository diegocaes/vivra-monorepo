import { ScrollView, StyleSheet, Text, View, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Colors } from '../../../constants/theme';
import { PassportCard } from '../../../components/pet/PassportCard';
import { PassportRow } from '../../../components/pet/PassportContent';
import { Card } from '../../../components/ui/Card';
import { DataLoadNotice } from '../../../components/shared/DataLoadNotice';
import { usePetContext } from '../../../contexts/PetContext';

export default function TravelScreen() {
  const router = useRouter();
  const { pet, refresh, error, loading } = usePetContext();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } };
  return <SafeAreaView style={styles.safe} edges={['top']} testID="screen-travel">
    <View style={styles.header}><Text style={styles.title}>Viajes</Text><Text style={styles.subtitle}>Cada aventura, con todo a mano.</Text></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}>
      <DataLoadNotice message={error} onRetry={refresh} />
      {pet ? <>
        <Card><PassportRow icon="airplane-outline" title="Viajes y requisitos" subtitle="Próximos vuelos, historial y documentos de cada viaje" onPress={() => router.push('/(app)/viajes/vuelos')} /></Card>
        <Text style={styles.sectionTitle}>Pasaporte</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Abrir pasaporte" onPress={() => router.push('/pasaporte')} activeOpacity={0.8}><PassportCard pet={pet} /></TouchableOpacity>
        <Text style={styles.subtitle}>Identidad y vacunas en un resumen que puedes compartir o imprimir.</Text>
      </> : <Text style={styles.subtitle}>{loading ? 'Cargando viajes…' : error ? 'Reintenta para ver su información.' : 'Agrega una mascota para organizar sus viajes.'}</Text>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20 },
  title: { fontSize: 26, fontWeight: '600', color: Colors.ink },
  subtitle: { fontSize: 14, color: Colors.muted, lineHeight: 21, marginTop: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.ink },
  content: { paddingHorizontal: 22, paddingBottom: 40, paddingTop: 4, gap: 16 },
});
