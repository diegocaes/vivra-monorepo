# Vivra — Contexto Completo del Proyecto

Documento exhaustivo para que cualquier AI o desarrollador entienda el proyecto al 100%.

---

## Que es Vivra

App movil-first para duenos de perros. Permite registrar salud, alimentacion, viajes, grooming, actividad y mas. Genera un "Vitality Score" (0-100) basado en datos reales del perro. Tiene sistema de badges, referidos, y modelo freemium.

**Stack**: Astro 5 SSR + Supabase (auth + DB + storage) + Tailwind CSS v4 + React islands. Deploy en Vercel.

**Estado**: MVP funcional, en uso. Preparandose para app iOS nativa (Expo + React Native, mismo backend Supabase).

---

## Arquitectura

```
src/
  pages/          Rutas SSR (file-based routing de Astro)
  components/     Componentes Astro + 1 React (WeightChart.tsx)
  layouts/        MainLayout.astro (layout principal con sidebar)
  lib/            Logica de negocio pura (TS), reutilizable en iOS
  styles/         global.css (Tailwind v4 @theme + custom classes)
  middleware.ts   Auth guard + inyecta supabase/user en Astro.locals
  types/          supabase.ts (tipos generados)
```

### Flujo de una request
1. `middleware.ts` intercepta → verifica auth con Supabase → inyecta `user`, `supabase`, `activePetId` en `Astro.locals`
2. Rutas publicas (`/`, `/login`, `/register`, `/forgot-password`, `/api/auth/callback`) pasan sin auth
3. Rutas protegidas redirigen a `/login` si no hay sesion
4. Cada pagina hace queries a Supabase con el client inyectado (RLS filtra por user_id)

### Variables de entorno
```
PUBLIC_SUPABASE_URL=https://upjiewrirkzhjeciwugg.supabase.co
PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...       # Solo server-side, para operaciones admin
FORCE_PREMIUM=true                  # Opcional, para testear premium en local
```

---

## Base de Datos (Supabase / PostgreSQL)

### Tablas principales

| Tabla | Descripcion | Columnas clave |
|-------|-------------|----------------|
| `pets` | Mascota del usuario | id, user_id, name, breed, birth_date, gender, weight_kg, photo_url, chip_id, color (pelaje), theme_color (tema UI), is_neutered, birth_city, birth_country |
| `vaccines` | Registro de vacunas | id, pet_id, name, date_given, next_due, vet_name, notes |
| `vet_visits` | Consultas veterinarias | id, pet_id, date, reason, vet_name, clinic_name, location, diagnosis, treatment, cost, notes |
| `weight_records` | Historial de peso | id, pet_id, weight_kg, date, notes |
| `groomings` | Banos y estetica | id, pet_id, date, type (bano/corte/unas/oidos/dientes/completo/otro), groomer_name, cost |
| `foods` | Alimentos registrados | id, pet_id, brand, type (croquetas/humedo/barf/mixto/snacks/otro), daily_grams, bag_size, bag_unit, price, start_date |
| `flights` | Vuelos con mascota | id, pet_id, airline, flight_number, origin, destination, flight_date, cabin_or_cargo, ticket_price + 6 booleans de checklist |
| `flight_documents` | Docs subidos por vuelo | id, flight_id, name, file_url |
| `preventive_treatments` | Antipulgas/desparasitante | id, pet_id, type, product_name, date_given |
| `activity_logs` | Paseos diarios | id, pet_id, date, walks, duration_minutes |
| `adventures` | Aventuras/paseos especiales | id, pet_id, title, description, date, location, photo_url |
| `owner_profiles` | Perfil del dueno | user_id, first_name, last_name, phone, email |
| `notifications` | Centro de notificaciones | id, user_id, pet_id, type, title, message, icon, href, read, created_at |

### Tablas del sistema de referidos y premium

| Tabla | Descripcion |
|-------|-------------|
| `referral_codes` | Un codigo unico por usuario (ej: TINTO2847). Se genera al crear la primera mascota |
| `referrals` | Quien refirio a quien. Status: pending -> completed -> rewarded |
| `user_subscriptions` | Plan del usuario: free o premium. Source: referral/iap/promo/trial. premium_until: fecha de expiracion |

SQL completo en: `docs/sql/referrals.sql`

---

## Rutas (todas las paginas)

