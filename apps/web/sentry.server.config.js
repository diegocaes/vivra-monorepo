import * as Sentry from '@sentry/astro';

// Errores del SSR (páginas .astro y endpoints /api). Aquí es donde se ven los
// 500 reales que el usuario percibe como "no cargó".
Sentry.init({
  dsn: process.env.PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? 'development',
  sendDefaultPii: false,
});
