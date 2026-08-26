-- Performance: el costo real está en las políticas RLS, no en las consultas.
--
-- 1) `is_pet_owner` estaba marcada VOLATILE. Postgres no puede cachear ni
--    inlinear una función volátil dentro de un WHERE, así que la re-ejecuta
--    UNA VEZ POR FILA. Como la usan las políticas SELECT de foods, vaccines,
--    vet_visits, weight_records y groomings, cada consulta de esas tablas
--    dispara N ejecuciones, y cada ejecución escanea `pets` entera.
--    La función es un SELECT puro: STABLE es correcto y seguro.
--    Evidencia: pg_stat_user_tables mostraba 58.127 seq_scan sobre `pets`
--    (13 filas). Su hermana `user_can_access_pet` ya estaba STABLE.
ALTER FUNCTION public.is_pet_owner(uuid) STABLE;

-- 2) Índices faltantes en las dos consultas más calientes de la app.
--    `pets.user_id` lo usa getActivePet/usePet en CADA carga de página.
--    `foods.pet_id` lo usan dashboard, alimentación y el resumen de gastos.
CREATE INDEX IF NOT EXISTS idx_pets_user_id  ON public.pets(user_id);
CREATE INDEX IF NOT EXISTS idx_foods_pet_id  ON public.foods(pet_id);

-- 3) /admin filtra app_events por user_id para separar tu actividad.
CREATE INDEX IF NOT EXISTS idx_app_events_user_id ON public.app_events(user_id);

ANALYZE public.pets;
ANALYZE public.foods;
ANALYZE public.app_events;
