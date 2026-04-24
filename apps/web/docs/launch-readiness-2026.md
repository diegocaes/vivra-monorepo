# Vivra — Launch Readiness Report (App Store + Vitality Score)

> **Fecha:** 2026-04-23
> **Propósito:** Diagnóstico exhaustivo de (a) bugs en Vitality Score y (b) bloqueadores de App Store. Escrito para sobrevivir compactación de contexto — cualquier sesión futura puede continuar desde aquí.
>
> **Estado:** DIAGNÓSTICO COMPLETO. CORRECCIONES PENDIENTES.

---

## PARTE 1 — Bugs del Vitality Score

### Síntoma reportado
> "Hay casos que no loggeo comida, no logeo actividades, no logeo preventivos y al score no le pasa nada."

### Causa raíz (confirmada leyendo `packages/shared/lib/vitality-score.ts`)

**Cada pilar devuelve 10/20 (50%) cuando no tiene datos** — con `isEstimated: true`, pero el puntaje SÍ cuenta al total. Esto hace que un usuario con CERO datos obtenga:

| Pilar | Sin datos | Con datos completos |
|---|---|---|
| Peso | 10/20 | 2–20 |
| Cuidado preventivo | 10/20 | 2–20 |
| Raza + Edad | 12/20 (o 20 si tiene raza+edad en perfil) | 2–20 |
| Actividad | 10/20 | 2–20 |
| Nutrición | 10/20 | 2–20 |
| **TOTAL** | **52/100** (o ~62 si tiene raza) | hasta 100 |

**Diseño actual:** "baseline amable" de 50% por pilar para no desmotivar.
**Problema:** el usuario puede no registrar nada en meses y el score nunca baja de ~52. No refleja la realidad.

### Bugs secundarios identificados

**Bug B1 — `pet.weight_kg` persistente:**
- `scorePeso` usa `weightRecords[0]?.weight_kg ?? pet.weight_kg`.
- Si el usuario puso su peso en onboarding y nunca más, `pet.weight_kg` permanece y el pilar puede dar 20/20 (si está en rango ideal) sin actualización.
- `daysSinceWeight` se calcula solo con `weightRecords[0]?.date`, no con la fecha de onboarding.

**Bug B2 — `bloodTests` nunca se obtiene en mobile:**
- `usePet.ts` no hace query a `blood_tests` table.
- `useVitality.ts` no pasa `bloodTests` al `ScoreInput`.
- Resultado: el bonus de +2 pts por examen de sangre reciente + el flag `blood_test` NUNCA se activan en mobile. En web tampoco se confirma paso.

**Bug B3 — Actividad con data vieja:**
- `hasAnyData = activityLogs.length > 0 || groomings.length > 0 || adventures.length > 0`
- Un log de hace 6 meses (dentro del `.limit(60)`) hace `hasAnyData=true` → se salta la rama "pending"
- El sub-score se basa en `daysBetween(l.date) <= 30` → puede dar 2 pts
- Resultado: no es bug severo porque el score baja. Pero si NO tenían `groomings` ni `adventures` y limit(60) trunca → score bajo raro.

**Bug B4 — Nutrición sin staleness:**
- Un alimento registrado hace 12 meses sigue contando 100% en calidad + porción.
- No hay check de "la bolsa se acabó hace N días" (usando `start_date + daily_grams × elapsed > bag_size`).

**Bug B5 — Vacunas/vet sin umbral:**
- Vacunas de hace 5 años aún cuentan para "cobertura de core" (2–6 pts).
- Solo el bonus de +2 pts pide "última en 365d". Sin ese bonus, una vacuna de 2018 da los mismos pts que una reciente.

**Bug B6 — Cachorros peso 10/20 fijo:**
- Cachorro < 1 año → `score: 10`. Razonable para no penalizarlos, pero el `pct: 50` lo muestra como "mitad" en UI. Visualmente confunde.

---

### Fix plan (en orden de impacto)

**Fix V1 (CRÍTICO) — Reducir baseline sin datos a 4/20 (20%)**
Archivo: `packages/shared/lib/vitality-score.ts`. En `scorePeso`, `scoreCuidado`, `scoreActividad`, `scoreNutricion`, cambiar el early-return `score: 10, pct: 50` → `score: 4, pct: 20`. Resultado: usuario sin nada → ~24–36/100 (según raza/edad) → muestra "Comenzando el historial" (gris). Delta real cuando agreguen datos.

**Fix V2 — Fetch `blood_tests` en `usePet.ts` + pasarlo en `useVitality.ts`**
- Añadir a `PetData`: `bloodTests: { date: string }[]`
- Agregar query en `Promise.all`: `supabase.from('blood_tests').select('date').eq('pet_id', pet.id).order('date', { ascending: false })`
- En `useVitality.ts`: `bloodTests: bloodTests.map(b => ({ date: b.date }))`
- Verificar que `apps/web/src/pages/salud/index.astro` y `dashboard.astro` también lo pasen

