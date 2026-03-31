# Guia de Desarrollo y Deploy — Vivra iOS

## Tu Stack (lo que usas)

| Herramienta | Para que sirve |
|---|---|
| **Expo / React Native** | Framework para hacer la app movil con JavaScript/TypeScript |
| **TypeScript** | Lenguaje — es JavaScript con tipos (menos bugs) |
| **Expo Router** | Navegacion entre pantallas (como Next.js pero para movil) |
| **Supabase** | Backend: base de datos (PostgreSQL), autenticacion, Edge Functions |
| **EAS (Expo Application Services)** | Servicio en la nube que compila tu app y la sube a las tiendas |
| **App Store Connect** | Portal de Apple donde gestionas tu app, TestFlight y publicacion |
| **TestFlight** | App de Apple para probar tu app antes de publicarla |

---

## Como funciona el flujo de trabajo

```
Editas codigo → Pruebas en simulador → Commit a git → Build en EAS → TestFlight → App Store
     |                    |                   |              |              |            |
  Tu editor         expo start           git push      eas build      eas submit    Manual
  (VS Code)        (desarrollo)                       (10-15 min)    (5-10 min)   (Apple Review)
```

### 1. Desarrollo diario

```bash
# Iniciar el servidor de desarrollo
npx expo start

# Si necesitas el simulador iOS
npx expo start --ios
```

Esto abre tu app en el simulador. Cada vez que guardas un archivo, la app se recarga sola (hot reload). **No necesitas hacer build para probar cambios durante desarrollo.**

### 2. Cuando hacer build + TestFlight

**NO necesitas hacer build para cada cambio pequeno.** Cada build gasta recursos y tiempo (~15 min build + ~10 min procesamiento Apple). Usa esta checklist:

#### REGLAS PARA MANDAR A TESTFLIGHT

Solo haz build + submit cuando se cumpla **al menos una** de estas:

**SI mandar cuando:**
- Terminaste una feature completa (no a medias)
- Corregiste un bug critico que afecta el uso real de la app
- Cambiaste algo nativo (nueva libreria, permisos, icono, splash, app.json)
- Vas a mostrarle la app a alguien (inversionista, amigo, beta tester)
- Llevas 3+ dias de cambios acumulados y todo funciona en simulador
- Vas a enviar la version final a Apple para review

**NO mandar cuando:**
- Cambiaste un color o un texto — usa OTA update
- Arreglaste algo que solo se ve en una pantalla poco usada — espera a acumular mas
- No has probado en el simulador todavia
- El cambio esta a medias o incompleto
- Solo moviste archivos o hiciste refactor interno (el usuario no nota nada)

**Antes de cada build, preguntate:** "Si un usuario abre TestFlight y ve esta version, va a notar algo nuevo o mejor?" Si la respuesta es no, no hagas build.

**Regla practica:** acumula varios cambios, pruebalos bien en el simulador, y cuando estes satisfecho haz un build. Tipicamente 1-2 builds por semana es suficiente durante desarrollo activo.

### 3. El proceso de actualizar (paso a paso)

#### Paso 1: Edita y prueba localmente
```bash
# Desarrolla normalmente
npx expo start
# Prueba todo en el simulador
```

#### Paso 2: Sube tu version
Antes de hacer build, actualiza el numero de version en `app.json`:

```json
{
  "expo": {
    "version": "1.0.1",  // Version publica (la que ve el usuario)
  }
}
```

**Versionado:**
- `1.0.0` → `1.0.1` — fix pequeno o mejora menor
- `1.0.0` → `1.1.0` — feature nueva
- `1.0.0` → `2.0.0` — cambio grande / rediseno

El **build number** (numero interno) lo incrementa EAS automaticamente. Apple lo usa para diferenciar builds de la misma version.

#### Paso 3: Commit y push
```bash
git add .
git commit -m "descripcion de los cambios"
git push
```

#### Paso 4: Build de produccion
```bash
npx eas build --platform ios --profile production
```
Esto:
- Sube tu codigo a los servidores de EAS
- Compila la app (~5-15 minutos)
- Genera un archivo .ipa (el instalable de iOS)

#### Paso 5: Subir a TestFlight
```bash
npx eas submit --platform ios --profile production
```
Esto:
- Toma el .ipa del build mas reciente
- Lo sube a App Store Connect
- En ~15-30 min aparece en TestFlight

