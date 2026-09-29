# Rediseño Vivra · revisión antes del commit

Implementación basada en las referencias móvil y escritorio proporcionadas por el usuario.
Sin commit ni despliegue. No se modificaron esquemas, tablas SQL, migraciones ni dependencias.

## Organización aprobada y entrega para prueba manual (29 de septiembre)

- Salud reúne vacunas, visitas veterinarias, preventivos y peso. Grooming se administra desde Cuidado, junto a Alimentación.
- Viajes reúne viajes/requisitos y acceso al pasaporte. Se retiró el acceso duplicado a certificados que llevaba a la misma pantalla de viajes.
- Más separa Mi mascota, Gastos, Mi cuenta, Premium, referidos y ayuda. Los enlaces de identidad mantienen el acceso a Mi mascota.
- El perfil conserva el peso como información; el registro de cambios de peso se realiza en Salud.
- Se conservan formularios y rutas existentes, sin migraciones ni cambios de tablas.
- Las comprobaciones documentadas más abajo corresponden a las rondas anteriores. La revisión manual final de esta organización en web y simulador queda a cargo del usuario por solicitud expresa; no se ejecutan nuevos recorridos automatizados en esta entrega.
- Todo permanece sin commit para permitir los ajustes que surjan de esa revisión.

## Alcance

