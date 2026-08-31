import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight, Radius, PetThemeColors } from '../../constants/theme';
import type { Pet } from '@vivra/shared/lib/database';

interface PetSelectorProps {
  pets: Pet[];
  activePetId: string | null;
  onSelect: (id: string) => void;
}

export function PetSelector({ pets, activePetId, onSelect }: PetSelectorProps) {
  if (pets.length <= 1) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {pets.map(pet => {
        const isActive = pet.id === activePetId;
        const color = PetThemeColors[pet.theme_color ?? 'orange'] ?? Colors.accent;
        return (
          <TouchableOpacity
            key={pet.id}
            onPress={() => onSelect(pet.id)}
            activeOpacity={0.7}
            style={[
              styles.chip,
              isActive && { backgroundColor: color, borderColor: color },
            ]}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {pet.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.ink,
  },
  chipTextActive: {
    color: Colors.white,
  },
});
