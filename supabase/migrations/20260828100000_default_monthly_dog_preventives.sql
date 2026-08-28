-- This table predates reminder scheduling, so existing projects may not have
-- this column yet. A nullable date keeps cat cadence explicit.
alter table public.preventive_treatments
  add column if not exists next_due date;

-- Vivra's dog preventive policy is a calendar-month default. Backfill only
-- missing next_due values, keeping an explicitly recorded date untouched. Cat
-- records are deliberately excluded because their product cadence stays explicit.
update public.preventive_treatments as treatment
set next_due = treatment.date_given + interval '1 month'
from public.pets
where treatment.pet_id = pets.id
  and pets.species = 'dog'
  and treatment.next_due is null;
