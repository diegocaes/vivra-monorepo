# Vivra: decisión sobre Soro, landing y redes

Revisión del 19 de septiembre de 2026. Complementa `acquisition-audit-2026-09-18.md` con acceso a Soro, revisión de artículos, registro público, App Store y prueba en vivo de Search Console.

## Decisión recomendada

No montar Make/n8n ni publicar automáticamente cada día todavía. No ampliar Soro al plan anual. Primero corregir descubrimiento del contenido y atribución, mejorar tres artículos orientados a la utilidad real de Vivra y probar distribución manual con un coste acotado. La rentabilidad actual de Soro no está demostrada.

## Qué significa la captura de Soro

| Indicador | Qué demuestra y qué no |
| --- | --- |
| Soro Impact 7.9K | La propia interfaz dice «potential traffic from keywords»: una estimación de oportunidad, no visitas obtenidas ni ingresos. No se verificó su fórmula, país, fuente de volumen o supuestos de posición/CTR. |
| Visitors 2 | Tráfico desde Google reportado por Soro. Coincide numéricamente con los dos clics de Search Console, pero no demuestra dos personas identificadas ni que un artículo los haya generado. |
| Impressions 60 | Apariciones en Google, no entradas a la web. La auditoría previa mostraba 61 en Search Console; diferencias de fecha/actualización son posibles y no se determinó su causa exacta. |
| Click rate 3.3% | Aproximadamente 2 clics / 60 impresiones. |
| Avg. position 6.1 | Promedio sobre las consultas/impresiones observadas, no posición general para todas las búsquedas de mascotas. |
| Ranking Level 10 / velocidad 92 | Indicadores del producto; no equivalen a demanda, indexación, ventas o posición 10 en Google. |
| Crecimiento +100% | Con una base diminuta, el porcentaje no permite juzgar éxito comercial. No se comprobó cómo Soro calcula el porcentaje cuando el período anterior es cero. |

La captura atribuye dos clics a `/` y cero a `/privacy`; no acredita adquisición desde los artículos. No permite demostrar causalmente que Soro generara ni siquiera los dos clics de portada.

## Hallazgos confirmados en Soro

- Precio de la cuenta: US$39 mensuales. Renovación indicada: 26 de septiembre de 2026. Facturas visibles de US$39 el 12 de julio y el 26 de agosto. No se modificó la suscripción.
- Integración activa: Blog Widget, el mismo script que usa `apps/web/src/pages/blog.astro`. Publicación automática activa.
- 35 artículos mostrados; no faltaba producción de texto. Soro propone más temas automáticamente y muestra volúmenes aproximados que no se validaron con otra fuente.
- Brand DNA entiende que Vivra es para perros y gatos, tiene web/iPhone y modelo freemium. El área de servicio y «Topics to Avoid» están vacíos.
- Hay temas cercanos al producto (registrar vacunas, gastos, compartir cuidados) y otros que pueden atraer intención distinta (nutrición personalizada, posoperatorios, síntomas, «veterinaria digital»). No conviene optimizar solo por volumen estimado.

## Descubrimiento e indexación: evidencia nueva

Se inspeccionó la URL real del artículo publicado el 12 de julio:

https://vivrapet.com/blog?post=carnet-de-vacunas-digital-mascota

Search Console informó «Google no reconoce esta URL», sin último rastreo, sitemap ni página de referencia detectados. La prueba en vivo del 19 de septiembre informó «La URL está disponible para Google» y «La página se puede indexar». El HTML mostrado por Google incluía el título específico y la descripción del artículo. Se solicitó indexación y Google confirmó que añadió la URL a su cola prioritaria. Eso NO significa que ya esté indexada ni que vaya a posicionarse.

Esta prueba evita una conclusión incorrecta: JavaScript no hace automáticamente invisible a Soro. Google pudo ejecutar al menos la parte que actualiza los metadatos. No se consiguió exportar el HTML completo de esa prueba y no se verificó íntegramente su cuerpo renderizado. El problema demostrado para este artículo era falta de descubrimiento, no un bloqueo HTTP ni una penalización por mala calidad.

El sitemap actual contiene seis URLs y no el blog ni sus artículos. Recomendación: enlazado HTML rastreable, sitemap de todos los artículos publicados y metadatos únicos. Servir los artículos desde Astro con contenido inicial completo reduciría dependencia del widget, pero requiere una fuente de contenido soportada (exportación, API o webhook), no asumir que Soro dispone de ella.

