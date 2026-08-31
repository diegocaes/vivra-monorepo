export type VaccineSpecies = 'dog' | 'cat';

export interface VaccineOption {
  key: string;
  label: string;
}

export interface VaccineRecordLike {
  id: string;
  name: string;
  date_given: string;
  next_due: string | null;
}

export type VaccineScheduleStatus = 'overdue' | 'due_soon' | 'scheduled' | 'recorded';

export interface VaccineOverview<T extends VaccineRecordLike> {
  /** Every saved application, newest first. */
  history: T[];
  /** Only the newest application of each vaccine that has a next date. */
  schedule: T[];
  latestByName: T[];
  overdueCount: number;
  dueSoonCount: number;
  scheduledCount: number;
}

// These are familiar vaccine *types*, not medical schedules or product
// recommendations. The veterinarian, product label and local rules determine
// whether a dose is appropriate and when its next application is due.
const DOG_VACCINE_OPTIONS: VaccineOption[] = [
  { key: 'Rabia', label: 'Rabia' },
  { key: 'Múltiple canina (DHPP/DAPP)', label: 'Múltiple canina (DHPP/DAPP)' },
  { key: 'Leptospirosis', label: 'Leptospirosis' },
  { key: 'Bordetella', label: 'Bordetella' },
  { key: 'Influenza canina', label: 'Influenza canina' },
  { key: 'Lyme', label: 'Lyme' },
  { key: 'Otra', label: 'Otra / escrita en el carné' },
];

const CAT_VACCINE_OPTIONS: VaccineOption[] = [
  { key: 'Rabia', label: 'Rabia' },
  { key: 'Triple felina (FVRCP)', label: 'Triple felina (FVRCP)' },
  { key: 'Leucemia felina (FeLV)', label: 'Leucemia felina (FeLV)' },
  { key: 'Chlamydia felina', label: 'Chlamydia felina' },
  { key: 'Bordetella felina', label: 'Bordetella felina' },
  { key: 'Otra', label: 'Otra / escrita en el carné' },
];

// Familiar manufacturers/labs shown only as a data-entry shortcut. This is
// not a recommendation: the exact product must be copied from the physical
// vaccination card or confirmed with the veterinarian.
const VACCINE_BRAND_OPTIONS: VaccineOption[] = [
  { key: '', label: 'Sin especificar' },
  { key: 'MSD Animal Health / Nobivac', label: 'MSD Animal Health / Nobivac' },
  { key: 'Zoetis', label: 'Zoetis' },
  { key: 'Boehringer Ingelheim', label: 'Boehringer Ingelheim' },
  { key: 'Elanco', label: 'Elanco' },
  { key: 'Virbac', label: 'Virbac' },
  { key: 'Ceva', label: 'Ceva' },
  { key: 'HIPRA', label: 'HIPRA' },
  { key: 'Otra', label: 'Otra / escrita en el carné' },
];

export function vaccineOptionsForSpecies(species: string | null | undefined): VaccineOption[] {
  return species === 'cat' ? CAT_VACCINE_OPTIONS : DOG_VACCINE_OPTIONS;
}

export function vaccineBrandOptions(): VaccineOption[] {
  return VACCINE_BRAND_OPTIONS;
}

function normalizeVaccineName(name: string): string {
  return name.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysUntilDate(date: string, today = localDateKey(new Date())): number {
  const due = Date.parse(`${date}T00:00:00Z`);
  const base = Date.parse(`${today}T00:00:00Z`);
  return Math.round((due - base) / 86_400_000);
}

export function vaccineScheduleStatus(
  vaccine: Pick<VaccineRecordLike, 'next_due'>,
  today = localDateKey(new Date()),
): VaccineScheduleStatus {
  if (!vaccine.next_due) return 'recorded';
  const days = daysUntilDate(vaccine.next_due, today);
  if (days < 0) return 'overdue';
  if (days <= 30) return 'due_soon';
  return 'scheduled';
}

/**
 * Builds the same vaccine view model for mobile and web.
 *
 * A pet can have several applications of the same vaccine. Only the newest
 * application may produce an actionable next-dose state; older applications
 * remain visible in the history but cannot create false overdue warnings.
 */
export function buildVaccineOverview<T extends VaccineRecordLike>(
  records: readonly T[],
  today = localDateKey(new Date()),
): VaccineOverview<T> {
  const history = [...records].sort((a, b) => {
    const byDate = b.date_given.localeCompare(a.date_given);
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
  });

  const latest = new Map<string, T>();
  for (const record of history) {
    const key = normalizeVaccineName(record.name);
    if (!latest.has(key)) latest.set(key, record);
  }

  const latestByName = [...latest.values()];
  const schedule = latestByName
    .filter(record => Boolean(record.next_due))
    .sort((a, b) => a.next_due!.localeCompare(b.next_due!));

  let overdueCount = 0;
  let dueSoonCount = 0;
  let scheduledCount = 0;
  for (const record of schedule) {
    const status = vaccineScheduleStatus(record, today);
    if (status === 'overdue') overdueCount += 1;
    else if (status === 'due_soon') dueSoonCount += 1;
    else scheduledCount += 1;
  }

  return { history, schedule, latestByName, overdueCount, dueSoonCount, scheduledCount };
}
