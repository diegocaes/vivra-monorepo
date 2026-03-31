# Vivra iOS — Roadmap & Arquitectura

> Plan maestro para la app nativa iOS de Vivra.
> El mismo Supabase backend que usa la web. Un usuario, todos sus datos, en ambas plataformas.

---

## Estado actual

| Plataforma | Estado |
|---|---|
| Web (Astro + Supabase + Vercel) | Funcional — MVP completo |
| iOS (React Native / Expo) | Por construir |
| Backend API | Supabase (compartido) |
| Auth | Supabase Auth — email + Google OAuth |

---

## Stack iOS elegido: Expo + React Native

### Por qué Expo (y no Swift nativo ni Flutter)

| Criterio | Expo/RN | Swift nativo | Flutter |
|---|---|---|---|
| Reusar lógica de negocio (vitality score, badges, utils) | SI — mismo TS | No | No |
| Reusar tipos Supabase | SI — mismo `supabase.ts` | No | No |
| Un solo equipo / desarrollador | SI | No | Parcial |
| Velocidad de desarrollo | Alta | Baja | Media |
| Acceso a APIs nativas (cámara, notificaciones push) | SI via Expo SDK | Total | SI |
| App Store compliance | SI — Expo EAS Build | SI | SI |
| Actualizaciones OTA (sin App Store review) | SI — Expo Updates | No | No |
| Calidad UI "Apple-proof" | SI con cuidado | Total | Parcial |

**Decisión: Expo (managed workflow) + EAS Build + EAS Update.**

La app web y la app iOS comparten:
- El mismo proyecto Supabase (misma DB, mismo Auth, mismo Storage)
- Los tipos TypeScript de `src/types/supabase.ts`
- La lógica de `vitality-score.ts`, `breed-data.ts`, `utils.ts`, `badges.ts`
- Las constantes de `constants.ts`

---

## Arquitectura del repositorio

```
vivra/                          ← repositorio actual (web)
vivra-mobile/                   ← NUEVO repositorio iOS
  ├── app/                       ← Expo Router (file-based routing)
  │   ├── (auth)/
  │   │   ├── login.tsx
  │   │   ├── register.tsx
  │   │   └── forgot-password.tsx
  │   ├── (app)/
  │   │   ├── _layout.tsx        ← Tab bar principal
  │   │   ├── index.tsx          ← Dashboard (Home tab)
  │   │   ├── salud/
  │   │   │   ├── index.tsx      ← Vitality Score
  │   │   │   ├── vacunas.tsx
  │   │   │   ├── peso.tsx
  │   │   │   └── historial.tsx
  │   │   ├── alimentacion.tsx
  │   │   ├── viajes.tsx
  │   │   ├── notificaciones.tsx
  │   │   └── perfil.tsx
  │   └── _layout.tsx            ← Root layout (auth guard)
  ├── components/
  │   ├── ui/                    ← Design system atoms
  │   │   ├── Card.tsx
  │   │   ├── Button.tsx
  │   │   ├── Badge.tsx
  │   │   ├── ScoreCircle.tsx
  │   │   └── PillSelector.tsx
  │   ├── pet/
  │   │   ├── PetHeroCard.tsx
  │   │   ├── VitalityWidget.tsx
  │   │   └── FoodProgressBar.tsx
  │   └── shared/
  │       ├── LoadingScreen.tsx
  │       └── EmptyState.tsx
  ├── lib/                       ← Lógica compartida (symlink o copia de web)
  │   ├── supabase.ts            ← Cliente Supabase para RN
  │   ├── vitality-score.ts      ← MISMO archivo que la web
  │   ├── breed-data.ts          ← MISMO archivo que la web
  │   ├── badges.ts              ← MISMO archivo que la web
  │   └── utils.ts               ← MISMO archivo que la web
  ├── hooks/
  │   ├── useAuth.ts
  │   ├── usePet.ts
  │   ├── useVitality.ts
  │   └── useNotifications.ts
  ├── store/
  │   └── petStore.ts            ← Zustand (estado global liviano)
  ├── types/
  │   └── supabase.ts            ← MISMO archivo que la web
  ├── constants/
  │   └── theme.ts               ← Colores, tipografía, espaciados
  ├── assets/
  │   ├── badges/                ← Mismas imágenes de badges
  │   └── icons/
  ├── app.json                   ← Config Expo
  ├── eas.json                   ← Config EAS Build/Submit
  └── package.json
```

---

## Design system iOS

Colores (igual que la web, adaptados a RN):

