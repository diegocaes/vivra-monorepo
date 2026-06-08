import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme';
import { formatDate } from '@vivra/shared';

/**
 * CareCard — generic care-shortcut card used in the dashboard grid.
 *
 * Same shape as the original "Desparasitante" card (orange-tinted border,
 * icon top-left, status badge top-right, title + subtitle + last-date row),
 * but parametrized so the four care categories (Antipulgas, Desparasitante,
 * Grooming, Veterinario) share one implementation.
 *
 * The `variant` prop changes the visual weight when the data is concerning
 * — `overdue` and `never` get a bold red border, `urgent` an amber border.
 * `normal` is the default light look.
 */

export type CareCardVariant = 'normal' | 'urgent' | 'overdue' | 'never';

interface CareCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  /** Top-right status pill (e.g. "Hace 22d", "En 5d", "Vencido 3d"). Optional. */
  badge?: { text: string; color?: string } | null;
  title: string;
  /** One-line context below the title (e.g. product name, location, vet). */
  subtitle?: string | null;
  /** ISO date of the last occurrence. Rendered as "Último: <formatted date>". */
  lastDate?: string | null;
  /** Replaces the "Último: …" row when there's no history yet. */
  emptyText?: string;
  /** When provided, the whole card is pulsable. */
  onPress?: () => void;
  variant?: CareCardVariant;
}

export function CareCard({
  icon,
  iconColor,
  badge,
  title,
  subtitle,
  lastDate,
  emptyText,
  onPress,
  variant = 'normal',
}: CareCardProps) {
  const variantStyle =
    variant === 'overdue' ? styles.cardOverdue
    : variant === 'urgent' ? styles.cardUrgent
    : variant === 'never' ? styles.cardNever
    : undefined;

  const resolvedIconColor =
    iconColor ?? (variant === 'overdue' || variant === 'never' ? Colors.bad
      : variant === 'urgent' ? Colors.warn
      : Colors.accent);

  const badgeColor = badge?.color ?? Colors.accent;
  const badgeOpacity = variant === 'overdue' || variant === 'urgent' || variant === 'never' ? '30' : '18';

  return (
    <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress} disabled={!onPress}>
      <Card style={variantStyle}>
        <View style={styles.topRow}>
          <Ionicons name={icon} size={24} color={resolvedIconColor} />
          {badge && (
            <View style={[styles.badge, { backgroundColor: badgeColor + badgeOpacity }]}>
              <Text
                style={[
                  styles.badgeText,
                  { color: badgeColor },
                  (variant === 'overdue' || variant === 'urgent' || variant === 'never') && styles.badgeTextBold,
                ]}
              >
                {badge.text}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}

        {lastDate ? (
          <Text style={styles.lastDate} numberOfLines={1}>Último: {formatDate(lastDate)}</Text>
        ) : emptyText ? (
          <Text
            style={[
              styles.empty,
              (variant === 'overdue' || variant === 'never') && styles.emptyBold,
            ]}
            numberOfLines={2}
          >
            {emptyText}
          </Text>
        ) : null}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.ink,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 1,
  },
  lastDate: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },
  empty: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  emptyBold: {
    color: Colors.bad,
    fontStyle: 'normal',
    fontWeight: FontWeight.semibold,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  badgeTextBold: {
    fontWeight: FontWeight.bold,
  },
  cardOverdue: {
    borderWidth: 2,
    borderColor: Colors.bad,
    backgroundColor: Colors.bad + '08',
  },
  cardUrgent: {
    borderWidth: 2,
    borderColor: Colors.warn,
    backgroundColor: Colors.warn + '0A',
  },
  cardNever: {
    borderWidth: 2,
    borderColor: Colors.bad,
    backgroundColor: Colors.bad + '0D',
  },
});