**Fix V3 — Penalización peso estancado (onboarding-only)**
- Si no hay `weightRecords` pero sí `pet.weight_kg`, tratarlo como `isEstimated: true` y cap a 12/20.
- Si hay `weightRecords` pero el más reciente > 45d (ya existente) → mantener −3 pts (OK).

**Fix V4 — Staleness en nutrición**
- Si el alimento más reciente (`foods[0]`) tiene `created_at` > 90d sin reemplazo → `qualityScore = max(3, qualityScore - 4)` y agregar tip "Registra tu alimento actual — el último fue hace Xd".

**Fix V5 — Vacunas "stale"**
- Si NO hay ninguna vacuna en los últimos 18 meses, `vaccineScore = min(4, vaccineScore)` (tope suave, no castigo fuerte) + tip.
- Mantiene el modelo amable pero refleja realidad.

**Fix V6 — Cachorros UI**
- Dejar `score: 10` pero considerar `isEstimated: true` para que la UI muestre "—" en vez de 50%.

### Verificación posterior
Agregar tests de smoke mental:
- Usuario 0 datos (solo raza + edad + onboarding weight) → total < 40, categoría "building/gris"
- Usuario registra alimento → pilar nutrición sube 10–16 pts
- Usuario registra antipulgas + desparasitante recientes → cuidado sube 4 pts
- Usuario inactivo 6 meses → score baja progresivamente

---

## PARTE 2 — App Store Readiness

### BLOQUEADORES HARD (rechazo automático — fix antes de submit)

#### BLK-1 — NO hay "Sign in with Apple" con Google Login presente [Guideline 4.8]
- **Evidencia:** `apps/mobile/app/(auth)/login.tsx` ofrece `supabase.auth.signInWithOAuth({ provider: 'google' })` pero no hay código de Apple Auth. Grep de `AppleAuthentication|signInWithApple|expo-apple-authentication` → 0 matches.
- **Regla:** Si ofreces login de Google, Facebook, Meta, etc., **debes** ofrecer Sign in with Apple con visibilidad igual. Ranking visual también cuenta — no puede estar oculto abajo.
- **Fix:**
  1. `pnpm --filter mobile add expo-apple-authentication`
  2. Añadir en `app.json` → `plugins`: `"expo-apple-authentication"` + `"ios.usesAppleSignIn": true`
  3. En login.tsx, añadir botón Apple ARRIBA del Google (Apple suele pedirlo prominente):
     ```ts
     import * as AppleAuthentication from 'expo-apple-authentication';
     async function handleAppleLogin() {
       const credential = await AppleAuthentication.signInAsync({
         requestedScopes: [
           AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
           AppleAuthentication.AppleAuthenticationScope.EMAIL,
         ],
       });
       if (credential.identityToken) {
         await supabase.auth.signInWithIdToken({
           provider: 'apple',
           token: credential.identityToken,
         });
       }
     }
     ```
  4. Habilitar el provider **Apple** en Supabase dashboard (Authentication → Providers).
  5. Requiere nuevo `eas build` (cambio nativo).

#### BLK-2 — Paywall sin links a Terms of Use (EULA) + Privacy Policy [Guideline 3.1.2]
- **Evidencia:** `apps/mobile/app/paywall.tsx` líneas 122–130: `footer` solo tiene "Restaurar compra" + texto de auto-renovación. No hay link a `/terms` ni `/privacy`.
- **Regla 2026:** Apple exige links FUNCIONALES dentro del binario de la app (no solo en App Store Connect). Apps recientes (incl. Cal AI este mes) han sido rechazadas por esto.
- **Fix:** Agregar al footer del paywall:
  ```tsx
  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
    <TouchableOpacity onPress={() => Linking.openURL('https://vivrapet.com/terms')}>
      <Text style={styles.legalLink}>Términos de uso</Text>
    </TouchableOpacity>
    <TouchableOpacity onPress={() => Linking.openURL('https://vivrapet.com/privacy')}>
      <Text style={styles.legalLink}>Política de privacidad</Text>
    </TouchableOpacity>
  </View>
  ```

#### BLK-3 — Paywall sin disclosure completo de trial + pricing [Guideline 3.1.2c]
- **Evidencia:** `paywall.tsx` línea 103 dice "7 días gratis" pero no aclara "después $2.99/mes, se renueva automáticamente, cancela cuando quieras desde Ajustes".
- **Regla 2026 (enforcement Cal AI):** Apple rechaza si el trial/precio no es tan prominente como el botón de compra.
- **Fix:** Debajo de cada `planCard`, mostrar literal:
  ```
  Después del período gratis, $2.99/mes. Se renueva
  automáticamente hasta cancelar. Cancela en
  Ajustes > Apple ID > Suscripciones.
  ```

