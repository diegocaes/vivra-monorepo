# Revisión iOS 27 y Sentry — septiembre de 2026

## Evidencia de Sentry

Consulta en Zen, proyecto `react-native`, incidencias sin resolver de los últimos
14 días, realizada el 15 de septiembre. No se marcaron incidencias como resueltas.

| Incidencia | Evidencia | Alcance |
| --- | --- | --- |
| [REACT-NATIVE-5](https://vivra-b9.sentry.io/issues/7732435056/) | Dos eventos `Auth bootstrap timed out`, fase `getSession`, iPhone 15 Pro Max, iOS 26.6.2, app 1.2.2 (21), OTA `01a09ff8-1109-7626-808b-8a7d77c1cf2b`. | Confirma el timeout; no identifica por qué no terminó la restauración. |
| [REACT-NATIVE-4](https://vivra-b9.sentry.io/issues/7730198401/) | HTTP 504 en consulta de vacunas; también aviso de timeout en premios de alimentación. iOS 26.6.2, app 1.2.2 (21). | Fallo de respuesta del backend; no prueba incompatibilidad de iOS. |
| [REACT-NATIVE-3](https://vivra-b9.sentry.io/issues/7722098336/) | La excepción genérica contiene `message: Gateway Timeout`; HTTP 504 en `pet_shares`, fase `startup_pet_lookup`. iOS 26.6.1, app 1.2.2 (21), bundle embebido. | La consulta falló; no equivale a una cuenta sin mascotas. |
| [REACT-NATIVE-1](https://vivra-b9.sentry.io/issues/7708723518/) | HTTP 500 en `delete-account`, 3 de septiembre, app 1.2.1 (19), iOS 26.6.1. | Hace falta el log de la Edge Function para identificar la operación fallida. No se ejecutó una eliminación para reproducirlo. |
| [REACT-NATIVE-2](https://vivra-b9.sentry.io/issues/7721949328/) | La lista muestra un evento `Auth bootstrap timed out` del 9 de septiembre. | Detalle del evento pendiente de revisar. |

## Ajustes locales

- Un `INITIAL_SESSION` nulo espera a `getSession` antes de interpretar la cuenta
  como desconectada: Supabase también emite ese evento si falla la renovación.
- Renovación de sesión ligada al primer/segundo plano; reintento al volver a la
  app cuando hay error de arranque.
- Pantalla de recuperación con botón centrado, título centrado y contenido
  desplazable para tamaños de texto grandes.
- Consultas de mascotas y salud: un reintento tras 400 ms para errores de red,
  408, 502, 503 y 504. Solo se repite la lectura fallida; ninguna escritura.
- Alimentación comprueba ambas consultas antes de sustituir el historial,
  conserva los datos anteriores si falla la actualización y muestra un aviso
  con reintento. Descarta respuestas de mascotas anteriores y evita mostrar
  «Aún no has registrado comida» cuando hay un error de carga.

## HTTP 500 de eliminación de cuenta

El usuario revisó los logs de Supabase y no encontró el error histórico.
El evento ocurrió el 3 de septiembre a las 03:00:52 UTC. El commit `6014974`,
del mismo día a las 03:18:14 UTC, eliminó una operación sobre `profiles` del
flujo de borrado. Esa tabla no figura en el esquema actual; se usa
`owner_profiles`. Es una explicación plausible, no una causa confirmada sin
el log. Falta comprobar que la función desplegada contiene esa corrección.
Una OTA no despliega Edge Functions.

Estos cambios no se han publicado y no demuestran que el timeout de producción
esté corregido. Las pruebas unitarias cubren la carrera de sesión nula.

## Verificación

- `pnpm verify`: 122 pruebas aprobadas, comprobaciones de tipos aprobadas;
  advertencias de lint preexistentes.
- Tres regresiones nuevas verifican recuperación de un 504, rechazo de un
  fallo persistente sin devolver un historial vacío y ausencia de reintentos
  ante un 403, usando el cliente Supabase con transporte simulado.
- Exportación del bundle iOS aprobada tras los cambios de lectura.
- iOS 26.5: navegación, formularios y tres reinicios con sesión y mascota
  restauradas aprobaron antes de retirar los runtimes de iOS 26.
- Xcode 27.0 (27A266a), runtime iOS 27.0 (24A434), iPhone 18 Pro.
- Metro en puerto 8081 confirmado en este checkout.
- iOS 27: el usuario pudo abrir Vivra e iniciar sesión. Captura de Maestro muestra
  a Tinto y el contenido de Inicio. Navegación automática falló con el menú de
  desarrollo de Expo superpuesto; formularios falló en el inicio de Expo Go.
  No contar estos recorridos automáticos como aprobados. El 16 de septiembre el
  usuario confirmó manualmente que Salud, Comida y Perfil cargan datos y que,
  tras cerrar y reabrir Expo Go, se conserva la sesión y aparece Tinto sin error.
- Tras los cambios de lecturas del 16 de septiembre, Maestro aprobó navegación
  principal (54 s) y apertura/cierre de formularios (35 s) en Expo Go conectado
  al Metro de este checkout. Evidencia: `~/.maestro/tests/2026-09-16_082002/`.
  Estos recorridos no simulan fallos del backend ni verifican exhaustivamente
  los datos; los 504 se cubren con las regresiones de transporte simulado.
- Compras, push, integración nativa de Sentry, eliminación de cuenta y el fallo
  de producción en un dispositivo real siguen sin verificar en iOS 27.
