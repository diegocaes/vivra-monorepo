import { GROOMING_TYPES } from './constants';

/**
 * New records store every included service in `services`. `type` remains as
 * the primary service so installed app versions and historical rows continue
 * to work during rollout.
 */
export function normalizeGroomingServices(
  services: readonly unknown[] | null | undefined,
  legacyType?: string | null,
): string[] {
  const normalized = (services ?? [])
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean);
  if (normalized.length === 0 && legacyType?.trim()) normalized.push(legacyType.trim());
  return [...new Set(normalized)];
}

export function formatGroomingServices(
  services: readonly unknown[] | null | undefined,
  legacyType?: string | null,
): string {
  return normalizeGroomingServices(services, legacyType)
    .map(key => GROOMING_TYPES[key] ?? key)
    .join(' · ');
}
