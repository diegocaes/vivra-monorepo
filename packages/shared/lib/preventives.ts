export type PreventiveSpecies = string | null | undefined;

/** Adds calendar months to an ISO date without a timezone shift. */
export function addMonthsToDate(date: string, months: number): string {
  const value = new Date(`${date}T12:00:00`);
  const day = value.getDate();
  value.setDate(1);
  value.setMonth(value.getMonth() + months);
  const lastDay = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  value.setDate(Math.min(day, lastDay));
  return value.toISOString().slice(0, 10);
}

/**
 * Dogs in Vivra use the requested calendar-month preventive cadence. Existing
 * records without an explicit date retain their history and receive the same
 * derived date in the UI; cats always require an explicitly saved date.
 */
export function preventiveNextDue(
  species: PreventiveSpecies,
  dateGiven: string,
  nextDue: string | null | undefined,
): string | null {
  if (nextDue) return nextDue;
  return species === 'dog' ? addMonthsToDate(dateGiven, 1) : null;
}
