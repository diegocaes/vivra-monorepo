/**
 * Monitoreo de errores — solo errores, nada de performance tracing ni session
 * replay. El objetivo es simple: enterarnos cuando algo truena en el celular de
 * un usuario, en vez de que el error muera en un console.error que nadie lee.
 *
 * IMPORTANTE — por qué el import es perezoso:
 * `@sentry/react-native` trae un módulo nativo que solo existe a partir del
 * build que lo incluya. Un `import` normal se ejecuta al cargar el archivo,
 * antes de cualquier try/catch: si este JS llegara por OTA a un binario viejo,
 * tumbaría la app en el arranque. Cargándolo dentro del try, el peor caso es
 * quedarnos sin monitoreo — nunca una app rota.
 *
 * Sin DSN configurado, nada de esto se ejecuta y la app funciona igual.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!DSN;

/** Instancia de Sentry si el módulo nativo está disponible; null si no. */
let sentry: typeof import('@sentry/react-native') | null = null;

export function initSentry() {
  if (!DSN) return;

  try {
    const mod = require('@sentry/react-native') as typeof import('@sentry/react-native');

    mod.init({
      dsn: DSN,
      // Sin tracing: mantiene el plan gratis holgado y el overhead mínimo.
      tracesSampleRate: 0,
      // En desarrollo no mandamos nada, para no contaminar el panel con ruido.
      enabled: !__DEV__,
      environment: __DEV__ ? 'development' : 'production',
      // No enviar datos personales por defecto (emails, IPs).
      sendDefaultPii: false,
      beforeSend(event) {
        // Limpieza extra: nunca mandar el email aunque algo lo adjunte.
        if (event.user) event.user = { id: event.user.id };
        return event;
      },
    });

    sentry = mod;
  } catch (e) {
    console.warn('[sentry] no disponible, la app sigue normal:', e);
  }
}

/** Reporta un error manejado. No-op si Sentry no está activo. */
export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!sentry) return;
  try {
    sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Reportar un error jamás debe provocar otro.
  }
}

/**
 * Asocia los errores al usuario (solo el id, nunca el email) para poder
 * distinguir "le pasa a todos" de "le pasa a uno".
 */
export function setSentryUser(userId: string | null) {
  if (!sentry) return;
  try {
    sentry.setUser(userId ? { id: userId } : null);
  } catch {
    // idem: nunca romper la app por telemetría.
  }
}
