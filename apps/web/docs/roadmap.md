# 🐾 Vivra - ROADMAP 2026-2027
**Versión 1.3** | Actualizado: 22 de febrero 2026
**Objetivo final:** Convertir Vivra en la app #1 de registro de vida de mascotas en Latinoamérica (empezando por Panamá) y generar ingresos recurrentes vía Freemium + afiliados.

---

## 🎯 Visión General del Producto

**Nombre:** Vivra
**Tagline:** "La vida completa de tu mascota en un solo lugar"
**Modelo de negocio:** Freemium + Afiliados Amazon + (futuro) comisiones de reservas
**Usuarios objetivo:** Dueños de perros y gatos en Panamá (luego LATAM)
**Plataformas:** Web progresiva (actual) + App Nativa iOS/Android (mismo Supabase)

### Diferenciadores clave
- Pasaporte imprimible oficial con MRZ
- Badges visuales de vacunas (PNG reales)
- Onboarding épico con fun facts y colores de raza
- AI OCR de carnet de vacunas (fase avanzada)
- Directorio local de vets y groomers en Panamá

---

## 📋 REGLAS OBLIGATORIAS para el Programador Senior (Claude Code / Cursor / Windsurf)

1. **Tailwind CSS v4**
   - Solo `bg-linear-to-*` (nunca `bg-gradient-to-*`)
   - Prohibido valores arbitrarios: nada de `w-[420px]`, `h-[137px]`, etc.
   - Usar solo la escala definida en `@theme` (w-105, etc.)

2. **Astro + React**
   - Todo lo posible en `.astro` (Server-first)
   - React **solo** para islas interactivas con datos (charts, forms con realtime, etc.)
   - Nunca usar React para layouts estáticos

3. **TypeScript**
   - Strict mode siempre (`"strict": true`)
   - Interfaces en `src/types/`
   - Supabase types generados con `supabase gen types`

4. **Estructura de carpetas** (respetar siempre)
```
src/
├── components/     # .astro + React islands
├── layouts/
├── lib/            # utils, vaccine-badges, supabase client, etc.
├── pages/
├── types/
├── middleware.ts
public/
└── badges/         # PNGs de vacunas optimizados
```

5. **Git & PRs**
   - Branch: `feature/nombre` o `fix/nombre`
   - Conventional commits
   - Cada PR debe tener checklist de las reglas anteriores

6. **Base de datos**
   - Todas las columnas nuevas con `IF NOT EXISTS`
   - RLS (Row Level Security) activado siempre
   - Índices en columnas usadas en filtros frecuentes

7. **Performance**
   - Imágenes PNG de badges → optimizadas con TinyPNG antes de subir
   - Charts con Recharts (React islands)
   - SSR siempre que sea posible

---

## 🗓️ ROADMAP POR FASES

---

### Fase 0: MVP Estable — Deploy Real (1-2 semanas)
**Objetivo: que una persona real pueda registrarse, meter su perro y usarlo sin fricciones.**

**BD pendiente:**
```sql
ALTER TABLE pets ADD COLUMN IF NOT EXISTS color TEXT;
```

**Tareas técnicas:**
- ✅ Toast/feedback en todas las acciones (guardar, eliminar, error) — Toast.astro + FormEnhancements.astro en MainLayout
- ✅ Loading states en forms (deshabilitar botón al submit)
- ✅ Onboarding mínimo: cuando no hay mascota, mostrar pantalla de bienvenida antes del formulario vacío
- [ ] Revisar responsive en iPhone 12/15 y Android Chrome
- [ ] Corregir todos los `forest`, `cream-dark` legacy restantes por las variables nuevas del tema
- [ ] Deploy en dominio propio (sugerencia: `vivra.app` o `vivra.lat`)
- ✅ Google OAuth funcionando en producción (configurar callback URL de Vercel)
- [ ] Vercel Analytics activado (gratis, 1 línea)
- [ ] Documentar tablas en `docs/database.md`