### Publicas (sin auth)
| Ruta | Archivo | Descripcion |
|------|---------|-------------|
| `/` | index.astro | Landing page con hero, features, CTA "Tengo invitacion" |
| `/login` | login.astro | Login email/password + Google OAuth |
| `/register` | register.astro | Registro invite-only (requiere codigo de referido) |
| `/forgot-password` | forgot-password.astro | Recuperar contrasena |
| `/api/auth/callback` | api/auth/callback.ts | Maneja OAuth callback + email OTP + procesa referido |

### Protegidas (requieren auth)
| Ruta | Archivo | Descripcion |
|------|---------|-------------|
| `/dashboard` | dashboard.astro | Hub principal: hero card, vitality score mini, checklist, badges, recordatorios |
| `/perfil` | perfil.astro | Editar perfil de mascota + datos del dueno + selector de tema de color |
| `/onboarding` | onboarding.astro | Crear mascota (4 pasos: welcome, nombre/raza, detalles, celebracion). Tambien modo `?add=1` para agregar mas mascotas |
| `/salud` | salud/index.astro | Dashboard de salud: gauge 0-100, pilares, tips, flags, accesos rapidos |
| `/salud/vacunas` | salud/vacunas.astro | Registro de vacunas + galeria de badges PNG |
| `/salud/historial` | salud/historial.astro | Historial de visitas al veterinario |
| `/salud/peso` | salud/peso.astro | Control de peso + grafica (React WeightChart) |
| `/salud/preventivos` | salud/preventivos.astro | Antipulgas y desparasitante (ciclo 30 dias) |
| `/salud/grooming` | salud/grooming.astro | Banos y estetica |
| `/salud/actividad` | salud/actividad.astro | Registro de paseos diarios |
| `/alimentacion` | alimentacion.astro | Tracking de comida: marca, tipo, gramos, costo/dia, dias restantes |
| `/viajes` | viajes.astro | Vuelos + checklist de documentos + upload de archivos |
| `/calendario` | calendario.astro | Vista calendario de todos los eventos |
| `/badges` | badges.astro | Galeria de insignias (engagement + vacunas) |
| `/notificaciones` | notificaciones.astro | Centro de notificaciones (marca como leidas al abrir) |
| `/referidos` | referidos.astro | Dashboard de referidos: codigo, stats, milestones, como funciona |
| `/premium` | premium.astro | Pagina de info premium: comparacion free vs premium, como obtenerlo |
| `/print` | print.astro | Pasaporte imprimible (layout tipo documento oficial + franja MRZ) |
| `/faq` | faq.astro | Preguntas frecuentes |
| `/api/pets/switch` | api/pets/switch.ts | Cambiar mascota activa (POST, guarda cookie) |

---

## Sistema Premium / Free

### Archivo central: `src/lib/premium.ts`

Este es el SINGLE SOURCE OF TRUTH. Puro TypeScript, sin dependencias de DB. Funciona en web y se reutilizara en iOS.

### Que es FREE y que es PREMIUM

| Feature | Free | Premium |
|---------|------|---------|
| Mascotas | 1 | Hasta 10 |
| Vitality Score (numero general) | SI | SI |
| Desglose por pilar + tips + flags | NO | SI |
| Grafica de peso | NO (blur + CTA) | SI |
| Registros de peso | 6 max | Ilimitados |
| Exportar PDF de salud | NO | SI |
| Registro de comida | 1 alimento max | Ilimitados |
| Analytics de comida (costo/dia) | NO (blur + CTA) | SI |
| Inventario de comida (stock alerts) | NO | SI |
| Pasaporte basico | SI | SI |
| Imprimir pasaporte | NO (redirect a /premium) | SI |
| Vuelos | 1 max | Ilimitados |
| Subir documentos de vuelo | NO (toast error) | SI |
| Calendario basico | SI | SI |
| Push notifications (futuro iOS) | NO | SI |
| Referidos | SI (es el growth engine) | SI |
| Badges/insignias | SI (es engagement) | SI |
| Exportar todos los datos (CSV/PDF) | NO | SI |

### Como se aplica el gate en cada pagina

**PremiumGate.astro** — Componente wrapper. Contenido premium se muestra blurreado con overlay y boton "Desbloquear Premium" que lleva a `/premium`.

```astro
<PremiumGate isPremium={premium.isPremium} feature="weightChart" title="Grafica de peso" description="...">
  <WeightChart records={records} client:load />
</PremiumGate>
```

**isAtLimit()** — Para limites numericos. Se checa server-side en el POST handler antes de insertar.

```typescript
if (isAtLimit('maxWeightRecords', weightCount ?? 0, premium)) {
  return Astro.redirect('/salud/peso?toast_error=Limite alcanzado...');
}
```

**canAccess()** — Para features booleanas. Redirect o toast error.

