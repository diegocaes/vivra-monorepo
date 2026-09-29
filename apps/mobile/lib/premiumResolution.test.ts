import { describe, expect, it } from 'vitest';
import { resolvePremiumAccess } from './premiumResolution';

const active = async () => true;
const inactive = async () => false;
const unavailable = async () => { throw new Error('Offline'); };

describe('effective Premium access', () => {
  it('preserves web Premium when Apple restoration has no entitlement', async () => {
    expect(await resolvePremiumAccess([inactive, active, inactive])).toBe(true);
  });
  it('recognizes shared Premium despite an Apple service failure', async () => {
    expect(await resolvePremiumAccess([unavailable, inactive, active])).toBe(true);
  });
  it('does not treat a failed server lookup as a free subscription', async () => {
    expect(await resolvePremiumAccess([inactive, unavailable, inactive])).toBeNull();
  });
  it('confirms free access only when all sources responded without entitlement', async () => {
    expect(await resolvePremiumAccess([inactive, inactive, inactive])).toBe(false);
  });
});
