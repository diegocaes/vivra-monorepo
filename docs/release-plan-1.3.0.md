# Plan de salida Vivra 1.3.0

Fecha: 29 de septiembre de 2026. Plan inicial y registro de decisiones.

## Estado de ejecución

- Commit del candidato: 86d0f48. Build EAS de producción 1.3.0 (23): aef6d52d-3f48-42f4-9111-2c7b1163074c.
- Verificación técnica: 128 pruebas correctas, tipos y build web correctos, smoke público 6/6 y exportación iOS correcta.
- ASC: borrador 1.3.0 con novedades y notas de revisión actualizadas, liberación manual y distribución escalonada de siete días.
- El usuario autorizó después usar TestFlight para simplificar la prueba en su iPhone. La preparación ad hoc se canceló; no se generó un segundo build.
- La revisión de compras/push nativos queda a cargo del usuario. La publicación al público y el anuncio siguen pendientes. Las capturas heredadas de 1.2.3 deben actualizarse antes del envío final a revisión.
- El resto de este documento conserva el plan inicial, incluido el camino sin TestFlight que fue sustituido por la decisión anterior.

## Base confirmada

- App Store Connect muestra iOS 1.2.3 en Ready for Distribution. Se propone 1.3.0 por el alcance del rediseño.
- El repositorio mantiene com.vivrapet.app, los identificadores vivra_premium_monthly / vivra_premium_yearly y el entitlement premium. Los archivos de cobro, webhooks y migraciones no están modificados por este rediseño.
- EAS production tiene incremento remoto del build, entorno/canal production y runtime basado en appVersion. Al cambiar versión, no publicar una actualización OTA dirigida al runtime anterior.
- El usuario validó la web y prefiere realizar los recorridos manuales. Expo Go sirve para el diseño; el código desactiva allí RevenueCat nativo y el registro push en simulador, por lo que esas pruebas no prueban compras ni push reales.
- Falta comparar contra el commit/build efectivamente publicado; HEAD no demuestra por sí solo qué contiene 1.2.3.

## Condiciones antes del commit de release

1. Revisar el diff completo, incluyendo archivos nuevos y los módulos trasladados. Excluir output/ y artefactos de pruebas del commit. Mantener los enlaces antiguos mediante rutas compatibles.
2. Corregir y cubrir con regresiones los riesgos observados en useSubscription: un fallo de consultas puede terminar en isPremium=false; restorePurchases puede sobrescribir acceso web/compartido/promocional al mirar solo Apple. Revisar además carreras al cambiar de usuario, aislamiento entre cuentas y estados de carga de las pantallas Premium. No conceder acceso indefinido ni reutilizar el estado de otra cuenta como solución.
3. Verificar el Offering paywall_v2_test contra producción en RevenueCat antes de incluirlo en la salida; su nombre y comentario indican que requiere confirmar su intención y los productos asociados. Mantener productos, precios y renovaciones actuales.
4. Actualizar los destinos de notificaciones: perfil debe abrir Mi mascota y grooming debe pertenecer a Cuidado. Comprobar apertura con app cerrada y mascota correcta, también para notificaciones antiguas.
5. Completar una ronda de verificaciones técnicas sobre el candidato final: pnpm verify, build:web, smoke:web y export iOS. Las pruebas visuales/manuales quedan al usuario; no repetir recorridos extensos de Maestro.
6. El usuario comprueba en iPhone con build nativo de desarrollo firmado, sin TestFlight: acceso Premium existente, restauración, gasto detallado, co-dueño, cambio de cuenta y recepción/apertura de un push de prueba destinado solo a su dispositivo. Usar sandbox para nuevas compras, sin cobrar ni cancelar suscripciones reales.

## Publicación

1. Cerrar los bloqueos anteriores; actualizar app.json a 1.3.0 y preparar notas y capturas reales del rediseño.
2. Crear commit revisado y registrar SHA; compilar EAS production desde ese mismo código. Registrar build ID y número, revisar credenciales APNs/producción y compatibilidad del SDK. No actualizar dependencias indiscriminadamente.
3. Subir el build a ASC, asociarlo a 1.3.0 y completar metadatos, privacidad, credenciales/instrucciones de revisión y export compliance. Sin distribución a testers de TestFlight. La revisión normal de Apple sigue siendo necesaria.
4. Propuesta: liberación manual tras aprobación, con actualizaciones automáticas escalonadas durante siete días. Esto no impide que cualquier usuario actualice manualmente.
5. Desplegar web como operación separada con su propia verificación y opción de revertir. Mantener backend compatible con 1.2.3 y 1.3.0; no desplegar cambios de esquema/cobro por el rediseño.
6. Vigilar errores de arranque, autenticación, escrituras y acceso Premium mediante las herramientas existentes. Ante regresión crítica, pausar distribución escalonada y campaña; preparar corrección. Una pausa no revierte las instalaciones que ya actualizaron. No considerar una versión anterior como un rollback inmediato de App Store.

## Campaña push: bloqueada hasta validar consentimiento y disponibilidad

- El envío actual es un despachador diario de recordatorios; no es una herramienta de anuncios de versiones. No invocarlo como prueba: puede enviar mensajes reales a usuarios.
- No se encontró una preferencia/consentimiento explícito de marketing en el código revisado. El permiso del sistema para recordatorios no equivale a aceptar anuncios promocionales. Verificar si hay consentimiento documentado en otra fuente antes de seleccionar destinatarios.
- Si no existe, añadir una preferencia opcional de novedades con baja dentro de la app y persistencia explícita; esto sería un cambio de datos separado, revisado y compatible. Nunca activar retroactivamente a usuarios existentes. Para quienes no hayan aceptado, usar novedades de App Store y un aviso dentro de la app al entrar.
- Construir campaña separada con vista previa de cantidad de destinatarios, deduplicación, registro de campaña, lotes, control de errores y recibos de Expo. Un ticket aceptado no demuestra entrega al dispositivo.
- Primera prueba solo al dispositivo del propietario. Envío general una sola vez, únicamente a usuarios elegibles, después de confirmar disponibilidad y estabilidad de la nueva versión. Esperar al final del escalonamiento evita impulsar actualizaciones masivas durante la observación inicial.
- Borrador: título «Vivra se renueva 🐾». Mensaje «Rediseñamos y reorganizamos Vivra para que cuidar a tu mascota sea más fácil. Actualiza y descubre lo nuevo.» Destino compatible con versiones anteriores; revisar que el toque abra la app y permita llegar a la actualización.

## Fuentes de publicación

- https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app
- https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/
- https://developer.apple.com/app-store/review/guidelines/la/ (4.5.4: consentimiento y baja para push promocional)

Pendiente: auditoría completa del candidato, consultas de configuración productiva en RevenueCat/EAS, ejecución técnica final y verificación nativa por el usuario. No se afirma riesgo cero ni funcionamiento de compras/push por una prueba en Expo Go.
