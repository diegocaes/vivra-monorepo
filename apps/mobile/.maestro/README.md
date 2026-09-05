# Pruebas E2E de Vivra

Estas pruebas reproducen los recorridos que anteriormente podían dejar la
pantalla en blanco. No crean, editan ni eliminan datos.

## Expo Go (navegación y formularios)

1. Inicia Expo con Node 22:

   ```bash
   # Desde la raíz del repositorio
   nvm use
   pnpm dev:mobile --localhost --port 8081
   # Abre la URL de Metro en Expo Go; los comandos de abajo van desde apps/mobile.
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

No ejecutes todos los flows como una sola suite: los de arranque requieren una
sesión cerrada y los de navegación/formularios requieren una sesión iniciada.
`pnpm test:mobile:navigation`, desde la raíz, ejecuta únicamente los dos últimos
con el bundle ID nativo. Confirma que el build de desarrollo carga el Metro de
este checkout; un build release instalado puede contener código anterior.

El flow de navegación comprueba contenido de Salud y los contenedores de Comida
y Perfil. Ya no busca `health-passport`, un botón eliminado de Salud. Las capturas
y logs de Maestro ayudan a distinguir una sesión ausente de un fallo de navegación.
Los flows cierran el aviso de desarrollo “Open debugger to view warnings” cuando
aparece: ese aviso cubre la barra de tabs e intercepta los taps en iOS.
