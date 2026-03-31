// Vaccine badge lookup — delegates to the canonical VACCINE_BADGES in badges.ts
// to avoid duplicating the keyword/name/img data.

import { VACCINE_BADGES } from '@vivra/shared';

/** Devuelve la ruta del badge (o null si no hay imagen) y el label corto. */
export function getVaccineBadge(name: string): { src: string | null; label: string } {
  const lower = name.toLowerCase();
  const match = VACCINE_BADGES.find((v) => lower.includes(v.keyword));
  return {
    src: match ? `/badges/${match.img}` : null,
    label: match?.name ?? name,
  };
}