- Sistema visual crema (#F7F4EE), verde bosque (#174C3C), superficies marfil y categorías pastel.
- Bienvenida, acceso, Inicio, selector de mascotas, Salud, Cuidado, Viajes, Más, formularios y pasaporte móvil.
- Cinco pestañas; Alimentación y Vuelos viven en sus stacks correspondientes. Las URLs anteriores redirigen.
- Pasaporte compartido entre su ruta original y Viajes; conserva identificación, vacunas, exportación y acceso a vuelos.
- Transiciones nativas y modales respetan reducir movimiento. Se mantienen las protecciones contra pestañas blancas.
- Web: bienvenida pública, navegación lateral, buscador de secciones, acciones rápidas, dashboard adaptable, pasaporte y estilos compartidos.
- Los estados, fechas, historial y métricas utilizan los datos existentes. No se inventa aprobación para viajar.
- Errores de lectura nuevos muestran reintento; no se interpretan como una cuenta vacía.
- `output/` (contenido generado existente fuera del código fuente) se excluyó de Biome porque contiene proveedores de animación minificados.

## Verificación realizada

- Node 22.23.2 / pnpm 9.15.9. `pnpm run doctor` correcto.
- `pnpm verify`: 21 archivos / 124 pruebas; tipos móvil y compartidos correctos; Astro sin errores, 37 hints existentes.
- `pnpm build:web` y `pnpm smoke:web`: correctos; smoke comprueba seis rutas/condiciones públicas.
- Exportación iOS correcta en `/tmp/vivra-ios-redesign`: bundle Hermes reportado como 8 MB; ilustración 275 KB. Sin comparación de rendimiento con una versión base.
- Maestro sobre Expo Go, iPhone 18 Pro / iOS 27, Metro de este checkout en puerto 8081:
  - Bienvenida → registro → acceso → recuperación, sin crear cuenta.
  - Cinco pestañas tres veces con comprobaciones de contenido, Alimentación y retorno de Grooming.
  - Apertura y cancelación de Grooming y preventivo combinado; teclado, desplazamiento y limpieza del borrador.
  - Detalle real de vacuna, edición y alta canceladas; pasaporte, Vuelos y regreso a Inicio.
- Web autenticada con la mascota existente: dashboard, registros y gráfica; pasaporte; menú móvil; búsqueda por teclado; acción rápida de vacuna y peso; cierre de formularios.
- Revisión visual de escritorio y ancho 390 px: dashboard y pasaporte sin desbordamiento horizontal. Bienvenida pública revisada en navegador.

Los fallos iniciales de Maestro fueron selectores de accesibilidad, arranque en la portada de Expo Go y una ruta de captura no admitida. Se corrigieron y los recorridos finales pasaron.

## Límites de esta revisión

No se guardaron ni eliminaron registros reales como parte de las pruebas. No se verificaron compras, push, Sentry nativo, subida de fotos, descarga final del PDF ni acceso con varias mascotas/co-dueño en dispositivo. Sus pruebas de regresión existentes siguen pasando. No se midió latencia de usuario ni se desplegó a producción.

## Vistas de prueba

- Dashboard con sesión: http://127.0.0.1:4321/dashboard
- Bienvenida sin sesión, en el host alternativo: http://localhost:4321/
- App: Expo Go del simulador conectado a exp://localhost:8081.

## Ilustración

Generada con la herramienta integrada ImageGen siguiendo la referencia del usuario. Archivos finales:

- `apps/mobile/assets/images/welcome-pets.jpg`
- `apps/web/public/welcome-pets.jpg`

Prompt final empleado:

> Edit the reference illustration into a LANDSCAPE asset, width 1536 height 1024, wider than tall. This is critical: it must fit a 400-wide by 300-high image slot in a phone welcome screen with both pets' complete heads visible and at least 10% blank cream margin above the dog's head. Preserve the same dog and cat identity, painting style, forest green collar, cream background #F7F4EE, sage and dark green botanical leaves at the sides, and soft curved cream foreground. Recompose by making both pets smaller, seated side by side in the center, surrounded by foliage. Preserve complete ears and heads, crop only lower paws behind cream foreground if needed. The topmost 10% should be blank solid warm cream #F7F4EE blending into the illustration, bottom edge also blends to #F7F4EE. No text no UI no borders no phone.

## Ajuste posterior solicitado

- Se restauró el logo original negro con huella naranja, reutilizando el archivo existente sin redibujarlo, en la web y en los encabezados/pasaporte móvil modificados.
- Las tarjetas de «Cómo funciona» comparten las filas de título, descripción y vista interior en escritorio. Se eliminó el margen inferior negativo que recortaba las vistas.
- Medición en navegador a 1440 px: las tres vistas interiores tienen el mismo inicio y final vertical. A 390 px las tres permanecen dentro de sus tarjetas y no hay desbordamiento horizontal.
- La copia HTML usada para revisar la portada pública sin cerrar la sesión se eliminó después de la prueba.

## Salud: referencia por pestaña (28–29 de septiembre)

- App: ficha de mascota con bienestar, peso y microchip; lista compacta de las funciones existentes y alta rápida. Vacunas, visitas y preventivos tienen Resumen/Historial, identidad de mascota y acción principal fija. Se conservan formularios, gráficos, carné físico y detalles de aplicaciones.
- Web: ficha con índice de bienestar, navegación entre las seis secciones existentes, estado de salud, próximas fechas e historial reciente. Subpáginas con cabecera compartida, métricas y formularios existentes. Logo original conservado.
- No se añadieron módulos ficticios de medicamentos, resultados o notas independientes. No se modificaron tablas, migraciones ni dependencias.
- Los errores de carga se muestran como errores en vez de historiales vacíos. Las operaciones web revisadas comprueban el error de Supabase antes de mostrar éxito. No se probaron escrituras reales en la cuenta.
- `pnpm verify`: 21 archivos, 124 pruebas correctas; Astro: 0 errores, 0 warnings, 41 hints. `pnpm build:web` y las seis comprobaciones de `pnpm smoke:web` correctos.
- Exportación iOS en `/tmp/vivra-health-ios-check` correcta: Hermes reportado como 8 MB. No se midió un cambio de rendimiento ni latencia.
- Maestro `health-layout-expo.yaml`: correcto con Tinto y Metro del checkout en 8081; comprueba contenido, Resumen/Historial de las tres subpantallas, alta/cancelación y acceso rápido desde «+».
- Navegador autenticado: navegación por todas las secciones de Salud; apertura/cierre de vacunas, edición de Rabia cancelada, visitas, preventivo combinado cancelado, peso y grooming. El formulario de visitas sigue abriendo al regresar desde otra sección.
- Revisión visual de Salud y Preventivos a 390 px: ancho del documento 385 px, sin desbordamiento horizontal. Vista de escritorio restaurada después de la comprobación.
- Vista de prueba: http://127.0.0.1:4321/salud. Cambios sin commit para revisión del usuario.
- Regresión final del 29 de septiembre en el simulador: `core-navigation`, `forms-open-close` y `vaccine-passport-expo` pasan (3/3, 2 min 20 s). Incluye cinco pestañas repetidas, borrador de preventivo combinado, edición/alta de vacuna canceladas, pasaporte y Vuelos. El desglose del índice web abre correctamente desde la ficha.