```typescript
export const Colors = {
  accent: '#F97316',
  accentDark: '#EA580C',
  accentLight: '#FFF7ED',
  ink: '#0F1117',
  muted: '#6B7280',
  canvas: '#F7F8FA',
  card: '#FFFFFF',
  cardBorder: '#EAECF0',
  sidebar: '#13161C',
  // Health semantic colors
  good: '#22C55E',
  warn: '#F59E0B',
  bad: '#EF4444',
};

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const Radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };
```

Tipografía: **SF Pro** (sistema iOS, sin importar nada).

Navegación: Tab bar con 5 tabs: Inicio, Salud, Comida, Viajes, Perfil.

---

## Requisitos Apple App Store (checklist obligatorio)

### Técnicos
- [ ] Privacy Manifest (`PrivacyInfo.xcprivacy`) — requerido desde mayo 2024
- [ ] App Tracking Transparency (ATT) — si se usa analytics
- [ ] App Privacy Nutrition Label en App Store Connect
- [ ] No uso de APIs privadas
- [ ] Soporte iOS 16+ mínimo
- [ ] Universal (iPhone + iPad)
- [ ] Dark Mode support
- [ ] Dynamic Type / Accessibility labels
- [ ] Localización: español (es) como principal, inglés (en) como fallback

### Privacidad y datos
- [ ] Privacy Policy URL pública (ej: vivrapet.com/privacy)
- [ ] Terms of Service URL pública (ej: vivrapet.com/terms)
- [ ] GDPR / datos del usuario: solo datos de mascotas, no datos sensibles de personas
- [ ] Fotos de mascotas: uso claramente declarado en Privacy Nutrition Label
- [ ] Cámara: solo para fotos de mascotas (NSCameraUsageDescription)
- [ ] Fotos: para seleccionar foto de mascota (NSPhotoLibraryUsageDescription)
- [ ] Notificaciones: push opcional para recordatorios (NSUserNotificationsUsage)

### Pagos y premium
- [ ] Si hay features de pago: OBLIGATORIO usar In-App Purchase (no Stripe directo)
- [ ] Apple se lleva 15-30% de subscripciones
- [ ] Freemium base + IAP para premium = cumple guidelines
- [ ] RevenueCat para gestionar IAP de forma profesional

### Categoría App Store
- **Categoría primaria**: Health & Fitness
- **Categoría secundaria**: Lifestyle
- Esto maximiza descubrimiento orgánico en App Store

---

## Antes de empezar a codear: Fundamentos a resolver

### 1. Cuenta Apple Developer Program
- Costo: $99 USD/año
- Registrar en: developer.apple.com
- Necesario para: TestFlight, App Store, Push Notifications

### 2. App Store Connect
- Crear el app record: "Vivra"
- Bundle ID: `com.vivrapet.app`
- SKU: `vivra-ios-v1`

### 3. Privacy Policy y Terms of Service (OBLIGATORIOS para App Store)
- Crear páginas en la web: `/privacy` y `/terms`
- Contenido mínimo requerido por Apple

### 4. Supabase — cambios de backend necesarios

```sql
-- Tabla de push tokens para notificaciones push nativas
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios', -- 'ios' | 'android'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tokens" ON push_tokens
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Tabla de referidos (también necesaria para web)
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  code TEXT NOT NULL UNIQUE,
  uses_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referred_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  code TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending' | 'completed' | 'rewarded'
  reward_granted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de subscripciones / premium status
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free', -- 'free' | 'premium'
  source TEXT, -- 'referral' | 'iap' | 'promo'
  premium_until TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  iap_product_id TEXT, -- RevenueCat product ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own subscription" ON user_subscriptions
  FOR SELECT USING (user_id = auth.uid());
```

### 5. Google OAuth — configurar para mobile
- En Google Cloud Console, agregar:
  - iOS Bundle ID: `com.vivrapet.app`
  - URL Scheme: `com.vivrapet.app` (para deep link de callback)
- Supabase ya soporta esto, solo hay que agregar el Bundle ID

### 6. Supabase Storage buckets existentes
- Verificar que el bucket `pet-photos` tenga políticas correctas
- Agregar bucket `pet-docs` para documentos de viaje

---

## Roadmap por fases

---

### FASE 0 — Fundamentos (hacer ANTES de codear)
**Objetivo: Todo lo que Apple y Supabase necesitan listo.**

