import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight, PetThemeColors } from '../../constants/theme';
import { calculateAge } from '@vivra/shared';
import type { Pet } from '@vivra/shared/lib/database';

interface PetHeroCardProps {
  pet: Pet;
}

export function PetHeroCard({ pet }: PetHeroCardProps) {
  const themeColor = PetThemeColors[pet.theme_color ?? 'orange'] ?? Colors.accent;
  const age = pet.birth_date ? calculateAge(pet.birth_date) : null;

  return (
    <View style={[styles.card, { backgroundColor: themeColor }]}>
      <View style={styles.row}>
        {pet.photo_url ? (
          <Image source={{ uri: pet.photo_url }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.placeholder]}>
            <Ionicons name="paw" size={32} color="rgba(255,255,255,0.6)" />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name}>{pet.name}</Text>
          {pet.breed && <Text style={styles.breed}>{pet.breed}</Text>}
          <View style={styles.metaRow}>
            {age && <Text style={styles.meta}>{age}</Text>}
            {pet.weight_kg && (
              <Text style={styles.meta}>
                {age ? ' · ' : ''}{pet.weight_kg} kg
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  placeholder: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  breed: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  meta: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
  },
});
