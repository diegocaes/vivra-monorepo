import * as Sentry from '@sentry/astro';

// Errores del navegador. Solo errores: sin performance tracing ni session
// replay — es lo que mantiene el plan gratis holgado y el overhead casi en cero.
// Sin DSN, init() es un no-op y la web funciona igual.
Sentry.init({
  dsn: import.meta.env.PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  environment: import.meta.env.PUBLIC_VERCEL_ENV ?? 'development',
  sendDefaultPii: false,
});