#### Paso 6: Probar en TestFlight
- Abre la app **TestFlight** en tu iPhone
- La nueva version aparece automaticamente
- Pruebala en un dispositivo real

---

## Updates sin build (OTA Updates)

Para cambios que **NO tocan codigo nativo** (solo JS/UI), puedes enviar updates instantaneos sin pasar por el build completo:

```bash
npx eas update --branch production --message "fix: corregido bug en pantalla de salud"
```

Esto envia solo el JavaScript actualizado. Los usuarios lo reciben la proxima vez que abren la app. **No necesita review de Apple.**

**Cuando funciona OTA:**
- Cambios en pantallas, estilos, logica, textos
- Fixes de bugs en JS/TS
- Nuevos componentes

**Cuando NO funciona (necesitas build completo):**
- Agregaste una nueva libreria nativa (ej: react-native-maps)
- Cambiaste permisos en app.json
- Actualizaste la version de Expo SDK

---

## Publicar en el App Store (primera vez)

Despues de probar en TestFlight y estar listo:

### En App Store Connect (https://appstoreconnect.apple.com)

1. **Screenshots** — Capturas de pantalla de la app (minimo iPhone 6.7" y 5.5")
2. **Descripcion** — Texto descriptivo de la app
3. **Keywords** — Palabras clave para busqueda
4. **Categoria** — Lifestyle o similar
5. **URL de privacidad** — Link a tu politica de privacidad
6. **App Privacy** — Nutrition label (que datos recopilas)
7. **Selecciona el build** de TestFlight que quieres publicar
8. **Submit for Review**

Apple tarda **24-48 horas** en revisar (a veces menos).

### Para updates despues de publicar

El proceso es igual:
1. Edita codigo
2. Sube version en app.json (`1.0.1`, `1.0.2`, etc.)
3. `eas build` → `eas submit`
4. En App Store Connect, selecciona el nuevo build y envia a review

---

## Resumen de comandos

| Que quieres hacer | Comando |
|---|---|
| Desarrollar / probar local | `npx expo start` |
| Build iOS produccion | `npx eas build --platform ios --profile production` |
| Subir a TestFlight | `npx eas submit --platform ios --profile production` |
| Update rapido (solo JS) | `npx eas update --branch production --message "descripcion"` |
| Ver builds anteriores | `npx eas build:list` |
| Ver estado de submission | `npx eas submit:list` |

---

## Estructura del proyecto

```
vivra-mobile/
├── app/                    # Pantallas (Expo Router)
│   ├── (app)/              # Pantallas con tabs (autenticado)
│   │   ├── index.tsx       # Home / Dashboard
│   │   ├── salud/          # Tab de salud (vacunas, peso, etc.)
│   │   ├── alimentacion.tsx
│   │   ├── viajes.tsx
│   │   └── perfil.tsx
│   ├── onboarding.tsx      # Registro de mascota
│   └── login.tsx           # Login
├── components/             # Componentes reutilizables
├── contexts/               # PetContext (estado compartido)
├── hooks/                  # usePet, useAuth, etc.
├── lib/                    # Supabase client, utilidades
├── assets/                 # Imagenes, iconos
├── ios/                    # Proyecto nativo iOS (generado)
├── app.json                # Configuracion de Expo
└── eas.json                # Configuracion de EAS Build/Submit
```

---

## Cuando me pregunten "con que esta hecha la app"

> Vivra esta hecha con **React Native** usando **Expo** como framework. El lenguaje es **TypeScript**. El backend es **Supabase** (base de datos PostgreSQL, autenticacion, y funciones serverless). Los builds y deploys se hacen con **EAS (Expo Application Services)**. La app esta disponible en iOS a traves del App Store.

---

## Tips importantes

1. **Nunca edites la carpeta `ios/` manualmente** — EAS se encarga de eso
2. **Siempre prueba en simulador antes de hacer build** — cada build usa recursos de tu plan EAS
3. **Guarda los cambios en git antes de hacer build** — asi puedes volver atras si algo falla
4. **Los OTA updates son tu mejor amigo** — para fixes rapidos sin esperar build + review
5. **Lee los emails de Apple** — si rechazan la app, te dicen exactamente por que
