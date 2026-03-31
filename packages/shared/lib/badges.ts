// Badge system — engagement badges earned by using Vivra features.
// Each badge has an id, display info, and a condition evaluated from counts.

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  img: string;            // path under /badges/
  category: 'salud' | 'actividad' | 'perfil';
  condition: (c: BadgeCounts) => boolean;
}

export interface BadgeCounts {
  profileComplete: boolean;
  vaccineCount: number;
  visitCount: number;
  weightCount: number;
  adventureCount: number;
  flightCount: number;
  groomingCount: number;
  foodCount: number;
  hasAntipulgas: boolean;
  hasDesparasitante: boolean;
  /** Unique vaccine names registered (lowercased) */
  vaccineNames: string[];
}

export interface EarnedBadge extends BadgeDef {
  earned: boolean;
}

// ── ENGAGEMENT BADGES ──────────────────────────────────────
export const BADGES: BadgeDef[] = [
  // Perfil
  {
    id: 'perfil-completo',
    name: 'Perfil Completo',
    description: 'Completa todos los campos del perfil de tu mascota.',
    img: 'perfil-completo.png',
    category: 'perfil',
    condition: (c) => c.profileComplete,
  },
  // Salud
  {
    id: 'primera-vacuna',
    name: 'Primera Vacuna',
    description: 'Registra la primera vacuna de tu mascota.',
    img: 'primera-vacuna.png',
    category: 'salud',
    condition: (c) => c.vaccineCount >= 1,
  },
  {
    id: 'vacunas-al-dia',
    name: 'Vacunas al Día',
    description: 'Registra 3 o más vacunas diferentes.',
    img: 'vacunas-al-dia.png',
    category: 'salud',
    condition: (c) => c.vaccineCount >= 3,
  },
  {
    id: 'veterinario',
    name: 'Veterinario',
    description: 'Registra tu primera visita al veterinario.',
    img: 'veterinario.png',
    category: 'salud',
    condition: (c) => c.visitCount >= 1,
  },
  {
    id: 'preventivos-al-dia',
    name: 'Preventivos al Día',
    description: 'Registra antipulgas y desparasitante.',
    img: 'preventivos-al-dia.png',
    category: 'salud',
    condition: (c) => c.hasAntipulgas && c.hasDesparasitante,
  },
  {
    id: 'primer-peso',
    name: 'Primer Peso',
    description: 'Registra el primer peso de tu mascota.',
    img: 'primer-peso.png',
    category: 'salud',
    condition: (c) => c.weightCount >= 1,
  },
  {
    id: 'control-peso',
    name: 'Control de Peso',
    description: 'Registra 5 o más mediciones de peso.',
    img: 'control-peso.png',
    category: 'salud',
    condition: (c) => c.weightCount >= 5,
  },
  {
    id: 'grooming',
    name: 'Grooming',
    description: 'Registra la primera sesión de grooming.',
    img: 'grooming.png',
    category: 'salud',
    condition: (c) => c.groomingCount >= 1,
  },
  {
    id: 'nutricion',
    name: 'Nutrición',
    description: 'Registra el alimento de tu mascota.',
    img: 'nutricion.png',
    category: 'salud',
    condition: (c) => c.foodCount >= 1,
  },
  // Actividad
  {
    id: 'primer-vuelo',
    name: 'Primer Vuelo',
    description: 'Registra el primer vuelo de tu mascota.',
    img: 'primer-vuelo.png',
    category: 'actividad',
    condition: (c) => c.flightCount >= 1,
  },
];

// ── VACCINE-SPECIFIC BADGES ────────────────────────────────
// Each vaccine earns its own badge when registered
export const VACCINE_BADGES: { keyword: string; id: string; name: string; img: string }[] = [
  { keyword: 'rabia',      id: 'vac-rabia',      name: 'Rabia',         img: 'vacunas/rabia.png' },
  { keyword: 'parvo',      id: 'vac-parvo',      name: 'Parvovirus',    img: 'vacunas/parvo.png' },
  { keyword: 'moquillo',   id: 'vac-moquillo',   name: 'Moquillo',      img: 'vacunas/moquillo.png' },
  { keyword: 'bordetella', id: 'vac-bordetella', name: 'Bordetella',    img: 'vacunas/bordetella.png' },
  { keyword: 'lepto',      id: 'vac-lepto',      name: 'Leptospirosis', img: 'vacunas/lepto.png' },
  { keyword: 'hepatitis',  id: 'vac-hepatitis',  name: 'Hepatitis',     img: 'vacunas/hepatitis.png' },
];

// ── EVALUATE ───────────────────────────────────────────────
export interface BadgeResult {
  engagement: EarnedBadge[];
  vaccines: { id: string; name: string; img: string; earned: boolean }[];
  earnedCount: number;
  totalCount: number;
}

export function evaluateBadges(counts: BadgeCounts): BadgeResult {
  const engagement: EarnedBadge[] = BADGES.map((b) => ({
    ...b,
    earned: b.condition(counts),
  }));

  const vaccineNamesLower = counts.vaccineNames.map((n) => n.toLowerCase());
  const vaccines = VACCINE_BADGES.map((vb) => ({
    id: vb.id,
    name: vb.name,
    img: vb.img,
    earned: vaccineNamesLower.some((n) => n.includes(vb.keyword)),
  }));

  const earnedCount =
    engagement.filter((b) => b.earned).length +
    vaccines.filter((v) => v.earned).length;

  const totalCount = engagement.length + vaccines.length;

  return { engagement, vaccines, earnedCount, totalCount };
}