- [x] 0.1 — Registrar Apple Developer Program ($99) ✅
- [x] 0.2 — Registrar Bundle ID `com.vivrapet.app` + App creada en App Store Connect ✅
- [x] 0.3 — Crear página `/privacy` en la web (requerida por Apple) ✅
- [x] 0.4 — Crear página `/terms` en la web (requerida por Apple) ✅
- [x] 0.5 — Dominio propio configurado: vivrapet.com ✅
- [x] 0.6 — Email de contacto configurado: admin@vivrapet.com ✅
- [x] 0.7 — Ejecutar SQL de nuevas tablas en Supabase (push_tokens, referrals, user_subscriptions) ✅
- [x] 0.8 — Configurar Google OAuth para iOS (Bundle ID en Google Cloud Console) + OAuth Consent Screen con branding Vivra ✅
- [x] 0.9 — Crear cuenta en Expo (expo.dev) e instalar EAS CLI ✅
- [x] 0.10 — Ícono 1024x1024 creado ✅

**FASE 0 COMPLETADA — 24 marzo 2026** ✅

---

### FASE 1 — Scaffold y autenticación
**Objetivo: App funciona, el usuario puede loguearse con la misma cuenta de la web.**

- [x] 1.1 — Inicializar proyecto Expo con TypeScript + Expo Router ✅
- [x] 1.2 — Configurar cliente Supabase para React Native (`@supabase/supabase-js` + AsyncStorage) ✅
- [x] 1.3 — Auth guard (root `_layout.tsx`) — si no hay sesión → pantalla login ✅
- [x] 1.4 — Pantalla Login: email/password + Google OAuth (misma cuenta web) ✅
- [x] 1.5 — Pantalla Register: email/password (con validación) ✅
- [x] 1.6 — Deep link handler para OAuth callback (`com.vivrapet.app://auth/callback`) ✅
- [x] 1.7 — Forgot password flow ✅
- [x] 1.8 — Onboarding multi-step Apple-style (nombre → raza → datos básicos, con progress bar, skip options, logout) ✅
- [x] 1.9 — Design system base: Colors, Typography, Spacing, Button, Card, LoadingScreen ✅
- [x] 1.10 — Tab bar con 5 tabs (Ionicons) ✅

**FASE 1 COMPLETADA — 24 marzo 2026** ✅

---

### FASE 2 — Dashboard y Vitality Score
**Objetivo: La pantalla principal con toda la info de la mascota.**

- [x] 2.1 — PetHeroCard (foto, nombre, raza, edad, peso) ✅
- [x] 2.2 — Vitality Score circle + barras de pilares (reusar lógica de `vitality-score.ts`) ✅
- [x] 2.3 — Widget de comida (progreso de la bolsa, días restantes) ✅
- [x] 2.4 — Cards de recordatorios (antipulgas, desparasitante) ✅
- [x] 2.5 — Pull-to-refresh ✅
- [x] 2.6 — Fun fact del día (reusar `breeds.ts`) ✅
- [x] 2.7 — Selector de mascota activa (si tiene varias) ✅
- [x] 2.8 — Skeleton loading states ✅

**FASE 2 COMPLETADA — 24 marzo 2026** ✅

---

### FASE 3 — Salud (vacunas, peso, historial vet)
**Objetivo: Todo el módulo de salud funcional.**

- [x] 3.1 — Pantalla Salud con el score completo (5 pilares, flags) + nav cards ✅
- [x] 3.2 — Lista de vacunas con badges (imágenes copiadas a assets/badges/) ✅
- [x] 3.3 — Agregar vacuna (bottom sheet form) + eliminar ✅
- [x] 3.4 — Gráfica de peso (react-native-svg, gradiente, puntos, ejes) ✅
- [x] 3.5 — Agregar registro de peso + actualizar pet.weight_kg ✅
- [x] 3.6 — Lista de visitas al veterinario + agregar + eliminar ✅
- [x] 3.7 — Historial de groomings con tipos + agregar + eliminar ✅
- [x] 3.8 — Preventivos (antipulgas + desparasitante) con status cards + historial ✅

**FASE 3 COMPLETADA — 24 marzo 2026** ✅

---

### FASE 4 — Alimentación
**Objetivo: Control de dieta e inventario.**

- [x] 4.1 — Card de comida activa con barra de progreso ✅
- [x] 4.2 — Agregar/editar comida (soporte BARF, mixto, kibble) ✅
- [x] 4.3 — Historial de comidas ✅
- [x] 4.4 — Snacks y premios (agregar, eliminar, gasto total) ✅

**FASE 4 COMPLETADA — 24 marzo 2026** ✅

---

### FASE 5 — Viajes y pasaporte
**Objetivo: Módulo de viajes completo.**