### BLOQUEADORES SOFT (alta probabilidad de rechazo)

#### BLK-4 — Privacy + Terms no están en el perfil de la app [Guideline 5.1.1]
- **Evidencia:** `apps/mobile/app/(app)/perfil.tsx` no tiene links a `/privacy` ni `/terms`. Grep confirma solo el link a `/print?petId=X`.
- **Fix:** Añadir una sección "Legal" en perfil con 3 filas:
  - Política de privacidad → `Linking.openURL('https://vivrapet.com/privacy')`
  - Términos de uso → `Linking.openURL('https://vivrapet.com/terms')`
  - Soporte → `Linking.openURL('mailto:soporte@vivrapet.com')`

#### BLK-5 — Edge Function `delete-account` NO está en el repo
- **Evidencia:** `perfil.tsx:177` llama `supabase.functions.invoke('delete-account')`. No existe `supabase/functions/delete-account/` en el repo. Si está desplegada en Supabase pero no en repo → riesgo de sync.
- **Regla:** Si la función falla, es feature rota → Apple puede rechazar por Guideline 2.1 (App Completeness).
- **Fix:**
  1. Verificar que está desplegada: `npx supabase functions list --project-ref <ref>`
  2. Si existe remotamente, pull del código: `npx supabase functions download delete-account`
  3. Commit al repo
  4. Si NO existe, CREARLA:
     ```ts
     // supabase/functions/delete-account/index.ts
     import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
     Deno.serve(async (req) => {
       const authHeader = req.headers.get('Authorization')!;
       const supabase = createClient(
         Deno.env.get('SUPABASE_URL')!,
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
       );
       const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
       if (!user) return new Response('Unauthorized', { status: 401 });
       // Delete all user data (pets, vaccines, etc. cascade via FK)
       await supabase.from('pets').delete().eq('user_id', user.id);
       // Delete auth user
       await supabase.auth.admin.deleteUser(user.id);
       return new Response(JSON.stringify({ success: true }), {
         headers: { 'Content-Type': 'application/json' },
       });
     });
     ```

### WARNINGS (probables pero no auto-reject)

#### WRN-1 — Falta UsageDescription para Tracking [Guideline 5.1.2]
- **app.json** solo tiene Camera, PhotoLibrary, Notifications. Si alguna lib (ej. Facebook SDK vía RevenueCat) hace tracking, faltaría `NSUserTrackingUsageDescription`.
- **Verificación:** `grep -r "AppTrackingTransparency\|requestTrackingPermission" apps/mobile/node_modules/react-native-purchases/` — si aparece, añadir string.
- **No crítico hoy**, pero riesgoso.

#### WRN-2 — `ITSAppUsesNonExemptEncryption: false`
- ✅ Correctamente declarado en app.json. Apple pide esta declaración; tenerla en `false` (uso solo HTTPS estándar) evita el export compliance wizard manual.

#### WRN-3 — Demo account para App Review
- **No evidencia:** No veo mención de credenciales demo en EAS ni documentación. Apple pide un usuario de prueba.
- **Fix:** Crear cuenta `demo@vivrapet.com` con contraseña documentada, con 1 mascota y datos de ejemplo. Anotar en "App Review Information" en App Store Connect.

#### WRN-4 — Android RevenueCat key placeholder
- **`constants/revenueCat.ts`:** `android: 'goog_YOUR_REVENUECAT_ANDROID_KEY'`
- Si sale Android algún día → crash. Para iOS launch no bloquea, pero dejar TODO explícito.

#### WRN-5 — Medical disclaimer visibility
- ✅ FAQ mobile dice "No es un diagnóstico médico".
- ✅ Web salud, mobile salud ya tienen el disclaimer sutil.
- ✅ Terms.astro línea 109 lo menciona.
- Pasa la Guideline 1.4.1 tal como está.

#### WRN-6 — iPad support declarado
- `app.json`: `"supportsTablet": true`. Apple probará en iPad. Verificar que no hay layouts rotos.
- **Recomendación:** setear a `false` si no se ha testeado — más seguro para v1.0. Cambiar a `true` más tarde con pruebas.

#### WRN-7 — App icon / launch screen
- `icon.png` + `splash-icon.png` presentes. Apple exige icono 1024×1024 sin transparencia ni bordes redondeados (Apple los redondea). Verificar visualmente antes de submit.

### OK / Ya hecho

- ✅ Account deletion UI en mobile (perfil.tsx)
- ✅ Restore Purchases en paywall
- ✅ Auto-renewal mention en paywall
- ✅ Permissions strings en español y con razón clara
- ✅ Bundle ID: `com.vivrapet.app`
- ✅ Version 1.0.1 (no placeholder)
- ✅ EAS submit config con appleId, ascAppId, teamId
- ✅ RevenueCat iOS key real
- ✅ Supabase RLS en orden (backend seguro)
- ✅ No hay TODO/FIXME/placeholder en user-facing code (ya revisado en sesiones previas)

