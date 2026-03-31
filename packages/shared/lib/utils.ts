/** Calcula la edad a partir de una fecha de nacimiento (granular) */
export function calculateAge(birthDate: string): string {
  const birth = new Date(birthDate + 'T00:00:00');
  const now = new Date();
  const diffMs = now.getTime() - birth.getTime();
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (totalDays < 0) return 'Aún no nace';
  if (totalDays === 0) return 'Recién nacido';

  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth()) -
    (now.getDate() < birth.getDate() ? 1 : 0);

  // Less than 1 month: show days
  if (totalMonths < 1) {
    return `${totalDays} día${totalDays !== 1 ? 's' : ''}`;
  }

  // Less than 12 months: show months and days
  if (totalMonths < 12) {
    const monthStart = new Date(birth);
    monthStart.setMonth(monthStart.getMonth() + totalMonths);
    const days = Math.floor((now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));
    let result = `${totalMonths} mes${totalMonths !== 1 ? 'es' : ''}`;
    if (days > 0) result += ` y ${days} día${days !== 1 ? 's' : ''}`;
    return result;
  }

  // 12+ months: show years and months
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  let result = `${years} año${years !== 1 ? 's' : ''}`;
  if (months > 0) {
    result += ` y ${months} mes${months !== 1 ? 'es' : ''}`;
  }
  return result;
}

/** Verifica si hoy es el cumpleaños de la mascota */
export function isBirthday(birthDate: string): boolean {
  const birth = new Date(birthDate + 'T00:00:00');
  const now = new Date();
  return birth.getMonth() === now.getMonth() && birth.getDate() === now.getDate();
}

/** Formatea una fecha ISO a formato legible en español */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Formatea una fecha ISO a formato corto */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Retorna cuánto tiempo pasó desde un timestamp ISO (ej: "hace 2 horas") */
export function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Justo ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  return `Hace ${months} mes${months !== 1 ? 'es' : ''}`;
}

/** Retorna cuánto tiempo falta hasta una fecha */
export function timeUntil(dateStr: string): string {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) return `Hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`;
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days < 30) return `En ${days} días`;
  const months = Math.floor(days / 30);
  return `En ${months} mes${months !== 1 ? 'es' : ''}`;
}