```typescript
if (!canAccess('printPassport', premium)) {
  return Astro.redirect('/premium');
}
```

### Donde se aplica cada gate

| Pagina | Gate | Mecanismo |
|--------|------|-----------|
| `salud/peso.astro` | Grafica de peso blurreada | PremiumGate component |
| `salud/peso.astro` | Limite 12 registros de peso | isAtLimit en POST |
| `salud/index.astro` | Pilares del score blurreados | PremiumGate component |
| `salud/index.astro` | Tips y flags ocultos | conditional render `premium.isPremium &&` |
| `alimentacion.astro` | Analytics (costo/dia, promedios) blurreados | PremiumGate component |
| `alimentacion.astro` | Limite 2 alimentos | isAtLimit en POST |
| `viajes.astro` | Limite 2 vuelos | isAtLimit en POST |
| `viajes.astro` | Upload de documentos bloqueado | canAccess en POST |
| `print.astro` | Redirect completo a /premium | canAccess redirect |
| `onboarding.astro` | Agregar 2da+ mascota redirect a /premium | isAtLimit redirect |

### Feature gates (toggles)

```typescript
export const FEATURE_GATES = {
  multiplePets: true,          // Mas de 1 mascota
  vitalityScore: false,        // Score basico: FREE
  vitalityDetails: true,       // Desglose por pilar
  weightChart: true,           // Grafica de peso
  exportHealthPdf: true,       // Exportar PDF
  foodTracking: false,         // Registrar comida: FREE
  foodInventory: true,         // Inventario avanzado
  costAnalysis: true,          // Costo por dia
  passport: false,             // Pasaporte basico: FREE
  flightDocuments: true,       // Subir docs de vuelo
  printPassport: true,         // Imprimir pasaporte
  calendar: false,             // Calendario: FREE
  pushNotifications: true,     // Push nativo (iOS)
  referrals: false,            // Referidos: FREE
  badges: false,               // Badges: FREE
  dataExport: true,            // Exportar datos
};
```

### Limites

```typescript
export const LIMITS = {
  free: { maxPets: 1, maxVaccineRecords: 20, maxWeightRecords: 6, maxVetVisits: 10, maxFoods: 1, maxFlights: 1 },
  premium: { maxPets: 10, maxVaccineRecords: Infinity, maxWeightRecords: Infinity, maxVetVisits: Infinity, maxFoods: Infinity, maxFlights: Infinity },
};
```

### Como se obtiene premium

1. **Referidos**: Cada amigo que se registra y crea su mascota = 1 mes premium para el referidor. El referido recibe 14 dias trial.
2. **Suscripcion (proximamente)**: $2.99/mes o $19.99/ano via Stripe (web) o Apple IAP (iOS) con RevenueCat como capa unificada.

### Testing local

`FORCE_PREMIUM=true` en `.env` bypasea todos los gates y devuelve premium=true siempre.

---

## Sistema de Referidos

### Flujo completo

1. Usuario A comparte su codigo (ej: TINTO2847) o link (`/register?ref=TINTO2847`)
2. Usuario B va a `/register`, ingresa el codigo (obligatorio, invite-only)
3. Codigo se valida contra `referral_codes` con admin client
4. Se guarda en cookie `pending_referral` (HttpOnly, persiste durante OAuth/email flow)
5. En `/api/auth/callback`, despues de auth exitoso:
   - Lee cookie `pending_referral`
   - Busca el dueno del codigo en `referral_codes`
   - Crea registro en `referrals` con status=pending
   - Borra cookie
6. En `/onboarding`, al crear la primera mascota:
   - Genera codigo de referido para el nuevo usuario (NOMBRE_MASCOTA + 4 digitos)
   - Marca referral como completed
   - Da +30 dias premium al referidor (extiende si ya tenia)
   - Da 14 dias trial al referido
   - Marca referral como rewarded

### Prevencion de abusos
- Self-referral bloqueado (verifica `referrer_id !== user.id`)
- Un usuario solo puede ser referido una vez (UNIQUE constraint en referred_id)
- Codigo obligatorio para registrarse (no hay registro sin invitacion)

---

## Vitality Score (Motor de Salud)

### Archivo: `src/lib/vitality-score.ts`

Score de 0 a 100, dividido en 5 pilares de 20 puntos cada uno:

