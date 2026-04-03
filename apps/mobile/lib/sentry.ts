import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] No DSN configured — crash reporting disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    debug: __DEV__,
    enabled: !__DEV__,
  });
}

/**
 * Capture a non-fatal error with optional context
 */
export function captureError(error: unknown, context?: Record<string, string>) {
  if (__DEV__) {
    console.error('[Sentry]', error);
    return;
  }
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Set user identity for crash reports
 */
export function setSentryUser(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email });
}

/**
 * Clear user on logout
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}