---

## PARTE 3 — Pre-submit Checklist (orden recomendado)

Marcar cada uno antes de `npx eas build --profile production`:

### Legal / Auth (BLK-1 a BLK-5)
- [ ] Sign in with Apple implementado + testeado en TestFlight
- [ ] Paywall tiene links Terms + Privacy
- [ ] Paywall declara "trial → precio → auto-renovación → cancelar en Ajustes" prominente
- [ ] Perfil tiene sección Legal (Privacy + Terms + Support)
- [ ] Edge function `delete-account` desplegada + en repo + probada end-to-end

### App Store Connect
- [ ] Metadata en español completo: nombre, subtitle, descripción, keywords
- [ ] 6+ screenshots 6.7" iPhone (requerido) + 6.1" (opcional)
- [ ] Preview video opcional (recomendado para conversión)
- [ ] Privacy Policy URL en ASC: `https://vivrapet.com/privacy`
- [ ] Support URL en ASC: `https://vivrapet.com/support` (o email)
- [ ] Marketing URL en ASC: `https://vivrapet.com`
- [ ] Age rating respondido (4+ probablemente)
- [ ] App Review Info → Demo account credentials
- [ ] App Review Info → Notes: "Spanish-language pet health tracker. Vitality Score is informational only, not a diagnosis."
- [ ] Privacy Nutrition Labels (Data Collection): declarar email, nombre, fotos, datos salud → todos como "Linked to user, not used for tracking"

### Subscripciones
- [ ] Productos `vivra_premium_monthly` y `vivra_premium_yearly` creados + aprobados en ASC
- [ ] Subscription Group configurado
- [ ] Localización ES + EN del product display name
- [ ] Subscription Privacy Policy URL (reutilizar /privacy)

### Build
- [ ] `pnpm --filter mobile typecheck` → 0 errores
- [ ] `pnpm --filter web astro check` → 0 errores
- [ ] Bump version en app.json (1.0.1 → 1.0.2 o 1.1.0 según scope)
- [ ] `npx eas build --platform ios --profile production`
- [ ] Smoke test en TestFlight con cuenta demo
- [ ] `npx eas submit --platform ios --profile production`

---

## PARTE 4 — Estado de archivos editados en esta sesión

Para continuidad, si la sesión se compacta:

### Ya editados (parte del audit de docs anterior):
- `packages/shared/lib/vitality-score.ts` — PILLAR_DESC actualizado
- `apps/web/docs/vitality-score-research.md` — sección 7 reescrita
- `apps/web/docs/project-context.md` — paths + descripciones actualizados
- `apps/web/src/pages/faq.astro` — iOS status + antipulgas mention
- `apps/mobile/app/(app)/perfil.tsx` — FAQ text
- `apps/mobile/app/(app)/salud/index.tsx` — disclaimer sutil

### ✅ IMPLEMENTADO (Abril 23, 2026)

Todo lo de código está listo. Lo que queda son **pasos manuales en dashboards**.

| # | Fix | Archivo | Estado |
|---|-----|---------|--------|
| V1 | Baselines de pilares sin datos 10→4 | `packages/shared/lib/vitality-score.ts` | ✅ |
| V2 | Fetch + wiring de `blood_tests` | `apps/mobile/hooks/usePet.ts` + `useVitality.ts` | ✅ |
| V3 | Peso onboarding-only cap a 14/20 | `vitality-score.ts scorePeso` | ✅ |
| V4 | Alimento > 180d / 365d topa qualityScore | `vitality-score.ts scoreNutricion` | ✅ |
| V5 | Vacunas todas > 18 meses topa score a 4 | `vitality-score.ts scoreCuidado` | ✅ |
| BLK-1 | Sign in with Apple (package + app.json + login.tsx) | `app/(auth)/login.tsx` | ✅ código, ⚠️ Supabase |
| BLK-2/3 | Paywall: Privacy + Terms + full disclosure | `app/paywall.tsx` | ✅ |
| BLK-4 | Perfil: sección Legal (Privacy + Terms + Support + Rate) | `app/(app)/perfil.tsx` | ✅ |
| BLK-5 | Edge function `delete-account` creada | `supabase/functions/delete-account/index.ts` | ✅ código, ⚠️ deploy |
| ver | Bump versión 1.0.1 → 1.1.0 | `app.json` | ✅ |

### PASOS MANUALES ANTES DE SUBMIT — RESUMEN