**Ya implementado en Fase 0:**
- ✅ Onboarding wizard 4 pasos (`/register` → `/onboarding`)
- ✅ Google OAuth funcionando en producción — probado en dispositivos reales
- ✅ Badge de "Perfil completo" en `/perfil` (desbloqueado cuando todos los campos están llenos)
- ✅ Razas en inglés, alfabéticas, con Border Collie
- ✅ Checklist post-onboarding en el dashboard (`?onboarded=1`): 4 pasos accionables con links directos
- ✅ Mensaje especial para mascotas adultas: "No importa si es mayor, registra desde hoy"
- ✅ Logo Vivra en sidebar (desktop y mobile) y top bar → link a `/` (landing)
- ✅ Hamburger menu mobile funcional (fix de `display:none` vs `classList.hidden`)
- ✅ Eliminar cuenta desde `/perfil` con modal de confirmación y borrado en cascada en Supabase
- ✅ Todos los journeys de auth auditados y corregidos (email no confirmado, login sin mascota, etc.)
- ✅ Register: error diferenciado entre "email ya existe → ir a login" vs error genérico

**Nota sobre el peso en el dashboard:** El card de peso verde con número grande + "kg" + flecha de tendencia fue muy bien recibido — mantener este estilo para cualquier métrica numérica importante (referencia visual).

**Milestone:** Cualquier persona puede entrar, crear su cuenta con Google o email, registrar su perro y navegar todo sin errores. ✅ Probado en múltiples dispositivos reales.

---

### Fase 1: Onboarding Épico ✅ COMPLETADO
**Objetivo: que el primer uso sea memorable y genere retención.**

**Implementado:**
- ✅ Wizard ampliado a 6 pasos (era 4)
- ✅ Paso 2: Selector de especie (Perro 🐕 / Gato 🐱) con cards grandes clickables
- ✅ Paso 3: Fun facts de raza — card animada con 3 datos curiosos al seleccionar raza (13 razas cubiertas hardcoded en `src/lib/breeds.ts`)
- ✅ Para gatos: sección de raza oculta (no aplica aún)
- ✅ Paso 6: Pantalla de celebración con fondo verde oscuro, emoji del animal, título personalizado con el nombre
- ✅ Confeti en el dashboard al llegar desde onboarding (`?onboarded=1`) — CDN, sin overhead en bundle
- ✅ Barra de progreso "Paso X de 4" en pasos 3-6
- ✅ Fun facts pasados de server (Astro) al cliente vía `<script type="application/json">`

**Milestone:** ✅ Flujo completo funciona. Tasa de completar onboarding pendiente de medir con Analytics.

---

### Fase 1.5: Citas Futuras + Recordatorios por Email
**Objetivo: que el usuario no se olvide de las citas programadas con el veterinario.**

**UX:**
- En `/salud/citas`, al agregar una cita, marcarla como "futura" si la fecha es posterior a hoy
- Dashboard: si hay una cita en los próximos 7 días, mostrar banner de recordatorio
- El usuario puede activar recordatorio por email desde la ficha de la cita

**Recordatorio por email — implementación:**
- Tabla `vet_visit_reminders` asociada a `vet_visits`
- Supabase Edge Function `send-reminders` (cron diario) que:
  1. Busca citas con `date = tomorrow` y `reminder_email = true`
  2. Envía email con Resend (`resend.com`) — plan gratuito = 3,000 emails/mes
  3. Marca `reminder_sent = true` para no duplicar

**DB:**
```sql
ALTER TABLE vet_visits ADD COLUMN IF NOT EXISTS is_future BOOLEAN DEFAULT FALSE;
ALTER TABLE vet_visits ADD COLUMN IF NOT EXISTS reminder_email BOOLEAN DEFAULT FALSE;
ALTER TABLE vet_visits ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;
```

**Edge Function (Supabase):**
```ts
// supabase/functions/send-reminders/index.ts
// Cron: "0 9 * * *" (9am diario)
// 1. Query vet_visits WHERE date = tomorrow AND reminder_email = true AND reminder_sent = false
// 2. JOIN pets + auth.users para obtener email del dueño
// 3. Resend API: email con nombre del perro, vet, hora, dirección
// 4. UPDATE reminder_sent = true
```

**Milestone:** Usuario recibe email "Mañana tienes cita con el vet para [nombre del perro] a las 10am."

---

