import { Colors } from '../../constants/theme';
import { CareCard } from './CareCard';

/**
 * ReminderCard — preventive treatment card (antipulgas / desparasitante).
 *
 * Uses the owner/veterinarian-confirmed due date (overdue / urgent / ok /
 * no date), then renders via the shared CareCard so the visual stays in sync
 * with grooming + vet cards on the dashboard.
 */

interface ReminderCardProps {
  type: 'antipulgas' | 'desparasitante';
  lastDate: string | null;
  nextDue?: string | null;
  productName?: string | null;
  onPress?: () => void;
}

const CONFIG = {
  antipulgas:    { icon: 'shield-checkmark' as const, iconColor: Colors.warn, label: 'Antipulgas' },
  desparasitante: { icon: 'medical' as const,         iconColor: '#E879F9',   label: 'Desparasitante' },
};

export function ReminderCard({ type, lastDate, nextDue, productName, onPress }: ReminderCardProps) {
  const { icon, iconColor, label } = CONFIG[type];

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

  if (!nextDue) {
    return <CareCard icon={icon} iconColor={iconColor} badge={{ text: 'Sin próxima fecha', color: Colors.muted }} title={label} subtitle={productName ?? 'Define la próxima aplicación con tu vet'} lastDate={lastDate} onPress={onPress} variant="normal" />;
  }

  const nextDate = new Date(`${nextDue}T00:00:00`);
  const daysLeft = Math.ceil((nextDate.getTime() - Date.now()) / 86400000);
  const overdue = daysLeft < 0;
  const urgent = daysLeft <= 7 && daysLeft >= 0;

  const statusColor = overdue ? '#C2410C' : urgent ? Colors.warn : Colors.good;
  const statusText = overdue
    ? 'Revisar'
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
      variant={urgent ? 'urgent' : 'normal'}
    />
  );
}
