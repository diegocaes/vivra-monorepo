import { Colors } from '../../constants/theme';
import { CareCard } from './CareCard';

/**
 * ReminderCard — preventive treatment card (antipulgas / desparasitante).
 *
 * Owns the 30-day-cycle status logic (next due date, overdue / urgent / ok /
 * never), then renders via the shared CareCard so the visual stays in sync
 * with grooming + vet cards on the dashboard.
 */

interface ReminderCardProps {
  type: 'antipulgas' | 'desparasitante';
  lastDate: string | null;
  productName?: string | null;
  onPress?: () => void;
}

const CONFIG = {
  antipulgas:    { icon: 'shield-checkmark' as const, iconColor: Colors.warn, label: 'Antipulgas', cycleDays: 30 },
  desparasitante: { icon: 'medical' as const,         iconColor: '#E879F9',   label: 'Desparasitante', cycleDays: 30 },
};

export function ReminderCard({ type, lastDate, productName, onPress }: ReminderCardProps) {
  const { icon, iconColor, label, cycleDays } = CONFIG[type];

  // No history is not evidence that the pet is unprotected. New users often
  // add the information later, so this stays neutral and inviting.
  if (!lastDate) {
    return (
      <CareCard
        icon={icon}
        iconColor={iconColor}
        badge={{ text: 'Sin registro', color: Colors.muted }}
        title={label}
        subtitle="Agrega la última dosis cuando la tengas"
        emptyText={onPress ? 'Agregar fecha →' : 'Toca para agregar'}
        onPress={onPress}
        variant="normal"
      />
    );
  }

  const nextDate = new Date(lastDate);
  nextDate.setDate(nextDate.getDate() + cycleDays);
  const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / 86400000);
  const overdue = daysLeft < 0;
  const urgent = daysLeft <= 7 && daysLeft >= 0;

  const statusColor = overdue ? Colors.bad : urgent ? Colors.warn : Colors.good;
  const statusText = overdue
    ? `Vencido ${Math.abs(daysLeft)}d`
    : daysLeft === 0 ? 'Hoy'
    : `En ${daysLeft}d`;

  return (
    <CareCard
      icon={icon}
      iconColor={iconColor}
      badge={{ text: statusText, color: statusColor }}
      title={label}
      subtitle={productName ?? null}
      lastDate={lastDate}
      onPress={onPress}
      variant={overdue ? 'overdue' : urgent ? 'urgent' : 'normal'}
    />
  );
}