Fuente técnica: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

## Calidad del contenido revisado

Se revisaron el artículo de facturas de la auditoría anterior y los artículos de carnet digital y mejores apps para gatos.

El de carnet digital trata un problema adecuado para Vivra y explica límites razonables del registro digital. Sin embargo, no muestra pasos concretos dentro de Vivra ni capturas de su flujo de vacunas; tampoco ofrece enlace de registro/descarga. Puede convertirse en una guía más útil sin reemplazarlo entero.

«Mejores apps para cuidar gatos» promete una comparación. El cuerpo describe categorías, pero solo identifica Vivra; no compara alternativas concretas, precios, compatibilidad o criterios de prueba. Propuesta: renombrarlo como guía para elegir una app o escribir una comparación real y comprobada. No inventar rankings ni ventajas.

En los artículos revisados, el encabezado ofrece Iniciar sesión; no hay un CTA claro hacia Crear cuenta o App Store dentro del artículo. Mencionar Vivra en un párrafo no sustituye ese siguiente paso.

Primeros tres artículos a mejorar:

1. Carnet digital: cómo registrar una vacuna en Vivra, capturas reales y CTA «Crear el carnet de mi mascota».
2. Gastos: ejemplo realista de cómo registrar y consultar gastos, delimitando lo gratis y Premium; CTA hacia el registro.
3. Cuidado compartido: mostrar qué puede ver el co-dueño, aclarar Premium y evitar prometer acceso gratuito a esa función.

## Landing y registro

El enlace Empezar gratis abrió el formulario de registro. El enlace de descarga abrió la ficha correcta de App Store. No se completó un alta de prueba ni se validó recepción de correo/OAuth/dispositivo en esta revisión. No se ha demostrado un fallo técnico que impida todas las altas o descargas; los datos previos muestran ambas.

Cambios de conversión recomendados, como hipótesis a medir:

| Observación | Cambio concreto |
| --- | --- |
| «Todo lo de tu mascota, en un solo lugar» es amplio. | Probar «Vacunas e historial de tu mascota, siempre a mano», seguido de una demostración real del registro. |
| «Empezar gratis» no explica si abre web o instala app. | «Crear cuenta gratis en la web» y «Descargar para iPhone». Mantener ambas opciones visibles. |
| El primer bloque de funciones destaca el Indicador de Bienestar. | Priorizar vacuna, historial y gastos; presentar el indicador como una función secundaria. |
| No hay demostración interactiva o recorrido corto antes del alta. | Mostrar un ejemplo de perfil con datos ficticios o un vídeo breve real. No inventar testimonios ni cifras de usuarios. |
| El código de referido aparece antes de Google/email. | Colocarlo bajo una opción «Tengo un código», conservando códigos válidos que lleguen por enlace. |
| Email exige contraseña y repetición; luego confirmación de correo. | Medir abandono en cada paso. Evaluar simplificación sin eliminar validaciones o seguridad por intuición. |
| «Pasaporte tipo documento oficial» puede crear expectativas equivocadas. | Describirlo como resumen imprimible de registros y aclarar que no sustituye documentos oficiales requeridos. |
| Tres promesas distintas de tiempo: 30 segundos, menos de 1 minuto y 2 minutos. | Distinguir duración del alta de la carga de información y evitar promesas no medidas. |

La inspección visual efectiva fue de escritorio. La herramienta no aplicó de forma verificable el tamaño solicitado para la captura móvil; no se presenta esta revisión como una prueba real en iPhone/Android.

## App Store

La ficha pública consultada en la tienda de EE.UU. abre correctamente. Muestra:

- «Vivra: Salud de tu Perro», pese a que el producto también atiende gatos.
- Idioma English, aunque la descripción y la app se presentan en español. Revisar declaraciones de localización del binario para la próxima versión; traducir la descripción de tienda no equivale a declarar idiomas de la app.
- Compatibilidad iOS 15.1+, frente a iOS 16+ en la landing. Alinear información comprobada.
- No hay suficientes valoraciones para mostrar un resumen en esa tienda. Esto no demuestra ausencia de valoraciones en todas las regiones.

Son inconsistencias corregibles y posibles fricciones; no hay evidencia para asignarles una tasa concreta de abandono.

