import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { calculateAge } from '@vivra/shared';
import { usePetContext } from '../../contexts/PetContext';
import { Colors } from '../../constants/theme';

/** Current pet identity shared by the health overview and its record screens. */
export function HealthPetIdentity({ size = 'compact' }: { size?: 'compact' | 'regular' }) {
  const { pet } = usePetContext();
  const router = useRouter();
  if (!pet) return null;
  const age = pet.birth_date ? calculateAge(pet.birth_date) : null;
  return (
    <TouchableOpacity testID="health-pet-identity" accessibilityRole="button" accessibilityLabel={`Ver perfil de ${pet.name}. ${[age, pet.breed].filter(Boolean).join(' · ')}`} activeOpacity={0.75} style={styles.identity} onPress={() => router.navigate('/(app)/perfil?view=pet')}>
      {pet.photo_url
        ? <Image source={{ uri: pet.photo_url }} style={[styles.photo, size === 'regular' && styles.largePhoto]} />
        : <View style={[styles.photo, styles.placeholder, size === 'regular' && styles.largePhoto]}><Ionicons name="paw-outline" color={Colors.accent} size={32} /></View>}
      <View style={styles.copy}>
        <View style={styles.nameRow}><Text style={styles.name}>{pet.name}</Text><Ionicons name="chevron-forward" size={18} color={Colors.ink} /></View>
        <Text style={styles.meta}>{[age, pet.breed || (pet.species === 'cat' ? 'Gato' : 'Perro')].filter(Boolean).join(' · ')}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 17, paddingVertical: 6 },
  photo: { width: 76, height: 76, borderRadius: 38 },
  largePhoto: { width: 82, height: 82, borderRadius: 41 },
  placeholder: { backgroundColor: Colors.sage, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  name: { fontSize: 21, fontWeight: '600', color: Colors.ink, flexShrink: 1 },
  meta: { fontSize: 12, lineHeight: 18, color: Colors.muted },
});
