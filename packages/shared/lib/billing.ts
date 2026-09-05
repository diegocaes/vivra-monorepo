/**
 * Public USD price copy used outside the native App Store purchase sheet.
 *
 * Apple and Paddle remain the billing sources of truth. Keep this copy aligned
 * with those dashboards so the landing page never advertises a different
 * amount from the checkout the customer actually sees.
 */
export const PREMIUM_PRICE_COPY = {
  currency: 'USD',
  monthly: 2.99,
  yearly: 19.99,
} as const;

export function annualSavingsPercent(
  monthly: number = PREMIUM_PRICE_COPY.monthly,
  yearly: number = PREMIUM_PRICE_COPY.yearly,
): number {
  if (!Number.isFinite(monthly) || !Number.isFinite(yearly) || monthly <= 0 || yearly < 0) {
    return 0;
  }
  return Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
}

export function monthlyEquivalent(
  yearly: number = PREMIUM_PRICE_COPY.yearly,
): number {
  if (!Number.isFinite(yearly) || yearly < 0) return 0;
  return Math.round((yearly / 12) * 100) / 100;
}
