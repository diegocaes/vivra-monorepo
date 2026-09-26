# Vivra: visitas, registros, SEO y ASO

Revisión del 18 de septiembre de 2026. Datos leídos de Vercel Analytics, Supabase, Google Search Console y App Store Connect. Las ventanas y definiciones difieren: no sumar visitantes, eventos, cuentas y descargas como si fueran personas distintas.

## Conclusión

Sí llega gente, sí hay clics hacia Crear cuenta y sí se crean cuentas. El volumen de adquisición es pequeño y la medición actual no permite conectar una publicación concreta con una cuenta confirmada. No hay evidencia suficiente para afirmar que el diseño de la landing sea la causa del abandono.

## Web: Vercel Analytics

Producción, intervalo mostrado «Last 30 Days», 19 de agosto–18 de septiembre. Incluye todos los hostnames de producción y actividad propia; no equivale a clientes únicos identificados. Lectura tomada antes de continuar las pruebas de navegación de esta auditoría.

| Métrica | Resultado |
| --- | ---: |
| Visitantes reportados en toda la web | 51 |
| Páginas vistas en toda la web | 327 |
| Visitantes de la landing `/` | 28 |
| Vistas de la landing | 38 |
| Visitantes de `/register` | 3 |
| Vistas de `/register` | 4 |
| Visitantes de `/login` | 9 |
| Visitantes de `/admin` | 11 |
| Rebote de toda la web | 45% |

Referentes mostrados: google.com 3, facebook.com 2, l.threads.com 1, accounts.google.com 1, vercel.com 1. No atribuir accounts.google.com a búsqueda orgánica: puede ser retorno del inicio de sesión. No ver X en esta lista no prueba ausencia de visitas desde X. Tampoco atribuir todo lo que no tiene referente a personas que escribieron la dirección: enlaces compartidos y navegadores pueden perder esa información.

Últimos 7 días al comenzar: 18 visitantes totales, 39 vistas, 10 visitantes de landing, Facebook 2 y Threads 1. El rebote mostrado era 56% para toda la web, no para la landing exclusivamente.

El panel no ofrece eventos personalizados en el plan Hobby actual (solicita Pro), y el desglose UTM solicita Web Analytics Plus. No se contrató ningún plan.

Fuente: https://vercel.com/diegos-projects-d913a967/petlog/analytics

## Clics y cuentas: base de datos

Consulta de solo lectura, paginada y con errores comprobados. Período: desde 2026-08-19 23:00 UTC hasta 2026-09-18 23:21 UTC. Solo se imprimieron agregados; no se exportaron correos ni identidades.

| Métrica | Resultado |
| --- | ---: |
| Eventos de todas las plataformas | 1.804 |
| Eventos `page_view` de landing | 65 |
| Clics de landing hacia `/register`, incluyendo parámetros | 4 |
| Clics de landing hacia `/login` | 3 |
| Clics hacia App Store | 1 |
| Clics hacia preguntas frecuentes | 1 |
| Clics hacia blog | 1 |
| Eventos de landing con origen/UTM guardado | 0 |
| Cuentas creadas en el período | 7 |
| De esas cuentas, con email confirmado | 7 |
| Cuentas totales existentes | 21 |

Métodos de alta de las siete cuentas: Google 3, email 3, Apple 1. Incluye cuentas de web y app, posibles pruebas y propietario. No son siete conversiones demostradas de la landing. Los 75 eventos de landing fueron anónimos: no se puede saber el nombre de quien pulsó Crear cuenta con este historial.

65 eventos propios de landing frente a 38 vistas en Vercel demuestra que los contadores no son intercambiables. No se determinó la causa de la diferencia; podrían influir cobertura, bloqueo, tráfico automatizado o navegación. No calcular una conversión real dividiendo estas cifras entre sí.

## Lo que falta en la medición

