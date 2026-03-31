import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme';
import { BREED_FACTS, type DogBreed } from '@vivra/shared';

interface FunFactProps {
  breed: string | null;
}

function getDailyFact(breed: string | null) {
  const key = (breed ?? 'Other') as DogBreed;
  const facts = BREED_FACTS[key] ?? BREED_FACTS['Other'] ?? [];
  if (facts.length === 0) return null;

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  return facts[dayOfYear % facts.length];
}

export function FunFact({ breed }: FunFactProps) {
  const fact = getDailyFact(breed);
  if (!fact) return null;

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Ionicons name="bulb-outline" size={20} color={Colors.accent} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.label}>Dato del día</Text>
          <Text style={styles.fact}>{fact.fact}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fact: {
    fontSize: FontSize.sm,
    color: Colors.ink,
    lineHeight: 20,
  },
});