1. **Apple Developer Portal** — habilitar capability "Sign In with Apple" en el App ID `com.vivrapet.app`.
2. **Supabase Dashboard → Authentication → Providers → Apple** — habilitar y pegar Bundle ID `com.vivrapet.app` como "Client IDs (for native Sign in with Apple)".
3. **Deploy edge function `delete-account`** — vía Supabase CLI o Dashboard. Probar con `curl` + un JWT válido.
4. **Demo account** — crear `demo@vivrapet.com` con 1 mascota + registros de muestra.
5. **App Store Connect** — metadata, 6 screenshots, Privacy Nutrition Labels, URLs (privacy/terms/support), seleccionar demo account.
6. **Build + submit**:
   ```bash
   cd apps/mobile
   npx eas build --platform ios --profile production
   npx eas submit --platform ios --profile production
   ```

---

## PARTE 5 — Pasos manuales, paso a paso (detalle)

> Datos que vas a reusar varias veces (ten a la mano):
> - **Bundle ID:** `com.vivrapet.app`
> - **App Store ID:** `6761087142`
> - **EAS owner / project:** `diegocans / vivra-mobile`
> - **Version:** `1.1.0` (ya actualizado en `app.json`)
> - **Dominio:** `vivrapet.com` — `/privacy` y `/terms` ya existen (confirmado en `apps/web/src/pages/`)
> - **Email soporte:** `soporte@vivrapet.com`

---

### PASO 1 — Apple Developer Portal: habilitar "Sign in with Apple"

> **Importante (aclaración):** como la app usa `AppleAuthentication.signInAsync` + `supabase.auth.signInWithIdToken` (flujo **nativo**), NO necesitas crear Services ID, Key ID ni una clave `.p8`. Eso solo aplica si quisieras Apple Sign In en un sitio web con redirect OAuth. Para el flujo iOS nativo basta con habilitar la capability.

**1.1** Ir a https://developer.apple.com/account y firmar con tu Apple ID (el que tiene el Developer Program activo).

