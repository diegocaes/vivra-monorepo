// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sentry from '@sentry/astro';

// Sentry solo se activa si hay DSN. Sin la variable el sitio funciona igual —
// nada de romper el build por falta de una env var de observabilidad.
const SENTRY_DSN = process.env.PUBLIC_SENTRY_DSN;

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [
    react(),
    // La configuración vive en sentry.client.config.js / sentry.server.config.js
    // (pasar opciones aquí está deprecado). No subimos sourcemaps: así el build
    // no depende de credenciales extra.
    ...(SENTRY_DSN ? [sentry({ sourceMapsUploadOptions: { enabled: false } })] : []),
  ],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  // Astro's CSRF protection is enabled explicitly because this SSR app uses
  // native POST forms for data creation, editing and deletion.
  security: {
    checkOrigin: true,
  },
});