### Fase 2: Multi-Mascota ✅ COMPLETADO
**Objetivo: usuarios con más de un perro/gato pueden usarlo.**

**Implementado:**
- ✅ `src/lib/pet.ts` — helper `getActivePet(supabase, userId, activePetId)`: query única, sin duplicación en 10 páginas
- ✅ Cookie HTTP `active_pet_id` — middleware la lee e inyecta en `Astro.locals.activePetId`
- ✅ `src/pages/api/pets/switch.ts` — API route POST para cambiar mascota activa (verifica ownership, sin `.single()`)
- ✅ Sidebar: dropdown con avatar, check en activa, "Agregar mascota" dentro del dropdown (desktop + mobile)
- ✅ Dropdown pet-switcher funcional: lógica open/close con `container.contains()` para cerrar al click fuera, sin bloquear submit del form
- ✅ 10+ páginas: todas usan `getActivePet` en lugar de `.single()` hardcodeado
- ✅ Onboarding `?add=1`: wizard completo para agregar mascota adicional (sin upgrade wall por ahora)
  - Paso 1 se salta automáticamente en add-mode (JS detecta `data-add-mode` en body)
  - "← Atrás" en paso 2 regresa a `/dashboard` en add-mode
  - Textos adaptativos: "Una más en la familia", celebración personalizada
  - Cookie `active_pet_id` se actualiza al crear la nueva mascota
- ✅ Cookie seteada al crear mascota y al login OAuth
- ✅ Sin cambios de esquema en DB
- ✅ Hamburger mobile: fix toggle usando `style.display` en lugar de `classList` (bug crítico)
- ✅ Color de tema por mascota: `data-pet={index}` en body → CSS sobrescribe `--color-accent` (6 paletas: verde, azul, violeta, naranja, rosa, teal)
- ✅ Hero card del dashboard: usa `color-mix(var(--color-accent), #0a0f0a)` en lugar de `#1E3B1A` hardcodeado
- ✅ Eliminar desde `/perfil` inteligente:
  - Si hay 2+ mascotas → solo elimina la mascota activa, cambia cookie al siguiente pet, redirige al dashboard con toast
  - Si es la única mascota → elimina cuenta completa y redirige a `/`
  - Modal de confirmación con texto adaptado al caso
- ✅ Queries defensivas: `.single()` reemplazado por `.limit(1)` + `data?.[0]` en dashboard y login (evita crash en usuarios sin registros)

**Milestone:** ✅ Build limpio. Switcher funcional. Journey completo de agregar mascota. Temas de color por mascota.

---

### Fase 3: Freemium + Primer Pago (2-3 semanas)
**Objetivo: generar el primer dólar real.**

**Plan gratuito:**
- 1 mascota
- Hasta 10 registros por sección
- Pasaporte básico (sin exportar PDF)
- Badges básicos

**Plan Premium — US$ 4.99/mes o US$ 39/año:**
- Mascotas ilimitadas
- Registros ilimitados
- Exportar PDF completo del pasaporte
- Charts avanzados de peso
- Sin límites en aventuras y fotos
- Soporte prioritario

**Implementación:**
- Lemon Squeezy (más simple que Stripe para LATAM sin LLC)
- Tabla `subscriptions` + webhook handler en `/api/webhooks/lemon`
- Middleware que chequea `plan` antes de operaciones premium

**Milestone:** Primer pago real recibido de alguien que no es tú.

---

### Fase 4: Badges & Engagement (1-2 semanas)
**Objetivo: que el usuario sienta progreso y quiera completar su perfil.**

**Galería de badges en el Dashboard (home):**
- Sección "Logros de {petName}" visible en el dashboard, debajo de las stats
- Grid horizontal scrollable con todos los badges: ganados en color, pendientes en gris con candado
- Al tap en un badge pendiente → tooltip "¿Cómo ganarlo?" con instrucción
- Badges PNG en `/public/badges/` — el usuario los agrega, el código los referencia

**Badges previstos:**

