-- Allow type='combinado' in preventive_treatments.
-- 'combinado' = a single product/dose that acts as BOTH antipulgas and desparasitante
-- (e.g. NexGard Spectra, Simparica Trio). A combinado row counts as "last dose"
-- for BOTH antipulgas and desparasitante when we compute next-due.

-- Drop the existing CHECK constraint on type (Supabase auto-names it `*_type_check`).
ALTER TABLE preventive_treatments
  DROP CONSTRAINT IF EXISTS preventive_treatments_type_check;

-- Add the broadened CHECK allowing 'combinado'.
ALTER TABLE preventive_treatments
  ADD CONSTRAINT preventive_treatments_type_check
  CHECK (type IN ('antipulgas', 'desparasitante', 'combinado'));
