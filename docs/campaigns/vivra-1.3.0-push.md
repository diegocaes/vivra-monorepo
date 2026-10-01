# Campaña de lanzamiento Vivra 1.3.0

Estado: **enviada y cerrada el 1 de octubre de 2026. No repetir.**

## Mensaje enviado

Título: ¡Vivra se renueva! 🐾

Cuerpo: Salud, cuidado y viajes, ahora mejor organizados. Busca Vivra en App Store, actualiza y descubre el nuevo diseño.

Destino interno: `/dashboard`. El manejador de notificaciones actual abre Vivra; no abre enlaces externos de App Store. Por eso el texto indica buscar la actualización en la tienda.

## Autorización y disponibilidad

El propietario confirmó que solo existía permiso del sistema para notificaciones, sin preferencia adicional de novedades. Tras explicarle la diferencia y el riesgo para anuncios promocionales, autorizó expresamente este aviso puntual, condicionado a disponibilidad pública. Esta autorización no equivale a consentimiento promocional de los destinatarios ni autoriza campañas futuras.

Apple Lookup de Panamá confirmó públicamente la versión 1.3.0, publicada el 1 de octubre de 2026 a las 13:07:50 UTC. No se configuró un monitor ni programación recurrente. Esa consulta acredita disponibilidad en la tienda de Panamá, no en todos los países ni funcionamiento exhaustivo de producción.

## Audiencia y resultado

- 13 registros de dispositivos iOS, correspondientes a 12 usuarios; sin tokens compartidos entre cuentas.
- Un dispositivo por usuario: el registrado más recientemente. Se excluyen otras plataformas, tokens malformados, fechas inválidas y tokens asociados a varias cuentas.
- Primero se envió al propietario, quien confirmó recepción y apertura correcta. Su prueba contó como su envío de campaña para no duplicarlo.
- Después se enviaron los 11 mensajes restantes: Expo aceptó los 11 tickets. Los recibos posteriores indicaron 10 correctos y 1 `DeviceNotRegistered`.
- Total: **11 recibos correctos de 12 usuarios**, incluyendo la prueba. Un recibo correcto acredita aceptación por el servicio de notificaciones, no lectura o visualización en cada dispositivo.
- No se reintentó el token inactivo ni se eliminó de producción. No se alteraron Premium, compras, precios, cron de recordatorios ni tablas.
- No se conoce la versión instalada ni el permiso actual del sistema en dispositivos inactivos a partir de los registros disponibles.

## Herramienta y protección contra repetición

Herramienta operativa: `scripts/vivra-release-push.mjs`.

Modos: `preview`, `test <correo>`, `receipts` y `send`. Preview no envía; send exige un recibo correcto de prueba. El operador también debe confirmar recepción real de la prueba antes de enviar al resto.

Registro local: `output/push-campaigns/vivra-ios-1.3.0-launch.json`, excluido de Git. Contiene hashes y tickets, no tokens ni correos. **No borrar el registro ni ejecutar desde otro checkout para repetir la campaña.** Conservarlo para auditoría. El repositorio por sí solo no contiene el historial de envío.

Se usa un bloqueo de archivo contra ejecuciones concurrentes y una reserva persistida antes de la transmisión. Los resultados ambiguos quedan reservados sin reintento automático. Es una protección de un solo checkout/operador, no un servicio distribuido. Si un proceso termina inesperadamente, conciliar registros antes de retirar un bloqueo residual. No volver a ejecutar el envío desde una copia sin este registro.

El despachador pagina las consultas y detiene la operación ante errores. No invoca el cron existente de recordatorios. Las credenciales se leen del entorno local de web y no se imprimen ni se guardan en Git.

## Verificación

`pnpm verify` pasó: 23 archivos de pruebas, 131 pruebas correctas y tipos sin errores. Astro: 0 errores, 0 warnings y 41 hints existentes. Las pruebas nuevas cubren selección de un dispositivo por usuario, tokens ambiguos entre cuentas y exclusión de registros no elegibles. El envío y los recibos fueron comprobados en producción como se describe arriba.
