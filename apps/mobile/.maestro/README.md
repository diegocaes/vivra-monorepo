# Pruebas E2E de Vivra

Estas pruebas reproducen los recorridos que anteriormente podían dejar la
pantalla en blanco. No crean, editan ni eliminan datos.

## Expo Go (navegación y formularios)

1. Inicia Expo con Node 22:

   ```bash
   cd /Users/dicans/Projects/vivra-monorepo/apps/mobile
   nvm use 22.23.2
   npx expo start --ios
   ```

2. Para el arranque sin sesión:

   ```bash
   MAESTRO_CLI_NO_ANALYTICS=1 maestro test \
     .maestro/flows/auth-startup-expo.yaml
   ```

3. Para navegación y formularios, inicia sesión manualmente en Expo Go y
   ejecuta:

   ```bash
   MAESTRO_CLI_NO_ANALYTICS=1 maestro test \
     -e APP_ID=host.exp.Exponent \
     .maestro/flows/core-navigation.yaml \
     .maestro/flows/forms-open-close.yaml
   ```

## Build nativo

Con Vivra instalada como build de desarrollo, usa el identificador real:

```bash
MAESTRO_CLI_NO_ANALYTICS=1 maestro test \
  -e APP_ID=com.vivrapet.app \
  .maestro/flows/auth-startup.yaml \
  .maestro/flows/core-navigation.yaml \
  .maestro/flows/forms-open-close.yaml
```

Expo Go sirve para navegación y formularios. Compras, notificaciones push y
la integración nativa de Sentry deben probarse con el build nativo.
