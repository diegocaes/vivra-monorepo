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

/**
 * Traduce errores técnicos de Supabase/Postgres/red a mensajes en español
 * entendibles por el usuario. Los Alert de la app NUNCA deben mostrar
 * `error.message` crudo ("duplicate key value violates...", "JWT expired"):
 * confunden y filtran detalles internos. El mensaje original se preserva en
 * consola para debugging — este helper es solo para UI.
 */
export function friendlyError(error: { message?: string; code?: string } | string | null | undefined): string {
  const raw = (typeof error === 'string' ? error : error?.message ?? '').toLowerCase();
  const code = typeof error === 'object' && error ? error.code : undefined;

  if (!raw && !code) return 'Algo salió mal. Intenta de nuevo.';

  // Network / connectivity
  if (raw.includes('network') || raw.includes('fetch failed') || raw.includes('timeout') || raw.includes('failed to fetch')) {
    return 'Sin conexión. Revisa tu internet e intenta de nuevo.';
  }
  // Auth
  if (raw.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (raw.includes('email not confirmed') || raw.includes('not confirmed')) return 'Confirma tu email antes de iniciar sesión. Revisa tu bandeja.';
  if (raw.includes('user already registered') || raw.includes('already been registered')) return 'Ya existe una cuenta con este email. Inicia sesión.';
  if (raw.includes('jwt') || raw.includes('expired') || raw.includes('not authenticated')) return 'Tu sesión expiró. Cierra y vuelve a abrir la app.';
  if (raw.includes('rate limit') || raw.includes('too many requests')) return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
  if (raw.includes('password') && raw.includes('at least')) return 'La contraseña debe tener al menos 8 caracteres.';
  // Postgres / RLS
  if (code === '23505' || raw.includes('duplicate key')) return 'Este registro ya existe.';
  if (code === '23503' || raw.includes('foreign key')) return 'No se pudo guardar: hay datos relacionados faltantes.';
  if (code === '42501' || raw.includes('row-level security') || raw.includes('permission denied')) {
    return 'No tienes permiso para hacer esto.';
  }
  if (code === '23502' || raw.includes('null value')) return 'Falta un campo obligatorio.';
  if (raw.includes('value too long')) return 'Uno de los campos es demasiado largo.';
  // Storage
  if (raw.includes('payload too large') || raw.includes('exceeded the maximum allowed size')) {
    return 'El archivo es demasiado grande. Usa una imagen más liviana.';
  }

  return 'No se pudo completar la operación. Intenta de nuevo.';
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

/**
 * Formatea un monto monetario con separador de miles (`,`) y dos decimales (`.`).
 * Evita errores de punto flotante (ej. 255.23999999999998 → "255.24").
 * No incluye el símbolo de moneda — el caller lo antepone según el contexto.
 *
 * Implementación manual (no usa `toLocaleString`) para garantizar consistencia
 * en React Native Hermes, que no incluye full ICU locale data por defecto y
 * puede devolver "1234.50" sin separador de miles. Aquí siempre devolvemos
 * formato `1,234.56` independiente del runtime.
 *
 * Ejemplo: formatCurrency(255.23999999999998) → "255.24"
 *          formatCurrency(1234.5)             → "1,234.50"
 *          formatCurrency(-99.5)              → "-99.50"
 *          formatCurrency(null)               → "0.00"
 */
export function formatCurrency(value: number | null | undefined): string {
  const n = typeof value === 'number' && isFinite(value) ? value : 0;
  // Redondeamos primero para normalizar artefactos de float.
  const rounded = Math.round(n * 100) / 100;
  const sign = rounded < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(rounded).toFixed(2).split('.');
  // Inserta coma cada 3 dígitos desde la derecha (excepto al final).
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${withCommas}.${decPart}`;
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
