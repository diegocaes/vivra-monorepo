-- Keep the existing vaccine history intact while allowing a user to copy the
-- exact product details printed on a veterinary card. Both values are optional
-- because historical records and some providers do not include them.
alter table public.vaccines
  add column if not exists brand text,
  add column if not exists lot_number text;

comment on column public.vaccines.brand is
  'Manufacturer or product brand shown on the veterinary vaccination card.';
comment on column public.vaccines.lot_number is
  'Batch or lot number shown on the veterinary vaccination card.';
