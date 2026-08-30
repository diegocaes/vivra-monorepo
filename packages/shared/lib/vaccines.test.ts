import { describe, expect, it } from 'vitest';
import { buildVaccineOverview, daysUntilDate, vaccineScheduleStatus } from './vaccines';

const doses = [
  { id: 'new-rabies', name: 'Rabia', date_given: '2026-08-01', next_due: '2027-08-01' },
  { id: 'old-rabies', name: 'rabía', date_given: '2025-08-01', next_due: '2026-08-01' },
  { id: 'dhpp', name: 'Múltiple canina (DHPP/DAPP)', date_given: '2026-07-01', next_due: '2026-09-10' },
  { id: 'bordetella', name: 'Bordetella', date_given: '2026-06-01', next_due: null },
];

describe('vaccine overview', () => {
  it('keeps every dose in history but schedules only the latest dose by normalized name', () => {
    const overview = buildVaccineOverview(doses, '2026-08-29');

    expect(overview.history).toHaveLength(4);
    expect(overview.latestByName).toHaveLength(3);
    expect(overview.schedule.map(vaccine => vaccine.id)).toEqual(['dhpp', 'new-rabies']);
    expect(overview.overdueCount).toBe(0);
    expect(overview.dueSoonCount).toBe(1);
    expect(overview.scheduledCount).toBe(1);
  });

  it('uses calm, deterministic calendar states around today', () => {
    expect(vaccineScheduleStatus({ next_due: null }, '2026-08-29')).toBe('recorded');
    expect(vaccineScheduleStatus({ next_due: '2026-08-28' }, '2026-08-29')).toBe('overdue');
    expect(vaccineScheduleStatus({ next_due: '2026-08-29' }, '2026-08-29')).toBe('due_soon');
    expect(vaccineScheduleStatus({ next_due: '2026-09-28' }, '2026-08-29')).toBe('due_soon');
    expect(vaccineScheduleStatus({ next_due: '2026-09-29' }, '2026-08-29')).toBe('scheduled');
    expect(daysUntilDate('2026-08-28', '2026-08-29')).toBe(-1);
  });
});