| Pilar | Que evalua | Datos que usa |
|-------|-----------|---------------|
| Peso | BCS (Body Condition Score), rango ideal por raza | weight_records, breed_data |
| Cuidado preventivo | Vacunas al dia, visitas al vet recientes | vaccines, vet_visits |
| Raza y edad | Riesgos geneticos, etapa de vida | breed, birth_date, breed_data |
| Actividad | Frecuencia de paseos, grooming | activity_logs, groomings |
| Nutricion | Calidad de dieta, porcion adecuada | foods |

### Output
```typescript
{
  total: 72,                    // Score final
  color: '#22C55E',             // Verde=bueno, amber=regular, rojo=malo
  headline: 'Buen estado',      // Texto principal
  subline: '...',               // Descripcion
  showScore: true,              // false si faltan datos minimos
  pillars: [                    // Detalle por pilar
    { name: 'Peso', emoji: '...', score: 16, max: 20, pct: 80, description: '...', status: '...', tips: ['...'] }
  ],
  pendingAreas: [               // Areas sin datos suficientes
    { label: 'Registra el peso', href: '/salud/peso' }
  ],
  flags: [                      // Alertas/avisos
    { message: '...', action: '...', href: '...', severity: 'suggestion' }
  ]
}
```

### Datos de razas: `src/lib/breed-data.ts`
~40 razas con: peso ideal (min/max kg), esperanza de vida, riesgos de salud, riesgo dental/cardiaco/obesidad, edad senior.

---

## Sistema de Badges

### Archivo: `src/lib/badges.ts`

**11 badges de engagement:**
- Perfil completo, Primera vacuna, Vacunas al dia (3+), Veterinario (1+ visita), Preventivos al dia, Primer peso, Control de peso (3+ registros), Grooming, Nutricion, Primer vuelo, Viajero frecuente (3+ vuelos)

**6 badges de vacunas** (uno por tipo):
- Rabia, Parvo, Moquillo, Bordetella, Leptospirosis, Hepatitis

Cada badge tiene imagen PNG en `/public/badges/`. Se evaluan con `evaluateBadges(counts)`.

---

## Notificaciones

### Tabla: `notifications`
- Se generan server-side en `/dashboard` comparando estado actual vs cookie `pet_snapshot`
- Tipos: `badge_earned`, `score_improved`
- Se marcan como leidas al abrir `/notificaciones`
- Contador de no leidas aparece en la campana del Sidebar (mobile + desktop)

---

## Componentes Clave