- [x] 5.1 — Lista de vuelos con tabs (próximos / historial) ✅
- [x] 5.2 — Agregar/editar vuelo con checklist de documentos (6 items) ✅
- [x] 5.3 — Stats (vuelos, destinos, costo total) ✅
- [x] 5.4 — Countdown badges (HOY, MAÑANA, Xd) ✅
- [ ] 5.5 — Vista "Pasaporte" compartible (Share Sheet)
- [ ] 5.6 — Upload de documentos de vuelo

**FASE 5 PARCIAL — 24 marzo 2026** (5.1-5.4 listos)

---

### FASE 6 — Perfil y ajustes
**Objetivo: Configuración de cuenta y mascota.**

- [x] 6.1 — Hero card con foto, nombre, raza, edad ✅
- [x] 6.2 — Editar datos de mascota (bottom sheet form) ✅
- [x] 6.3 — Selector de tema de color (6 colores) ✅
- [x] 6.4 — Barra de completitud del perfil (8 campos) ✅
- [x] 6.5 — Cerrar sesión ✅
- [x] 6.6 — Eliminar mascota ✅
- [ ] 6.7 — Código de referido personal + compartir
- [ ] 6.8 — Estadísticas de referidos

**FASE 6 PARCIAL — 24 marzo 2026** (6.1-6.6 listos)

---

### FASE 7 — Notificaciones push nativas
**Objetivo: La app avisa cuando hay algo importante.**

- [x] 7.1 — Configurar Expo Notifications + APNs (Apple Push Notification Service) ✅
- [x] 7.2 — Guardar push token en tabla `push_tokens` de Supabase ✅
- [ ] 7.3 — Supabase Edge Function para enviar notificaciones push
- [x] 7.4 — Triggers automáticos: antipulgas/desparasitante próximo (3 días antes) ✅
- [x] 7.5 — Trigger: comida por acabarse (≤3 días) ✅
- [x] 7.6 — Notificación de cumpleaños de la mascota ✅
- [x] 7.7 — Centro de notificaciones in-app (igual que la web) ✅

**FASE 7 PARCIAL — 25 marzo 2026** (7.1-7.2, 7.4-7.7 listos, 7.3 Edge Function pendiente)

---

### FASE 8 — Premium e In-App Purchase (IAP)
**Objetivo: Monetización que cumple con Apple.**

- [x] 8.1 — Integrar RevenueCat SDK (`react-native-purchases`) ✅
- [ ] 8.2 — Crear productos en App Store Connect + conectar con RevenueCat dashboard
  - `vivra_premium_monthly` — $2.99/mes (7 días trial)
  - `vivra_premium_yearly` — $19.99/año
- [x] 8.3 — Paywall screen (modal, planes, features, legal) ✅
- [x] 8.4 — Gates de features premium (temas de color, upsell card en perfil) ✅
- [x] 8.5 — Restore purchases ✅
- [ ] 8.6 — Webhook RevenueCat → Supabase (actualizar `user_subscriptions`)
- [x] 8.7 — Productos configurados en App Store Connect + RevenueCat dashboard ✅
- [x] 8.8 — StoreKit Configuration File para testing local ✅
- [x] 8.9 — Testing IAP en dispositivo físico (iPhone) con StoreKit sandbox ✅

**FASE 8 PARCIAL — 26 marzo 2026** (8.1-8.5, 8.7-8.9 listos, 8.6 webhook pendiente)

---

### FASE 8.5 — Premium value & freemium polish
**Objetivo: Que Premium realmente valga la pena y el freemium sea atractivo.**

- [x] 8.5.1 — Gate mascotas ilimitadas (FREE_LIMITS.MAX_PETS = 1, premium hasta 5) ✅
- [x] 8.5.2 — Gate gráfico de peso + estadísticas avanzadas (min/max/promedio) detrás de premium ✅
- [x] 8.5.3 — Premium upsell banners en Dashboard y Salud (sutiles, no invasivos) ✅
- [x] 8.5.4 — Actualizar PREMIUM_FEATURES: quitar push notifications (gratis para todos), agregar estadísticas avanzadas ✅
- [x] 8.5.5 — FAQ section en perfil (copiado de web: score, pilares, múltiples mascotas, seguridad) ✅
- [x] 8.5.6 — Cambiar foto de mascota (expo-image-picker + Supabase Storage) ✅
- [x] 8.5.7 — Pet switcher en perfil (chips horizontales, agregar mascota) ✅
- [x] 8.5.8 — Zona de peligro reorganizada (eliminar mascota + eliminar cuenta centrados) ✅
- [x] 8.5.9 — Eliminar cuenta vía Edge Function (requisito Apple) ✅
- [x] 8.5.10 — PetContext compartido: pet switching sincronizado en TODOS los tabs ✅
- [x] 8.5.11 — Agregar mascota navega a onboarding completo (no Alert.prompt) ✅
- [x] 8.5.12 — FAQ minimalist (colapsable, oculto por defecto) ✅
- [x] 8.5.13 — Onboarding: fecha nacimiento con masked input DD/MM/AAAA ✅
- [x] 8.5.14 — Limpieza imports no usados (useAuth, Pet type) en tabs ✅
- [ ] 8.5.15 — Exportar historial médico a PDF (premium)
- [ ] 8.5.16 — Pasaporte compartible (premium)

