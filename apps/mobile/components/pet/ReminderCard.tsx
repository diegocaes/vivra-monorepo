import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../ui/Card';
import { Colors, Spacing, FontSize, FontWeight } from '../../constants/theme';
import { formatDate } from '@vivra/shared';

interface ReminderCardProps {
  type: 'antipulgas' | 'desparasitante';
  lastDate: string | null;
  productName?: string | null;
}

const CONFIG = {
  antipulgas: { icon: 'shield-checkmark' as const, iconColor: Colors.warn, label: 'Antipulgas', cycleDays: 30 },
  desparasitante: { icon: 'medical' as const, iconColor: '#E879F9', label: 'Desparasitante', cycleDays: 30 },
};

export function ReminderCard({ type, lastDate, productName }: ReminderCardProps) {
  const { icon, iconColor, label, cycleDays } = CONFIG[type];

  if (!lastDate) {
    return (
      <Card>
        <Ionicons name={icon} size={24} color={iconColor} />
        <Text style={styles.title} numberOfLines={1}>{label}</Text>
        <Text style={styles.noData}>Sin registros</Text>
      </Card>
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

  return (
    <Card>
      <View style={styles.topRow}>
        <Ionicons name={icon} size={24} color={iconColor} />
        <View style={[styles.badge, { backgroundColor: statusColor + '18' }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>{statusText}</Text>
        </View>
      </View>
      <Text style={styles.title} numberOfLines={1}>{label}</Text>
      {productName && <Text style={styles.product} numberOfLines={1}>{productName}</Text>}
      <Text style={styles.lastDate} numberOfLines={1}>Último: {formatDate(lastDate)}</Text>
    </Card>
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
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
