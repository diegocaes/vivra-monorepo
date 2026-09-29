import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { PassportContent } from '../components/pet/PassportContent';
import { passportBackRoute } from '../lib/careNavigation';

export default function PasaporteScreen() {
  const router = useRouter();
  return (
    <SafeAreaView testID="screen-passport" style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} accessibilityRole="button" accessibilityLabel="Volver" onPress={() => router.canGoBack() ? router.back() : router.replace(passportBackRoute())}>
          <Ionicons name="arrow-back" size={25} color={Colors.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Pasaporte de viaje</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><PassportContent /></ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '600', color: Colors.ink },
  content: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 48 },
});