| Badge | Archivo PNG | Condición |
|-------|------------|-----------|
| Perfil completo | `perfil-completo.png` | Todos los campos del perfil llenos ✅ ya implementado |
| Primera vacuna | `primera-vacuna.png` | ≥ 1 vacuna registrada |
| Vacuna Master | `vacuna-master.png` | 5+ vacunas registradas |
| Primera aventura | `primera-aventura.png` | ≥ 1 aventura con foto |
| Viajero | `viajero.png` | ≥ 1 vuelo registrado |
| Control de peso | `control-peso.png` | ≥ 3 registros de peso |
| Grooming Pro | `grooming-pro.png` | ≥ 3 groomings registrados |
| Pasaporte listo | `pasaporte-listo.png` | Perfil completo + ≥ 3 vacunas |

**Implementación:**
- Archivo `src/lib/badges.ts` — define cada badge: `{ id, label, file, condition(petData) → boolean }`
- En `dashboard.astro`: query paralela de conteos (vaccines, adventures, flights, weight_records, groomings) → evaluar condiciones → renderizar grid
- Badges desbloqueados se guardan en tabla `pet_badges` para historial y notificaciones futuras

**DB:**
```sql
CREATE TABLE IF NOT EXISTS pet_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pet_id, badge_id)
);
CREATE INDEX IF NOT EXISTS pet_badges_pet_id_idx ON pet_badges(pet_id);
```

**Afiliados (misma fase):**
- Sección "Productos para tu raza" con links de Amazon Affiliates
- Compartir tarjeta de perfil de mascota (link público `/p/[slug]`)

**Milestone:** Usuario ve sus badges ganados en el home. Al completar el perfil se desbloquea el primer badge con animación.

---

### Fase 5: App Nativa iOS + Android (4-6 semanas)

**Decisión técnica recomendada: Expo + React Native**
- Mismo Supabase client que la web
- Monorepo con Turborepo (compartir `types/` y `lib/`)
- Push notifications para recordatorios de vacunas y citas
- Web → PWA ya existe como puente

*Alternativa más rápida pero menos nativa: Capacitor sobre la web actual.*

**Milestone:** App publicada en App Store y Play Store. 100 descargas primer mes.

---

### Fase 6: Directorio Local Panamá (1-2 semanas)

**DB:**
```sql
CREATE TABLE IF NOT EXISTS service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'vet' | 'groomer'
  address TEXT,
  phone TEXT,
  latitude FLOAT,
  longitude FLOAT,
  rating FLOAT,
  photo_url TEXT,
  website TEXT
);
```

- Pantalla "Vets cerca de mí" (mapa con Mapbox o Google Maps embed + lista)
- "Groomers recomendados en Panamá"
- Botón "Llamar" y "WhatsApp directo"

**Milestone:** 20 vets y 10 groomers de Panamá cargados manualmente.

---

### Fase 7: AI — OCR de Carnet de Vacunas (2-3 semanas)
*(Solo ejecutar si hay > 100 usuarios activos o un sponsor)*

- Foto del carnet físico de vacunas
- Claude Vision o GPT-4o Vision para extraer: vacuna, fecha, veterinario
- Prellenar formulario automáticamente
- Confirmar antes de guardar

**Milestone:** OCR con > 85% de precisión en carnets panameños.

---

### Fase 8: AI — Reconocimiento de Comida (3-4 semanas)
*(Solo ejecutar si hay plan Premium activo con > 50 suscriptores)*

- Foto del plato o bolsa de comida
- Detectar: marca, tipo (croqueta, húmedo, BARF), calorías estimadas
- Prellenar historial nutricional
- Recomendaciones por raza/peso

---

### Fase 9: Reservas Online (Q4 2026)

- Calendario de vets/groomers (Calendly embed o API propia)
- Comisión por reserva confirmada
- Recordatorio automático por email/push

---

### Fase 10: Expansión LATAM (2027)

- i18n (español → inglés + portugués)
- Feed social de aventuras (comunidad)
- Pet Insurance affiliate (Figo, Petplan)
- Versión B2B para clínicas veterinarias

---

## 📊 KPIs a seguir desde Fase 0

| Métrica | Fase 0 meta | Fase 3 meta |
|---------|------------|------------|
| Usuarios registrados | 10 (beta) | 200 |
| Retención día 7 | — | > 40% |
| Completar onboarding | — | > 80% |
| Suscriptores Premium | 0 | 5 |
| MRR | $0 | $25 |
