import { describe, expect, it } from 'vitest';
import { onboardingSteps, validateOnboarding } from './onboarding';

const draft = { name: 'Tinto', species: 'dog' as const, birthDate: '', weightKg: '' };

describe('onboarding', () => {
  it('requires a name and species but permits unknown optional details', () => {
    expect(validateOnboarding(draft).error).toBe('');
    expect(validateOnboarding({ ...draft, name: '   ' }).error).not.toBe('');
    expect(validateOnboarding({ ...draft, species: null }).error).not.toBe('');
  });

  it('skips dog breeds for cats while retaining the rest of the flow', () => {
    expect(onboardingSteps('cat')).toEqual(['species', 'name', 'gender', 'birthDate', 'weight', 'photo']);
    expect(onboardingSteps('dog')).toContain('breed');
  });

  it('accepts Spanish decimal commas without truncating the weight', () => {
    expect(validateOnboarding({ ...draft, weightKg: '6,5' }).weight).toBe(6.5);
    expect(validateOnboarding({ ...draft, weightKg: '6.5' }).weight).toBe(6.5);
    expect(validateOnboarding(draft).weight).toBeNull();
  });

  it.each(['0', '-2', '151', '6kg', '6,2,1', 'Infinity', '1e2'])('rejects invalid weight %s instead of storing a partial number', weightKg => {
    expect(validateOnboarding({ ...draft, weightKg }, 'weight').error).not.toBe('');
  });

  it('validates calendar dates and rejects future birthdays', () => {
    const today = new Date(2026, 8, 13);
    expect(validateOnboarding({ ...draft, birthDate: '2026-09-13' }, 'birthDate', today).error).toBe('');
    expect(validateOnboarding({ ...draft, birthDate: '2024-02-29' }, 'birthDate', today).error).toBe('');
    for (const birthDate of ['2026-09-14', '2026-02-29', '2026-13-01', 'bad']) {
      expect(validateOnboarding({ ...draft, birthDate }, 'birthDate', today).error).not.toBe('');
    }
  });
});
