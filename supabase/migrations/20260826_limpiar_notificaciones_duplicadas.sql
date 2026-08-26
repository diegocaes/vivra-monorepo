-- Limpieza del spam que generó el bug de deduplicación del dashboard web.
--
-- Causa: el dashboard construía el set de "ya notificado" con la clave
-- `${type}::${message}` pero comparaba contra claves de otro formato
-- (`weight_reminder::${días}`, `vaccine_overdue::${nombre}`). Nunca coincidían,
-- así que CADA carga de /dashboard insertaba una notificación nueva.
-- Un usuario llegó a 30 avisos idénticos de peso en un solo día.
--
-- El código ya está arreglado (ventana de enfriamiento por mascota+tipo,
-- compartida con el cron de push). Esto solo limpia lo que quedó.

-- 1) Deja únicamente la notificación MÁS RECIENTE por (usuario, mascota, tipo,
--    mensaje). Se conserva una de cada una: nada de información se pierde.
DELETE FROM public.notifications n
USING public.notifications mas_nueva
WHERE n.user_id  IS NOT DISTINCT FROM mas_nueva.user_id
  AND n.pet_id   IS NOT DISTINCT FROM mas_nueva.pet_id
  AND n.type     =  mas_nueva.type
  AND n.message  IS NOT DISTINCT FROM mas_nueva.message
  AND n.created_at < mas_nueva.created_at;

-- 2) Tipos de funciones que ya no existen en el producto. Seguían apareciendo
--    en el buzón de usuarios reales.
DELETE FROM public.notifications
WHERE type IN ('badge_earned', 'activity_reminder', 'walk_reminder', 'adventure_reminder');

-- 3) El dashboard escribía `weight_reminder` y el cron `weight_stale` para lo
--    MISMO, así que no compartían enfriamiento y el usuario recibía los dos.
--    Se unifican al tipo del cron para que el historial quede coherente.
UPDATE public.notifications SET type = 'weight_stale' WHERE type = 'weight_reminder';

-- 4) La columna `icon` guardaba emojis. Ahora guarda un NOMBRE de icono que
--    dibujan <Icon> en la web e Ionicons en la app. Se normalizan las filas
--    viejas para que no queden con un emoji suelto en el buzón.
UPDATE public.notifications SET icon = CASE type
  WHEN 'vaccine_due'    THEN 'vacuna'
  WHEN 'preventive_due' THEN 'preventivo'
  WHEN 'weight_stale'   THEN 'peso'
  WHEN 'food_low'       THEN 'comida'
  WHEN 'birthday'       THEN 'cumpleanos'
  WHEN 're_engagement'  THEN 'mascota'
  WHEN 'score_improved' THEN 'score'
  ELSE 'campana'
END;

-- 5) Los títulos viejos traen emojis ("⚖️ Hora de pesar", "🐛 Antipulgas
--    próximo"). Se les quita el prefijo dejando el texto intacto.
UPDATE public.notifications
SET title = btrim(regexp_replace(title, '^[^[:alnum:]¿¡]+', '', 'g'))
WHERE title ~ '^[^[:alnum:]¿¡]';

-- Verificación: no debería quedar ningún duplicado ni ningún emoji.
SELECT type, count(*) AS filas, min(created_at)::date AS desde
FROM public.notifications
GROUP BY type
ORDER BY count(*) DESC;
