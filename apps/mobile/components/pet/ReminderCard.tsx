import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme';
import { formatDate } from '@vivra/shared';

interface ReminderCardProps {
  type: 'antipulgas' | 'desparasitante';
  lastDate: string | null;
  productName?: string | null;
  onPress?: () => void;
}

const CONFIG = {
  antipulgas: { icon: 'shield-checkmark' as const, iconColor: Colors.warn, label: 'Antipulgas', cycleDays: 30 },
  desparasitante: { icon: 'medical' as const, iconColor: '#E879F9', label: 'Desparasitante', cycleDays: 30 },
};

export function ReminderCard({ type, lastDate, productName, onPress }: ReminderCardProps) {
  const { icon, iconColor, label, cycleDays } = CONFIG[type];

  // Never registered → loud red warning
  if (!lastDate) {
    return (
      <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress} disabled={!onPress}>
        <Card style={styles.cardNever}>
          <View style={styles.topRow}>
            <Ionicons name={icon} size={24} color={Colors.bad} />
            <View style={[styles.badge, styles.badgeNever]}>
              <Text style={styles.badgeTextNever}>Nunca aplicado</Text>
            </View>
          </View>
          <Text style={styles.title} numberOfLines={1}>{label}</Text>
          <Text style={styles.neverWarn}>Sin protección activa</Text>
          {onPress && <Text style={styles.registerBold}>Registrar ahora →</Text>}
        </Card>
      </TouchableOpacity>
    );
  }

  const nextDate = new Date(lastDate);
  nextDate.setDate(nextDate.getDate() + cycleDays);
  const today = new Date();
  const daysLeft = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const overdue = daysLeft < 0;
  const urgent = daysLeft <= 7 && daysLeft >= 0;

  const statusColor = overdue ? Colors.bad : urgent ? Colors.warn : Colors.good;
  const statusText = overdue
    ? `Vencido ${Math.abs(daysLeft)}d`
    : daysLeft === 0
      ? 'Hoy'
      : `En ${daysLeft}d`;

  // Bolder container for overdue / urgent
  const cardStyle = overdue ? styles.cardOverdue : urgent ? styles.cardUrgent : undefined;
  const badgeBold = overdue || urgent;

  return (
    <TouchableOpacity activeOpacity={onPress ? 0.7 : 1} onPress={onPress} disabled={!onPress}>
      <Card style={cardStyle}>
        <View style={styles.topRow}>
          <Ionicons name={icon} size={24} color={iconColor} />
          <View style={[styles.badge, { backgroundColor: statusColor + (badgeBold ? '30' : '18') }]}>
            <Text style={[styles.badgeText, { color: statusColor }, badgeBold && styles.badgeTextBold]}>{statusText}</Text>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={1}>{label}</Text>
        {productName && <Text style={styles.product} numberOfLines={1}>{productName}</Text>}
        <Text style={styles.lastDate} numberOfLines={1}>Último: {formatDate(lastDate)}</Text>
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
  product: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 1,
  },
  lastDate: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    marginTop: 2,
  },
  noData: {
    fontSize: FontSize.xs,
    color: Colors.muted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  register: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    marginTop: 4,
    fontWeight: FontWeight.semibold,
  },
  registerBold: {
    fontSize: FontSize.xs,
    color: Colors.bad,
    marginTop: 4,
    fontWeight: FontWeight.bold,
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
  badgeNever: {
    backgroundColor: Colors.bad + '30',
  },
  badgeTextNever: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.bad,
  },
  neverWarn: {
    fontSize: FontSize.xs,
    color: Colors.bad,
    marginTop: 2,
    fontWeight: FontWeight.semibold,
  },
});
