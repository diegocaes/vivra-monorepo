import { describe, expect, it } from 'vitest';
import { addMonthsToDate, preventiveNextDue } from './preventives';

describe('preventive next due', () => {
  it('uses a calendar-month default for dogs without a saved date', () => {
    expect(preventiveNextDue('dog', '2026-08-17', null)).toBe('2026-09-17');
  });

  it('preserves an explicit date and never infers a cat schedule', () => {
    expect(preventiveNextDue('dog', '2026-08-01', '2026-09-15')).toBe('2026-09-15');
    expect(preventiveNextDue('cat', '2026-08-01', null)).toBeNull();
  });

  it('keeps a valid month-end day', () => {
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28');
  });
});