- `apps/web/src/components/Track.astro` registra vistas y clics, pero no sesión anónima, origen, UTM ni profundidad de lectura. Los botones repetidos pueden compartir nombre.
- `apps/web/src/pages/register.astro` incluye Vercel Analytics, pero no el componente Track ni un embudo propio de inicio, envío, error y confirmación del registro.
- No hay vínculo persistido entre publicación, llegada, clic y cuenta confirmada. No se puede reconstruir retroactivamente un origen que nunca se guardó.
- `apps/web/src/pages/api/track.ts` no comprueba el `{ error }` devuelto por el insert de Supabase y retorna 204 incluso si falla. La consulta demuestra que existen eventos guardados, pero no garantiza que todos se hayan guardado.
- El panel `/admin` lee como máximo 5.000 eventos de 14 días, no selecciona `props`, y convierte resultados nulos en listas vacías sin comprobar errores. Eso limita el análisis de adquisición y puede mostrar ceros engañosos.
- La actividad del propietario en sesión se puede filtrar; visitas propias anónimas no se distinguen automáticamente de las externas.

Prioridad de implementación: guardar un identificador anónimo limitado a sesión y fuente de entrada; eventos estables por ubicación del botón; inicio/envío/error del registro; confirmación desde servidor sin confundir login con alta nueva; primer perfil de mascota. Mostrar resultados por campaña, separando datos desconocidos y fallos de medición. No enviar contraseñas, emails ni contenido de formularios a analítica.

Embudo propuesto: llegada → clic Crear cuenta o App Store → formulario iniciado → solicitud de alta aceptada → cuenta confirmada → primera mascota. Un clic a App Store no demuestra una descarga.

## Search Console: configuración completada

- Propiedad de dominio `vivrapet.com` verificada con la cuenta de Google indicada por el propietario, mediante un TXT adicional en Vercel DNS.
- Había un TXT de verificación anterior fechado en julio; se conservó.
- Sitemap `https://vivrapet.com/sitemap.xml` enviado: Google confirmó «Correcto», lectura del 18 de septiembre y 6 páginas descubiertas.
- La verificación dio acceso a datos históricos: no implica que todos se hayan empezado a recoger hoy.

Fuente: https://search.google.com/search-console?resource_id=sc-domain%3Avivrapet.com

### Resultados SEO

Últimos 28 días, gráfico del 20 de agosto al 16 de septiembre: 21 impresiones, 2 clics, CTR 9,5%, posición media 3,2. No hay consultas desglosadas en esa ventana. Con tan pocas impresiones, la posición media no demuestra buen posicionamiento para búsquedas competitivas.

Vista de 3 meses, datos disponibles del 11 de julio al 16 de septiembre: 61 impresiones, 2 clics, CTR 3,3%, posición media 6,1. La tabla solo muestra «vivra» con 3 impresiones y 0 clics; el resto de las consultas no aparece desglosado, así que no sabemos qué términos generaron los 2 clics.

Indexadas: portada y `/privacy`. Cuatro URLs excluidas: tres variantes HTTP/www con redirección y una portada con parámetros de AppAgg. No deben interpretarse como cuatro páginas de contenido rotas ni es necesario forzar su indexación individual.

La portada ya tiene título descriptivo, descripción, canonical, tarjetas sociales y datos estructurados. La carencia más visible es alcance orgánico: solo 21 impresiones en 28 días.

### Blog: oportunidad concreta

`/blog` responde 200 y sí muestra numerosos artículos cuando se ejecuta el servicio externo Soro. El HTML inicial contiene el contenedor y un script, no los artículos. Cada artículo tiene una URL `?post=...`; el título cambia al cargarlo. La dependencia de JavaScript no hace imposible la indexación, pero merece revisar el HTML renderizado por Google y mejorar el descubrimiento.

Ni `/blog` ni sus artículos están en el sitemap de seis URLs, y no aparecen en las páginas indexadas mostradas por Search Console. Prioridad: artículos con contenido y metadatos accesibles desde servidor, canonical propio y sitemap completo. No hace falta cambiar las URLs actuales únicamente por estética.

El artículo comprobado, «Cómo archivar facturas veterinarias sin perder nada», menciona Vivra pero no muestra un enlace para crear cuenta ni descargarla. El encabezado solo ofrece Iniciar sesión. Añadir un CTA contextual al beneficio del artículo permitiría convertir y medir ese tráfico.

