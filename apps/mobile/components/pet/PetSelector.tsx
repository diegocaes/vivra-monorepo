import { Image, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { calculateAge } from '@vivra/shared';
import { Colors } from '../../constants/theme';
import type { Pet } from '@vivra/shared/lib/database';

interface PetSelectorProps {
  pets: Pet[];
  activePetId: string | null;
  onSelect: (id: string) => void;
}

export function PetSelector({ pets, activePetId, onSelect }: PetSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {pets.map(pet => {
        const isActive = pet.id === activePetId;
        const age = pet.birth_date ? calculateAge(pet.birth_date) : null;
        return (
          <TouchableOpacity key={pet.id} onPress={() => onSelect(pet.id)} activeOpacity={0.75}
            accessibilityRole="button" accessibilityState={{ selected: isActive }} accessibilityLabel={`Seleccionar a ${pet.name}`} style={styles.pet}>
            <View style={[styles.ring, isActive && styles.activeRing]}>
              {pet.photo_url ? <Image source={{ uri: pet.photo_url }} style={styles.photo} /> : (
                <View style={[styles.photo, styles.placeholder]}><Ionicons name="paw" size={38} color={Colors.accent} /></View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={1}>{pet.name}</Text>
            <Text style={styles.meta} numberOfLines={2}>{[age, pet.breed || (pet.species === 'cat' ? 'Gato' : 'Perro')].filter(Boolean).join(' · ')}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingVertical: 4, flexGrow: 1 },
  pet: { width: 156, alignItems: 'center', gap: 3 },
  ring: { borderWidth: 1.8, borderColor: 'transparent', padding: 4, borderRadius: 60 },
  activeRing: { borderColor: Colors.good },
  photo: { width: 88, height: 88, borderRadius: 44 },
  placeholder: { backgroundColor: '#E7E0D4', alignItems: 'center', justifyContent: 'center' },
  name: { marginTop: 5, fontSize: 18, fontWeight: '600', color: Colors.ink },
  meta: { fontSize: 11, lineHeight: 16, color: Colors.muted, textAlign: 'center' },
});
