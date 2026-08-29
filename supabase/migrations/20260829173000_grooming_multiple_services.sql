-- A grooming appointment may include several services under one total cost
-- (for example bath + nail trim). Keep `type` as the primary service for old
-- app versions and backfill every existing record without changing its data.

BEGIN;

ALTER TABLE public.groomings
  ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE public.groomings
SET services = ARRAY[type]
WHERE COALESCE(cardinality(services), 0) = 0
  AND type IS NOT NULL
  AND BTRIM(type) <> '';

COMMIT;