Fuente: https://apps.apple.com/us/app/vivra-salud-de-tu-perro/id6761087142

## Qué pedir a Soro antes de renovar

Solicitar una respuesta concreta sobre sitemap del widget, enlaces rastreables, exportación/API/webhook, permanencia de artículos al cancelar y metodología del tráfico potencial. El soporte no fue contactado.

Texto preparado:

> Uso Soro con el Blog Widget en vivrapet.com/blog y tengo 35 artículos publicados. Search Console solo mostraba indexadas la portada y privacidad. El artículo https://vivrapet.com/blog?post=carnet-de-vacunas-digital-mascota, publicado el 12 de julio, aparecía el 19 de septiembre como «Google no reconoce esta URL», sin rastreo ni sitemap de referencia. La prueba en vivo sí lo considera indexable. Mi sitemap no incluye los artículos. ¿Cómo genera vuestro widget un sitemap y facilita el descubrimiento de cada artículo? ¿Disponéis de exportación, API o webhook para servirlos con Astro? ¿Qué pasa con el contenido y sus URLs si cancelo la suscripción? También necesito la fuente, el país, la fecha y la fórmula de «7.9K potential traffic»: las métricas reales muestran dos clics a la portada, no tráfico a los artículos. Quiero resolver estos puntos antes de renovar el 26 de septiembre.

Recomendación comercial: no renovar automáticamente sin evaluar la respuesta y tener control del contenido. Si no hay una solución práctica, exportar/migrar primero y cancelar la renovación. No desconectar el widget sin saber si desaparecerán los artículos. Una mejora técnica no garantiza retorno SEO antes del 26 de septiembre.

## Prueba de redes antes de automatizar

Usar inicialmente la cuenta donde el fundador ya participa. Si hay que escoger una plataforma para empezar desde la situación observada, probar Threads; el clic previo confirma que el camino funciona, pero UNA visita no demuestra que rinda mejor que X. No abrir dos frentes de contenido a la vez.

Prueba propuesta de cuatro semanas, US$0 en anuncios/automatización y máximo dos horas semanales. Doce publicaciones en total (tres por semana), cada una con un ejemplo propio y enlace UTM único. Temas: vacuna registrada, gasto ordenado y cuidado entre dos personas. Conversar con usuarios que realmente tienen mascotas y problemas de organización; no publicar enlaces repetitivos de forma masiva.

Antes de empezar: atribución persistida y eventos de registro/primera mascota funcionando. Métrica principal: usuarios nuevos que crean su primera mascota, más retención posterior; secundarias: visitas de campaña y cuentas confirmadas. Medir pagos después, sin llamar «retorno» a un like o a una impresión.

Reglas propuestas de decisión, no umbrales estadísticos universales:

- Sin visitas tras las 12 publicaciones: cambiar audiencia, mensaje o canal; aumentar frecuencia automáticamente no resuelve esa señal.
- Con visitas pero sin clics: comprobar correspondencia entre el post y la landing, además de si se entiende qué ofrece Vivra.
- Con clics y sin cuentas: revisar formulario, errores, Google y correo de confirmación.
- Con cuentas pero sin primera mascota: revisar la bienvenida y el esfuerzo inicial.
- Con usuarios activados y que regresan: repetir el formato ganador; automatizar solo programación de contenido revisado si ahorra trabajo real.
- La prueba permite decidir si continuar; no garantiza rentabilidad ni probar ausencia de mercado con una muestra pequeña.

No se creó una cuenta social, no se publicó contenido ni se instaló Make/n8n.

## Secuencia de implementación

1. Medición propia de fuente, campaña, ubicación de CTA, alta confirmada y primera mascota, sin datos sensibles ni texto de formularios. Filtrar pruebas y mostrar errores de medición en vez de ceros engañosos.
2. Sitemap de artículos, enlaces rastreables, CTA en blog y resolver la dependencia de Soro según opciones reales de exportación/integración.
3. Ajustar mensaje, opciones web/iPhone y referido opcional; comprobar registro y correo con cuenta de prueba autorizada.
4. Preparar y ejecutar la prueba manual de redes. Medir usuarios activados y retención antes de sumar servicios de automatización.

Acción externa completada en esta revisión: solicitud de indexación del artículo del carnet digital, confirmada por Google. El resto son recomendaciones preparadas; no se modificó producción, configuración de Soro ni suscripción.