### Sidebar.astro
- **Desktop**: Sidebar fijo (w-55), fondo oscuro (#13161C)
- **Mobile**: Top bar + drawer hamburguesa
- Pet switcher dropdown (muestra foto/inicial de cada mascota)
- Nav links con iconos SVG sprite
- Campana de notificaciones con badge rojo (unreadCount)
- Bottom: Perfil, Ayuda, Sugerencias

### MainLayout.astro
- HTML head completo (meta, fonts Inter, PWA manifest, favicon)
- Sidebar + main content (lg:ml-55, max-w-3xl)
- Toast + FormEnhancements incluidos automaticamente
- Service worker registration
- Cap de date inputs (max=today excepto next_due, flight_date, start_date)
- Query de unreadCount para notificaciones
- Query de premium status
- `data-pet-theme` en body para temas de color

### PremiumGate.astro
- Wrapper: premium users ven el contenido normal, free users ven blur + overlay con CTA
- Props: isPremium, feature, title, description

### WeightChart.tsx (React)
- Unico componente React (island). Grafica SVG de peso historico.
- Usa `client:load` para hidratarse en el cliente.

---

## Estilos y Temas

### Tailwind v4 con @theme en global.css

**Colores del sistema:**
- `canvas` #F7F8FA (fondo general)
- `sidebar` #13161C (sidebar oscuro)
- `card` #FFFFFF (tarjetas blancas)
- `card-border` #EAECF0 (bordes sutiles)
- `accent` #F97316 (naranja, color principal/CTA)
- `accent-dark` #EA580C
- `accent-light` #FFF7ED
- `ink` #0F1117 (texto principal)
- `muted` #6B7280 (texto secundario)

**Temas de mascota** (seleccionable en `/perfil`):
orange (default), rose, purple, blue, teal, gold, yellow, sky.
Cada uno sobreescribe `--color-accent` via `body[data-pet-theme="nombre"]`.

**Reglas de estilo:**
- NO usar `bg-gradient-to-*` (Tailwind v4 usa `bg-linear-to-*`)
- NO usar arbitrary values como `w-[420px]` (usar escala: `w-105`)
- Colores de salud son semanticos: verde=#22C55E (bueno), amber (regular), rojo (malo) — nunca naranja de marca
- Solo el hero card del dashboard usa color vibrante (accent), el resto son white cards con bordes

### Animaciones
- `.animate-fade-up` + delays (0, 1, 2, 3) para entradas escalonadas
- `.animate-scale-in` para empty states
- `.animate-float` para iconos
- View Transitions de Astro (`astro:page-load` event)

---

## Patrones de Codigo

### Forms
Todas las paginas usan POST nativo con campo hidden `_action`:
```html
<input type="hidden" name="_action" value="add" />
```
El frontmatter de Astro maneja `if (Astro.request.method === 'POST')` con switch por action.

### Toasts
Se disparan con query params en redirects:
- `?saved=1` — toast verde "Guardado"
- `?deleted=1` — toast info "Eliminado"
- `?toast_error=mensaje` — toast rojo con mensaje custom

### Navegacion
View Transitions de Astro. Todos los scripts usan `document.addEventListener('astro:page-load', ...)` en vez de `DOMContentLoaded`.

### Pet context
Cada pagina protegida hace:
```typescript
const { supabase, user, activePetId } = Astro.locals;
const { pet } = await getActivePet(supabase, user.id, activePetId);
if (!pet) return Astro.redirect('/onboarding');
```

---

## Auth Flow

1. **Email + Password**: Form POST a Supabase `signInWithPassword`
2. **Google OAuth**: Redirect a Supabase OAuth, callback en `/api/auth/callback`
3. **Email OTP**: Para registro, Supabase envia email de confirmacion, callback maneja el token
4. **Middleware**: Verifica sesion en cada request, inyecta `user` y `supabase` en locals
5. **Referral persistence**: Cookie `pending_referral` sobrevive el redirect de OAuth/email

---

## Archivos Clave (rutas absolutas)

### Logica de negocio (reutilizable en iOS)
- `src/lib/premium.ts` — Gates, limites, evaluacion de premium
- `src/lib/vitality-score.ts` — Motor del score 0-100
- `src/lib/breed-data.ts` — Datos de razas (~40)
- `src/lib/badges.ts` — Sistema de insignias
- `src/lib/vaccine-badges.ts` — Mapa vacuna -> badge PNG
- `src/lib/utils.ts` — Helpers (timeAgo, formatDate, calculateAge)

### Infraestructura
- `src/middleware.ts` — Auth guard
- `src/lib/supabase.ts` — Clientes Supabase (SSR + admin)
- `src/lib/pet.ts` — getActivePet helper
- `src/lib/storage.ts` — Upload de fotos
- `src/layouts/MainLayout.astro` — Layout principal
- `src/components/Sidebar.astro` — Navegacion

### Config
- `astro.config.mjs` — output:server, adapter:vercel, react, tailwind
- `tsconfig.json` — strict, react-jsx
- `package.json` — astro 5.17, supabase, react 19, tailwind 4

---

## Dependencias Principales

```json
{
  "astro": "5.17.1",
  "@astrojs/react": "4.2.1",
  "@astrojs/vercel": "8.1.4",
  "@supabase/ssr": "0.7.0",
  "@supabase/supabase-js": "2.49.4",
  "@tailwindcss/vite": "4.1.18",
  "tailwindcss": "4.1.18",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "lucide-react": "0.511.0",
  "typescript": "5.9.3"
}
```

---

## Reglas Criticas para Otro AI

1. **Tailwind v4**: Usar `bg-linear-to-*` (NO `bg-gradient-to-*`). NO arbitrary values.
2. **Colores**: Usar el sistema de colores del tema (accent, ink, muted, card, canvas, card-border). NO colores legacy.
3. **Forms**: Siempre POST con `_action` hidden field. Redirect con query params para toasts.
4. **Scripts**: Siempre `astro:page-load` event, nunca `DOMContentLoaded`.
5. **Premium**: Consultar `getPremiumStatus()` en el frontmatter, usar `PremiumGate`, `canAccess()`, `isAtLimit()`.
6. **Pet context**: Siempre verificar `if (!pet) return Astro.redirect(...)`.
7. **Supabase admin**: Solo usar `createSupabaseAdminClient()` para operaciones que bypasean RLS (referidos, etc).
8. **Health colors**: Verde=#22C55E, amber, rojo. NUNCA naranja para salud.
9. **Solo perros**: No hay soporte para gatos u otras mascotas.
10. **Espanol**: Toda la UI esta en espanol. Textos, labels, mensajes de error, todo.
11. **Mobile-first**: Disenar primero para movil, adaptar a desktop con `lg:` breakpoints.
12. **No over-engineer**: Minimo necesario. Sin abstracciones prematuras.