Antes de producir más textos, corregir descubrimiento/medición y reforzar artículos relacionados con la utilidad real de Vivra: carnet digital, historial veterinario y control de gastos. Validar demanda con Search Console a medida que exista muestra; no se midió volumen de palabras clave en esta auditoría.

Referencia: https://developers.google.com/search/docs/fundamentals/seo-starter-guide

## ASO: App Store Connect

Del 20 de junio al 17 de septiembre: 561 impresiones, 53 vistas de ficha, 10 primeras descargas y 2 redescargas. La conversión media diaria mostrada por Apple era 3,25%; no equivale a dividir primeras descargas entre vistas de ficha.

Origen de las 10 primeras descargas: búsqueda App Store 6, referente de app 2, referente web 1 y origen no disponible 1.

Ventana comparable, del 19 de agosto al 17 de septiembre: 4 primeras descargas; referentes de apps 2, búsqueda App Store 1 y referente web 1. No se comprobó que ese referente web fuera vivrapet.com.

Ficha publicada 1.2.2, idioma Spanish (Mexico):

- Nombre: «Vivra: Salud de tu Perro».
- Subtítulo: «Carnet, vacunas y veterinario».
- Keywords: `mascota,perro,gato,vacunas,veterinario,peso,desparasitación,antipulgas,pasaporte,grooming`.
- Cuatro capturas listadas: salud, vacunas, peso, pasaporte. No se realizó una evaluación visual detallada de cada imagen.
- Categorías: Lifestyle y Health & Fitness.

El nombre habla solo de perros mientras la web ofrece perros y gatos. Las keywords repiten palabras del nombre/subtítulo: hay espacio para mejorar cobertura sin repetirlas. Propuesta para la próxima versión, pendiente de validar con búsquedas y posicionamiento: «Vivra: Salud de perros y gatos» (30 caracteres), conservar un subtítulo orientado a carnet/vacunas y revisar keywords complementarias.

Las primeras capturas deben explicar beneficios concretos (historial a mano, vacunas organizadas, gastos claros) y mostrar la app real. No se modificó ni envió una nueva ficha a revisión.

Fuente: https://appstoreconnect.apple.com/apps/6761087142/analytics

Referencias: https://developer.apple.com/app-store/product-page/ y https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links

## Enlaces para futuras publicaciones

Estos enlaces abren la landing y etiquetan la fuente. El sistema propio actual todavía no persiste esas etiquetas y Vercel limita su informe en el plan actual: usarlos prepara campañas, pero por sí solos no completan la atribución a registro.

- Threads: https://vivrapet.com/?utm_source=threads&utm_medium=social&utm_campaign=organico_202609&utm_content=post_01
- X: https://vivrapet.com/?utm_source=x&utm_medium=social&utm_campaign=organico_202609&utm_content=post_01
- Facebook: https://vivrapet.com/?utm_source=facebook&utm_medium=social&utm_campaign=organico_202609&utm_content=post_01

Cambiar `utm_content` por publicación y usar etiquetas distintas para enlace en bio y comentarios. Para links directos a App Store, generar campañas en App Store Connect: Apple aplica umbrales de privacidad (normalmente al menos cinco usuarios de primeras descargas para que aparezca una campaña). Con este volumen, ausencia de desglose no significa cero resultados.

## Orden de trabajo recomendado

1. Completar medición de fuente → registro confirmado y un informe de adquisición en `/admin`, utilizando la infraestructura existente. Hacer una prueba identificable de extremo a extremo antes de interpretar tasas.
2. Mejorar descubrimiento del blog y añadir CTA hacia registro/descarga. Confirmar en Search Console que Google puede leer los artículos.
3. Etiquetar cada publicación en redes y comparar cuentas confirmadas/primera mascota por fuente, no solo visitas. Excluir pruebas conocidas.
4. Ajustar ficha ASO en la próxima versión y medir períodos comparables. El tamaño de la muestra actual no justifica conclusiones firmes ni un experimento A/B fragmentado.

Cambios realizados en esta revisión: verificación de Search Console, TXT DNS adicional y envío del sitemap. No se cambió el código de la aplicación, no se desplegó una versión, no se compraron planes ni se publicó en redes. Este documento conserva el diagnóstico; la instrumentación propuesta sigue pendiente.
