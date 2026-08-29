import { describe, expect, it } from 'vitest';
import { annualSavingsPercent, monthlyEquivalent, PREMIUM_PRICE_COPY } from './billing';

describe('Premium price copy', () => {
  it('matches the approved US App Store prices', () => {
    expect(PREMIUM_PRICE_COPY).toEqual({ currency: 'USD', monthly: 2.99, yearly: 19.99 });
  });

  it('derives the annual saving instead of hardcoding stale marketing copy', () => {
    expect(annualSavingsPercent()).toBe(44);
    expect(monthlyEquivalent()).toBe(1.67);
  });

  it('does not return misleading negative or invalid savings', () => {
    expect(annualSavingsPercent(0, 19.99)).toBe(0);
    expect(annualSavingsPercent(2.99, 99)).toBe(0);
  });
});