**FASE 8.5 PARCIAL — 26 marzo 2026** (8.5.1-8.5.14 listos, 8.5.15-8.5.16 pendientes)

---

### FASE 9 — Pulido y App Store submission
**Objetivo: Pasar review de Apple a la primera.**

- [ ] 9.1 — Privacy Manifest (`PrivacyInfo.xcprivacy`)
- [ ] 9.2 — App icon en todos los tamaños (1024x1024 base, Expo genera el resto)
- [ ] 9.3 — Launch Screen (Splash screen)
- [ ] 9.4 — Screenshots para App Store (6.7" iPhone 16 Pro Max, 6.5" iPhone 14 Plus, iPad)
- [ ] 9.5 — App Store description en español + inglés
- [ ] 9.6 — Keywords research y optimización ASO
- [ ] 9.7 — TestFlight beta (amigos + familia)
- [ ] 9.8 — Responder review de Apple
- [ ] 9.9 — Launch en App Store

---

## Librerías clave del proyecto iOS

```json
{
  "expo": "~52.x",
  "expo-router": "~4.x",
  "expo-notifications": "para APNs",
  "expo-image-picker": "para fotos de mascotas",
  "expo-sharing": "para compartir pasaporte",
  "expo-updates": "para OTA updates sin App Store review",
  "@supabase/supabase-js": "mismo que la web",
  "@react-native-async-storage/async-storage": "para sesión Supabase en RN",
  "zustand": "estado global liviano",
  "react-native-reanimated": "animaciones fluidas 60fps",
  "react-native-gesture-handler": "gestos nativos",
  "react-native-svg": "para gráficas y score circle",
  "victory-native": "para gráfica de peso",
  "react-native-purchases": "RevenueCat para IAP"
}
```

---

## Estructura de datos compartida Web + iOS

```
Supabase (backend único)
├── auth.users           ← misma cuenta, funciona en web y en app
├── pets                 ← se ven en ambas plataformas en tiempo real
├── vaccines             ← idem
├── vet_visits           ← idem
├── weight_records       ← idem
├── groomings            ← idem
├── foods                ← idem
├── flights              ← idem
├── adventures           ← idem
├── preventive_treatments← idem
├── notifications        ← compartidas (generadas en web, leídas en app y vice versa)
├── push_tokens          ← solo iOS/Android
├── referral_codes       ← compartidas
├── referrals            ← compartidas
└── user_subscriptions   ← compartidas (premium en web = premium en app)
```

---

## Qué hacer primero (esta semana)

**Estado actual de fundamentos (Marzo 2026):**

- [x] Páginas `/privacy` y `/terms` en la web ✅
- [x] Dominio vivrapet.com configurado ✅
- [x] Email admin@vivrapet.com configurado ✅
- [x] Tablas Supabase: push_tokens, referrals, user_subscriptions ✅
- [x] **Apple Developer Program** registrado ✅
- [x] **App Store Connect** configurado con Bundle ID `com.vivrapet.app` ✅
- [x] **Google OAuth para iOS** configurado ✅
- [x] **Expo + EAS CLI** configurado ✅
- [x] **Fase 1 completada** — scaffold, auth, design system, tab bar ✅

**SIGUIENTE: Fase 9 — Pulido y App Store submission**

---

## Preguntas a responder antes de fase 1

- [ ] ¿El nombre en App Store será "Vivra" exacto? (verificar disponibilidad)
- [ ] ¿Primero solo iPhone o también iPad desde el inicio?
- [ ] ¿El premium de la app web también se gestiona con RevenueCat, o queda como pago directo (Stripe)?
- [ ] ¿Habrá Android también, o solo iOS por ahora?

---

*Última actualización: 26 Marzo 2026*