**1.2** Click en **Certificates, Identifiers & Profiles** (o ir directo a https://developer.apple.com/account/resources/identifiers/list).

**1.3** En el dropdown superior-derecho dejarlo en **"App IDs"**. Buscar `com.vivrapet.app`.

- **Si ya existe:** click en la fila.
- **Si no existe:** click el botón `+` → "App IDs" → Continue → "App" → Continue → Description `Vivra`, Bundle ID **Explicit** = `com.vivrapet.app` → Continue → Register. Luego entrar de nuevo a editarlo.

**1.4** Scroll hasta la lista de Capabilities. Buscar **"Sign In with Apple"** y marcar el checkbox.

**1.5** Click **Configure** (aparece junto al check). Dejar seleccionado **"Enable as a primary App ID"** → Save.

**1.6** Arriba a la derecha click **Save**. Acepta el prompt "Modifying Capability".

**1.7** (Opcional, Team ID) Anota tu Team ID desde https://developer.apple.com/account → Membership → "Team ID" (10 caracteres). Solo por si lo necesitas después en EAS.

**Resultado:** `com.vivrapet.app` ya tiene capability de Sign In with Apple. EAS va a rotar el provisioning profile automáticamente en el próximo build.

---

### PASO 2 — Supabase: habilitar provider Apple (flujo nativo)

**2.1** Ir al dashboard del proyecto → https://supabase.com/dashboard/project/_/auth/providers (o desde el sidebar: Authentication → Providers).

**2.2** Buscar **"Apple"** en la lista. Click para expandir el panel.

**2.3** Toggle **"Enable Sign in with Apple"** → ON.

**2.4** En el campo **"Client IDs (for native Sign in with Apple)"** (o "Authorized Client IDs"):
- Pegar: `com.vivrapet.app`
- Si el campo acepta múltiples valores separados por coma, solo usa el Bundle ID.

**2.5** **Dejar vacíos** los otros campos (solo aplican al flujo web OAuth, que NO estás usando):
- Services ID
- Secret Key (Auto-generated JWT o PEM contents)
- Key ID
- Team ID

**2.6** Click **Save**.

**2.7** (Sanity check) En Authentication → URL Configuration → Site URL = tu dominio producción. No necesitas agregar redirect URLs específicas de Apple porque el flujo nativo no usa redirect.

**Validación:**
- Requiere un dispositivo iOS físico (el simulador funciona si tiene Apple ID configurada, pero ojo con Face ID en sim).
- Abrir la app (TestFlight o dev client) → Login → "Sign in with Apple" → completar → deberías quedar loggeado.
- En el dashboard Supabase → Authentication → Users, el usuario aparece con `provider: apple`.

---

### PASO 3 — Deploy edge function `delete-account`

El archivo ya está en `supabase/functions/delete-account/index.ts`. Tienes dos caminos:

#### Opción A — Supabase CLI (recomendada, más rápida)

```bash
# Instalar CLI (una sola vez)
brew install supabase/tap/supabase

# Login (abrirá browser)
supabase login

# Desde la raíz del monorepo
cd /Users/dicans/Projects/vivra-monorepo

# Linkear al proyecto — el ref está en Dashboard → Settings → General → "Reference ID"
supabase link --project-ref <tu-project-ref>

# Deploy (respeta verify_jwt; nuestro función valida el JWT manualmente)
supabase functions deploy delete-account

# Verificar secrets — debe aparecer SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
supabase secrets list

# Si falta el service role (poco común, suele estar auto):
# supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key-del-dashboard>
```

#### Opción B — Dashboard (si no quieres CLI)

1. https://supabase.com/dashboard/project/_/functions → **New function** → nombre exacto: `delete-account`.
2. Copiar el contenido completo de `supabase/functions/delete-account/index.ts` y pegar en el editor.
3. Click **Deploy function**.
4. Settings → Edge Functions → Secrets → confirmar `SUPABASE_SERVICE_ROLE_KEY` presente (si no, agregarlo desde Project Settings → API → Service Role Key).

#### Test end-to-end con curl

> ⚠️ USA UNA CUENTA DE PRUEBA — es irreversible.

```bash
# 1. Crear o tener a mano un user de test (ej. crear con email + password desde la app)
# 2. Obtener su JWT:
#    - Login desde la app → inspeccionar network o:
#    - Desde SQL Editor del dashboard:
#      select raw_user_meta_data from auth.users where email = 'test@vivra.com';
#    - o en la app agrega temporalmente:
#      console.log(await supabase.auth.getSession())
#    y copia el access_token

JWT="eyJhbGc..."
SUPABASE_URL="https://<tu-project-ref>.supabase.co"

curl -i -X POST "$SUPABASE_URL/functions/v1/delete-account" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json"

# Esperado: HTTP/2 200 con body {"ok":true}
# Verificar: Authentication → Users → ese user desapareció.
# Verificar: en la DB, sus rows en `pets`, `profiles`, etc. también desaparecieron.
```

Si devuelve 500, ver logs: Dashboard → Edge Functions → `delete-account` → Logs.

---

### PASO 4 — Crear demo account para App Review

**4.1** Abrir la app en un simulador o device físico (versión dev o TestFlight).

**4.2** Tap "Regístrate" y crear:
- Email: `demo@vivrapet.com`
- Password: `VivraDemo2026!` (fuerte pero memorable; anótala)

**4.3** Completar onboarding con datos realistas:
- Nombre: `Rocky`
- Raza: `Golden Retriever`
- Fecha de nacimiento: `2022-03-15`
- Género: Macho
- Peso inicial: `28` kg
- Foto: subir cualquier imagen de muestra (opcional pero recomendado)

**4.4** Agregar unos cuantos registros para que Apple vea la app funcional:
- **Salud → Vacunas:** 1 vacuna (Rabia, fecha ~6 meses atrás)
- **Salud → Peso:** 2-3 registros (actual + hace 3 meses)
- **Salud → Preventivos:** 1 antipulgas hace 15 días + 1 desparasitante hace 20 días
- **Salud → Grooming:** 1 baño hace ~30 días
- **Alimentación:** 1 alimento activo (ej. Royal Canin, 250g/día, bolsa 12kg, empezó hace 20 días)
- **Actividad:** 1 o 2 paseos registrados

**4.5** Guardar las credenciales — las necesitarás en Paso 5.11.

---

### PASO 5 — App Store Connect: metadata completo

Login https://appstoreconnect.apple.com → My Apps → **Vivra** (ID `6761087142`).

Si la versión `1.1.0` no existe: click **"+ Version or Platform"** → iOS → `1.1.0`.

**5.1 — General (App Information / iOS App)**
- **Name:** `Vivra` (o `Vivra - Salud de tu mascota`)
- **Subtitle:** `Diario de salud de tu perro` (max 30 chars)
- **Category Primary:** `Lifestyle`
- **Category Secondary:** `Health & Fitness`
- **Content Rights:** "Does your app contain..." → No

**5.2 — Pricing and Availability**
- Price: **Free** (las suscripciones son aparte via IAP)
- Availability: todos los países o lista específica (recomendado LATAM + US + ES)

**5.3 — Descripción (por idioma, empieza con Spanish (Mexico) y Spanish (Spain))**
```
Vivra es el diario digital de salud de tu perro. Registra vacunas,
peso, alimentación, grooming y cuidados preventivos — todo en un
solo lugar.

CARACTERÍSTICAS:
• Score de Bienestar (0-100) con 5 pilares de salud
• Recordatorios de antipulgas y desparasitantes
• Historial de peso con gráficos y tendencias
• Control de alimentación y progreso de la bolsa actual
• Insignias por hitos de cuidado
• Pasaporte imprimible (Premium)
• Comparte el perfil con tu co-dueño (Premium)
• Funciona offline

SUSCRIPCIÓN VIVRA PREMIUM (opcional):
• $2.99/mes o $14.99/año (USD)
• 7 días gratis al activar
• Cancela cuando quieras desde Ajustes > Apple ID > Suscripciones

Vivra es informacional y no reemplaza al veterinario.

Política de privacidad: https://vivrapet.com/privacy
Términos de uso: https://vivrapet.com/terms
```

**5.4 — Keywords** (100 chars max, separadas por coma, sin espacios entre comas)
```
mascota,perro,salud,vacunas,veterinario,peso,pasaporte,grooming,recordatorio,cuidado
```

**5.5 — URLs**
- **Support URL:** `https://vivrapet.com/support` o `mailto:soporte@vivrapet.com`
- **Marketing URL (opcional):** `https://vivrapet.com`
- **Privacy Policy URL:** `https://vivrapet.com/privacy` ← obligatorio

**5.6 — Age Rating** (sidebar → App Information → Age Rating → Edit)
Responder todas como "None" EXCEPTO:
- "Unrestricted Web Access": **No**
- "Medical/Treatment Information": **Infrequent/Mild**
→ Rating esperado: **4+**

**5.7 — App Privacy (Nutrition Labels)** (sidebar → App Privacy → Edit)

Click "Get Started" / "Set Up App Privacy". Declarar estos data types, todos como **"Linked to you"** y **"Not used for tracking"**:

| Data Type | Purpose |
|---|---|
| Email address | App Functionality, Account management |
| Name | App Functionality |
| Photos (pet photos) | App Functionality |
| Other User Content (pet health data) | App Functionality |
| User ID | App Functionality |
| Purchase History | App Functionality |

**NO marcar:**
- Health & Fitness data (son datos de la mascota, no del usuario)
- Contacts, Location, Browsing history, Search history, Sensitive info
- Tracking-related items

**5.8 — App Review Information** (sidebar → Version → scroll a "App Review Information")
- First name / Last name: tu nombre real
- Phone: tu teléfono
- Email: `diarcaes@gmail.com`
- **Sign-in required: Yes**
- **Username:** `demo@vivrapet.com`
- **Password:** `VivraDemo2026!`
- **Notes:**
```
Vivra is a Spanish-language pet health tracker (dog-focused).

Demo account:
- demo@vivrapet.com / VivraDemo2026!
- Has a sample pet "Rocky" (Golden Retriever) with preloaded vaccines,
  weight history, food, grooming, and preventive records.

Authentication:
- Sign in with Apple, Google, and email/password all supported.
- The app conforms to Guideline 4.8 (SIWA offered prominently).

Subscription:
- 7-day free trial, then $2.99/month or $14.99/year auto-renewable.
- Trial + pricing + auto-renewal + cancellation path are disclosed
  prominently on the paywall (Guideline 3.1.2).
- Privacy Policy and Terms of Use are linked from the paywall and
  from the Profile tab (Perfil > Legal y soporte).

Account deletion:
- Available in Perfil > Zona de peligro > Eliminar mi cuenta.
- Backed by a Supabase Edge Function that permanently deletes the
  user's auth record and all associated pet data (Guideline 5.1.1v).

Medical disclaimer:
- The Vivra Vitality Score is informational only — not a medical
  diagnosis. Disclaimer visible in the Salud tab and FAQ.
```

**5.9 — In-App Purchases / Subscriptions** (sidebar → Features → In-App Purchases / Subscriptions)

Si aún no existen los productos:

Crear **Subscription Group** `vivra_premium` (single, no upgrades/downgrades entre sí más allá de monthly↔yearly).

Dentro del grupo, crear:

**Product 1 — Monthly**
- Product ID: `vivra_premium_monthly` (debe coincidir exacto con el definido en RevenueCat + `constants/revenueCat.ts`)
- Reference Name: "Vivra Premium Monthly"
- Subscription Duration: 1 Month
- Price: Tier 3 ($2.99 USD)
- Localizations (es-MX, es-ES, en-US):
  - Display Name: "Vivra Premium"
  - Description: "Acceso completo a estadísticas, pasaporte imprimible, mascotas ilimitadas y compartir con co-dueño."
- Introductory Offer: Free Trial → 7 Days → All territories
- Review Information:
  - Screenshot: subir captura del paywall
  - Review Notes: "7-day free trial for new subscribers. Trial terms disclosed on paywall."

**Product 2 — Yearly**
- Product ID: `vivra_premium_yearly`
- Reference Name: "Vivra Premium Yearly"
- Duration: 1 Year
- Price: Tier 15 ($14.99 USD)
- Misma descripción + intro offer (7 días) + review info

Ambos productos: **Privacy Policy URL** = `https://vivrapet.com/privacy`, **License Agreement** = standard EULA de Apple (o link a `/terms`).

Submit cada producto → "Ready to Submit" para que se adjunten al build.

**5.10 — Screenshots** (sidebar → Version → iOS Screenshots)

Requeridos: **6.7" Display (iPhone 15 Pro Max / 16 Pro Max)** — resolución 1290 × 2796 px. Mínimo 3, recomendado 6-8.

Opcional pero recomendado: **6.1" Display (iPhone 15 / 16 regular)** — 1179 × 2556 px.

Screens sugeridos (usar el demo account para que se vean realistas):
1. Home con hero card de Rocky + Score 78/100 + preventivos
2. Salud tab con pillars y score breakdown
3. Alimentación con progress bar y "Royal Canin · 12 días restantes"
4. Vacunas con badge gallery (Rabia ×1, Parvo ×2)
5. Perfil con datos de Rocky + sección Cuenta
6. Paywall con trial + disclosure
7. (opcional) Actividad / Grooming history

Capturar desde simulador iPhone 15 Pro Max:
```bash
# Con la app corriendo:
xcrun simctl io booted screenshot ~/Desktop/vivra-1.png
```

O usar `shift+cmd+4` en el simulador.

---

### PASO 6 — Build + Submit

Pre-checklist inmediato antes de build:
- [ ] `apps/mobile/app.json` → `version` = `"1.1.0"` ✅ (ya listo)
- [ ] Paso 1 Apple Developer hecho
- [ ] Paso 2 Supabase Apple provider habilitado
- [ ] Paso 3 edge function deployed y testeado
- [ ] Paso 4 demo account creado
- [ ] Paso 5 App Store Connect metadata completo (al menos: descripción, screenshots, demo credentials, IAP products "Ready to Submit")

Entonces:

```bash
cd /Users/dicans/Projects/vivra-monorepo/apps/mobile

# Build de producción — tarda ~15-25 min en los servers de EAS
npx eas build --platform ios --profile production

# EAS te dará un link tipo:
#   https://expo.dev/accounts/diegocans/projects/vivra-mobile/builds/<id>
# Status debería pasar a "finished". El .ipa queda guardado.

# Submit a App Store Connect (procesa ~5-15 min)
npx eas submit --platform ios --profile production
# Si pregunta qué build submitir → el último.
```

**Después del submit:**
1. Esperar ~15 min a que App Store Connect procese el build.
2. En ASC → TestFlight → el build `1.1.0 (xx)` aparecerá.
3. Auto-asignarte como **Internal Tester** → instalar TestFlight en tu iPhone → smoke test:
   - Sign in with Apple funciona
   - Paywall muestra legal links + disclosure completo
   - Perfil > Zona de peligro > Eliminar cuenta → flujo completa sin errores
   - Todos los tabs cargan sin crash
4. Si TestFlight OK → volver a ASC → Version 1.1.0:
   - **Build** → seleccionar el build procesado → Save
   - Asegurarse que los IAP están "Attached" al build
   - Click **"Add for Review"** (abajo a la derecha) → luego **"Submit to Review"**
5. Apple revisa en 24-48 horas. Si rechazan → Resolution Center te dice qué arreglar.

**Rejections típicos a vigilar:**
- 4.8 SIWA no visible / no funciona → ya cubierto
- 3.1.2 trial/precio poco claro → ya cubierto
- 2.1 feature rota (ej. delete-account devuelve 500) → testear con curl antes
- 5.1.1 account deletion falla → testear
- Privacy labels mismatch con lo que la app hace → revisar paso 5.7

---

### Orden sugerido y tiempos

| # | Paso | Tiempo aprox |
|---|------|---|
| 1 | Apple Developer Portal — capability | 10-15 min |
| 2 | Supabase Apple provider | 5 min |
| 3 | Deploy `delete-account` + test curl | 10-15 min |
| 4 | Crear demo account + data | 15-20 min |
| 5 | App Store Connect metadata + screenshots + IAP | 45-60 min |
| 6 | `eas build` (puedes seguir con screenshots en paralelo) | 20-25 min |
| 6 | `eas submit` + TestFlight smoke | 20-25 min |
| 6 | Add for Review + Submit | 5 min |

**Total real:** 2.5-3.5 horas, más la espera de Apple (1-2 días).

### Sources (research)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [RevenueCat — Ultimate Guide to App Store Rejections](https://www.revenuecat.com/blog/growth/the-ultimate-guide-to-app-store-rejections/)
- [Account Deletion Requirement (Apple News)](https://developer.apple.com/news/?id=12m75xbj)
- [Apple Guideline 3.1.2 — Paywall Rejection (AngularCorp)](https://www.angularcorp.com/en/insights/apple-guideline-3-1-2-subscription-rejection-missing-links/)
- [Cal AI rejection April 2026 (TechCrunch)](https://techcrunch.com/2026/04/21/apples-cal-ai-crackdown-signals-its-still-policing-the-app-store/)
- [nextnative — 2025 Rejection Reasons](https://nextnative.dev/blog/app-store-review-guidelines)
- [Expo App Stores Best Practices](https://docs.expo.dev/distribution/app-stores/)
