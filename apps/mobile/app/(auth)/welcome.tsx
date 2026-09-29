import { BrandLogo } from '../../components/ui/BrandLogo';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '../../components/ui/Button';
import { Colors } from '../../constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} testID="screen-welcome">
      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <BrandLogo width={150} style={styles.brand} />
        <View style={styles.copy}>
          <Text style={styles.title}>Una vida más{ '\n' }sana y feliz,{ '\n' }juntos.</Text>
          <Text style={styles.subtitle}>Toda su salud, cuidado y viajes.{ '\n' }En un solo lugar.</Text>
        </View>
        <Image source={require('../../assets/images/welcome-pets.jpg')} style={styles.art} resizeMode="cover" accessible={false} />
        <View style={styles.actions}>
          <Button title="Empezar" onPress={() => router.push('/(auth)/register')} />
          <Button title="Ya tengo una cuenta" variant="ghost" onPress={() => router.push('/(auth)/login')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.canvas },
  content: { flexGrow: 1, paddingTop: 24 },
  brand: { alignSelf: 'center', marginBottom: 30 },
  copy: { paddingHorizontal: 34, zIndex: 1 },
  title: { fontSize: 40, lineHeight: 44, letterSpacing: -1.5, fontWeight: '600', color: Colors.ink },
  subtitle: { color: Colors.muted, fontSize: 16, lineHeight: 23, marginTop: 16 },
  art: { width: '100%', minHeight: 280, flex: 1, height: 330, marginTop: 8 },
  actions: { paddingHorizontal: 26, paddingBottom: 8, gap: 6, backgroundColor: Colors.canvas },
});
