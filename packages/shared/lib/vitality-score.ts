/**
 * Vivra Vitality Score Engine
 *
 * Modelo propietario de salud canina — 4 pilares, 0–100 puntos.
 *
 * Fundamentación científica: docs/vitality-score-research.md
 *
 * Pilares (cada uno 25 pts, total 100):
 *  P1: Peso corporal — WSAVA BCS, VetCompass/Pegram 2021
 *  P2: Cuidado preventivo — GeroScience 2024, AVMA
 *  P3: Raza + Edad — Gough/Thomas, Cornell, Nature 2023
 *  P5: Nutrición — registro y trazabilidad del alimento (NO juzga la porción:
 *      la ración correcta la define el vet/nutricionista, no este score)
 *
 * Cada función `scoreXxx` calcula sobre 20 pts internos por compatibilidad
 * histórica. Al final, `calculateVitalityScore` escala 20→25 (×1.25) para
 * mantener el total en 0–100 después de eliminar el pilar de actividad.
 *
 * PRINCIPIOS DE DISEÑO:
 *  - Nunca mostrar score hasta tener suficientes datos (mínimo 2 pilares calculables)
 *  - Tono siempre positivo y de recomendación, nunca alarmante
 *  - Flags máximo severidad "naranja" cuando no hay historial suficiente
 *  - Siempre aclarar que no es diagnóstico médico
 */

import { getSpeciesProfile } from './breed-data';

// ─── Tipos de entrada ───────────────────────────────────────────────────────

export interface PetData {
  /** 'dog' | 'cat' — los gatos usan perfil felino genérico, sin razas */
  species?: string | null;
  breed: string | null;
  birth_date: string | null;   // ISO date: "2020-05-15"
  weight_kg: number | null;
  gender: string | null;       // 'macho' | 'hembra'
  is_neutered: boolean | null;
}

export interface WeightRecord {
  weight_kg: number;
  date: string; // ISO date
}

export interface VaccineRecord {
  name: string;
  date_given: string; // ISO date
}

export interface VetVisit {
  date: string; // ISO date — column name in vet_visits table
}

export interface GroomingRecord {
  date: string; // ISO date
}

export interface FoodRecord {
  brand: string | null;
  daily_grams: number | null;
  bag_size: number | null;
  bag_unit: string | null; // 'g' | 'kg' | 'lb'
  type: string | null;     // column name in foods table
  /** ISO date — cuándo se empezó a usar este alimento (user-entered) */
  start_date?: string | null;
  /** ISO date — cuándo se acabó la bolsa (set automáticamente al registrar
   *  la siguiente, editable manualmente). Si está set, el "log" no se considera
   *  stale: el dueño cerró formalmente esta bolsa. */
  end_date?: string | null;
  /** ISO timestamp — cuándo se registró en la app (auto) */
  created_at?: string | null;
}

export interface BloodTestRecord {
  date: string; // ISO date
}

export interface PreventiveRecord {
  type: 'antipulgas' | 'desparasitante' | 'combinado';
  date_given: string; // ISO date
}

export interface ScoreInput {
  pet: PetData;
  weightRecords: WeightRecord[];
  vaccines: VaccineRecord[];
  vetVisits: VetVisit[];
  groomings: GroomingRecord[];
  foods: FoodRecord[];
  bloodTests?: BloodTestRecord[];
  /** Registros de antipulgas/desparasitante/combinado. 'combinado' cuenta como ambos. */
  preventives?: PreventiveRecord[];
}

// ─── Tipos de salida ─────────────────────────────────────────────────────────

export type ScoreCategory = 'excellent' | 'good' | 'fair' | 'attention' | 'building';

/** Estado de datos disponibles para calcular el score */
export type DataSufficiency =
  | 'ready'        // suficientes datos para un score significativo
  | 'building'     // datos en recolección — score estimado parcial
  | 'too_early';   // demasiado pronto para mostrar score (< 2 pilares)

export type PillarId = 'peso' | 'cuidado' | 'raza' | 'nutricion';

export interface PillarScore {
  id: PillarId;
  name: string;
  score: number;
  max: number;
  pct: number;
  status: string;
  /** Breve descripción del pilar — qué mide y por qué importa */
  description: string;
  /** Sugerencias — siempre en tono de ayuda, nunca alarmante */
  tips: string[];
  /** true si este pilar no tiene datos suficientes para calcularse */
  isEstimated: boolean;
}

export interface ScoreFlag {
  id: string;
  /** 'tip' = amarillo suave, 'suggestion' = naranja, 'reminder' = azul */
  severity: 'tip' | 'suggestion' | 'reminder';
  message: string;
  action: string;
  href: string;
}

export interface PendingArea {
  label: string;   // ej. "Agrega su peso"
  href: string;    // ruta a donde ir
}

export interface VitalityScoreResult {
  /** Score total 0–100 */
  total: number;
  /** true = hay suficientes datos para mostrar el número; false = mostrar estado "completando" */
  showScore: boolean;
  /** Categoría cualitativa */
  category: ScoreCategory;
  /** Color hex del indicador */
  color: string;
  /** Mensaje principal — siempre friendly */
  headline: string;
  /** Sub-mensaje — contexto o siguiente paso */
  subline: string;
  /** Desglose por pilares */
  pillars: PillarScore[];
  /** Sugerencias activas */
  flags: ScoreFlag[];
  /** Estado de suficiencia de datos */
  dataSufficiency: DataSufficiency;
  /** Cuántos pilares tienen datos reales (no estimados) */
  pilarsWithData: number;
  /** Cuántos datos más faltan para score completo */
  missingDataCount: number;
  /** Áreas pendientes con CTA — solo cuando showScore = false */
  pendingAreas: PendingArea[];
  /** Edad calculada en años */
  ageYears: number | null;
  /** Si es considerado senior según raza */
  isSenior: boolean;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

function daysBetween(dateA: string, dateB: Date = new Date()): number {
  const a = new Date(dateA);
  if (Number.isNaN(a.getTime())) return 0;
  return Math.floor((dateB.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function ageInYears(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const years = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  return m < 0 || (m === 0 && today.getDate() < birth.getDate()) ? years - 1 : years;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Perfil según especie — gatos usan el perfil felino genérico */
function profileFor(pet: PetData) {
  return getSpeciesProfile(pet.species, pet.breed);
}

/** Senior según especie/raza */
function isSeniorPet(pet: PetData, ageYears: number): boolean {
  return ageYears >= profileFor(pet).seniorAgeYears;
}

/** Vacunas core según AVMA/WSAVA */
const CORE_VACCINE_KEYWORDS = ['rabia', 'rabies', 'parvovirus', 'parvo', 'moquillo', 'distemper', 'adenovirus', 'hepatitis'];

function isCoreVaccine(name: string): boolean {
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return CORE_VACCINE_KEYWORDS.some(v => n.includes(v));
}

// ─── Descripciones de pilares (para tooltips) ───────────────────────────────

const PILLAR_DESC = {
  peso: 'Compara el peso actual con el rango ideal de la raza. Un peso saludable reduce riesgos articulares y metabólicos.',
  cuidado: 'Evalúa vacunas, visitas al veterinario, antipulgas/desparasitante y exámenes de sangre. La prevención es la base de una vida larga.',
  raza: 'Factores genéticos y de edad que influyen en la salud. Cada raza tiene predisposiciones específicas.',
  nutricion: 'Refleja si llevas el registro del alimento al día: marca, tipo y ración. Tener esta información organizada ayuda a tu veterinario. No evalúa si la porción es la correcta — esa la define tu vet o nutricionista.',
} as const;

// ─── Pilar 1: Peso Corporal ──────────────────────────────────────────────────

function scorePeso(input: ScoreInput): PillarScore {
  const { pet, weightRecords } = input;
  const breed = profileFor(pet);
  const tips: string[] = [];

  // Cachorros < 1 año: no evaluar peso ideal (están creciendo)
  const petAge = ageInYears(pet.birth_date);
  if (petAge !== null && petAge < 1) {
    return {
      name: 'Peso', id: 'peso' as PillarId, score: 10, max: 20, pct: 50,
      status: 'En crecimiento', description: PILLAR_DESC.peso,
      tips: ['Los cachorros están en fase de crecimiento — el peso ideal se evalúa a partir del año'],
      isEstimated: true,
    };
  }

  const latestWeight = weightRecords[0]?.weight_kg ?? pet.weight_kg;
  const lastWeightDate = weightRecords[0]?.date ?? null;
  const daysSinceWeight = lastWeightDate ? daysBetween(lastWeightDate) : null;
  // "Onboarding-only" = tenemos pet.weight_kg pero ningún weight_record.
  // No sabemos si ese peso sigue siendo vigente, así que lo tratamos como estimado.
  const isOnboardingOnlyWeight = weightRecords.length === 0 && !!pet.weight_kg;

  if (!latestWeight) {
    return {
      name: 'Peso', id: 'peso' as PillarId, score: 4, max: 20, pct: 20,
      status: 'Pendiente de registro', description: PILLAR_DESC.peso,
      tips: ['Registrar el peso regularmente ayuda a detectar cambios a tiempo'],
      isEstimated: true,
    };
  }

  const ideal = (breed.idealWeightKgMin + breed.idealWeightKgMax) / 2;
  const desvPct = Math.abs((latestWeight - ideal) / ideal) * 100;

  let pts: number;
  if (desvPct <= 5) {
    pts = 20;
  } else if (desvPct <= 10) {
    pts = Math.max(14, 20 - Math.floor((desvPct - 5) * 1.2));
  } else if (desvPct <= 20) {
    pts = Math.max(6, 14 - Math.floor((desvPct - 10) * 0.8));
  } else {
    pts = Math.max(2, 6 - Math.floor((desvPct - 20) * 0.3));
  }

  // Bono/penalización por tendencia — solo si hay historial
  if (weightRecords.length >= 2) {
    const prev = weightRecords[1].weight_kg;
    const diff = latestWeight - prev;
    const isOver = latestWeight > breed.idealWeightKgMax;
    const isUnder = latestWeight < breed.idealWeightKgMin;

    if (isOver && diff > 0) {
      pts = Math.max(2, pts - 2);
      tips.push('Su peso está aumentando un poco — revisar las porciones puede ayudar');
    } else if (isOver && diff < 0) {
      pts = Math.min(20, pts + 1); // bajando desde sobrepeso, positivo
    } else if (isUnder && diff < 0) {
      pts = Math.max(2, pts - 2);
      tips.push('Se nota una ligera pérdida de peso — vale la pena comentárselo al vet en la próxima visita');
    }
  }

  const isOver = latestWeight > breed.idealWeightKgMax;
  const isUnder = latestWeight < breed.idealWeightKgMin;

  // Penalizar si el último registro tiene más de 45 días
  if (daysSinceWeight !== null && daysSinceWeight > 45) {
    pts = Math.max(2, pts - 3);
    tips.push('Actualizar el peso ayuda a detectar cambios a tiempo — el último registro tiene más de un mes');
  }

  let status: string;
  if (desvPct <= 5) {
    status = `Peso ideal · ${latestWeight} kg`;
  } else if (isOver) {
    status = `Algo por encima del rango ideal · ${latestWeight} kg`;
    tips.push(`El rango recomendado para ${breed.displayName} es ${breed.idealWeightKgMin}–${breed.idealWeightKgMax} kg`);
  } else if (isUnder) {
    status = `Algo por debajo del rango ideal · ${latestWeight} kg`;
    tips.push(`El rango recomendado para ${breed.displayName} es ${breed.idealWeightKgMin}–${breed.idealWeightKgMax} kg`);
  } else {
    status = `Buen peso · ${latestWeight} kg`;
  }

  // Si solo tenemos el peso de onboarding, no podemos medir tendencia ni frescura.
  // Tope a 14/20 y lo marcamos como estimado para que la UI lo distinga.
  if (isOnboardingOnlyWeight) {
    pts = Math.min(pts, 14);
    tips.push('Registra el peso actual para afinar el análisis — el que tenemos es del registro inicial');
  }

  return {
    name: 'Peso', id: 'peso' as PillarId,
    score: clamp(pts, 2, 20), max: 20, pct: clamp(pts * 5, 10, 100),
    status, description: PILLAR_DESC.peso, tips: tips.slice(0, 2),
    isEstimated: isOnboardingOnlyWeight,
  };
}

// ─── Pilar 2: Cuidado Preventivo ─────────────────────────────────────────────

function scoreCuidado(input: ScoreInput): PillarScore {
  const { vaccines, vetVisits } = input;
  const preventives = input.preventives ?? [];
  const tips: string[] = [];
  const hasAnyData = vaccines.length > 0 || vetVisits.length > 0 || preventives.length > 0;

  if (!hasAnyData) {
    return {
      name: 'Cuidado preventivo', id: 'cuidado' as PillarId, score: 4, max: 20, pct: 20,
      status: 'Pendiente de registro', description: PILLAR_DESC.cuidado,
      tips: ['Agrega vacunas, antipulgas y visitas al vet para completar este indicador'],
      isEstimated: true,
    };
  }

  // Budget: vaccines 8 · vet 8 · preventives 4 · blood test bonus up to +2 → cap 20
  // Sub-score vacunas (8 pts)
  let vaccineScore = 0;
  if (vaccines.length === 0) {
    vaccineScore = 2;
    tips.push('Registra las vacunas para monitorear el calendario de inmunización');
  } else {
    const coreNames = ['rabia', 'parvovirus', 'moquillo', 'adenovirus'];
    const coveredCore = coreNames.filter(core =>
      vaccines.some(v => isCoreVaccine(v.name) &&
        v.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .includes(core.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      )
    ).length;

    vaccineScore = Math.max(2, Math.round((coveredCore / coreNames.length) * 6));

    const anyRecent = vaccines.some(v => daysBetween(v.date_given) < 365);
    const anyInLast18Months = vaccines.some(v => daysBetween(v.date_given) < 550);
    if (anyRecent) {
      vaccineScore = Math.min(8, vaccineScore + 2);
    } else if (!anyInLast18Months) {
      // Todas las vacunas tienen más de 18 meses — probablemente desactualizadas.
      // Tope suave, no castigo fuerte.
      vaccineScore = Math.min(vaccineScore, 4);
      tips.push('Las vacunas registradas son antiguas — vale la pena revisar el calendario con el vet');
    } else {
      tips.push('Puede ser buen momento para revisar el calendario de vacunas con el vet');
    }
  }

  // Sub-score visitas al vet (8 pts)
  let vetScore = 0;
  if (vetVisits.length === 0) {
    vetScore = 2;
    tips.push('Registrar las visitas al veterinario ayuda a llevar un seguimiento completo');
  } else {
    const daysSince = daysBetween(vetVisits[0].date);
    if (daysSince <= 365) {
      vetScore = 8;
    } else if (daysSince <= 365 * 1.5) {
      vetScore = 6;
    } else if (daysSince <= 730) {
      vetScore = 3;
      tips.push('Llevan un tiempo sin visita registrada — un chequeo anual es ideal');
    } else {
      vetScore = 1;
      tips.push('Sería buena idea agendar un chequeo de rutina pronto');
    }
  }

  // Sub-score preventivos (4 pts) — antipulgas + desparasitante cada 30 días
  // 'combinado' cuenta como ambos. 2 pts si cada categoría está al día (< 40d), 1 si < 60d, 0 si no.
  const lastAnti = preventives
    .filter(p => p.type === 'antipulgas' || p.type === 'combinado')
    .map(p => daysBetween(p.date_given))
    .sort((a, b) => a - b)[0];
  const lastDes = preventives
    .filter(p => p.type === 'desparasitante' || p.type === 'combinado')
    .map(p => daysBetween(p.date_given))
    .sort((a, b) => a - b)[0];

  function scoreOne(d: number | undefined): number {
    if (d === undefined) return 0;
    if (d <= 40) return 2;  // al día (ciclo mensual + 10d de margen)
    if (d <= 60) return 1;  // apenas vencido
    return 0;
  }
  const preventiveScore = scoreOne(lastAnti) + scoreOne(lastDes);
  if (lastAnti === undefined) {
    tips.push('Registra el antipulgas para completar el cuidado preventivo');
  } else if (lastAnti > 40) {
    tips.push(`Han pasado ${lastAnti}d desde el último antipulgas — aplicar cada ~30d ideal`);
  }
  if (lastDes === undefined) {
    tips.push('Registra el desparasitante para completar el cuidado preventivo');
  } else if (lastDes > 40) {
    tips.push(`Han pasado ${lastDes}d desde el último desparasitante — aplicar cada ~30d ideal`);
  }

  // Bonus: examen de sangre anual (+2 pts si hay uno reciente)
  const bloodTests = input.bloodTests ?? [];
  const hasRecentBlood = bloodTests.some(bt => daysBetween(bt.date) <= 365);
  let bloodBonus = 0;
  if (hasRecentBlood) {
    bloodBonus = 2;
  } else if (bloodTests.length === 0) {
    tips.push('Un examen de sangre anual ayuda a detectar problemas a tiempo');
  } else {
    tips.push('Ha pasado más de un año desde el último examen de sangre');
  }

  const total = clamp(vaccineScore + vetScore + preventiveScore + bloodBonus, 2, 20);
  let status: string;
  if (total >= 18) status = 'Cuidado preventivo al día';
  else if (total >= 14) status = 'Buen seguimiento preventivo';
  else if (total >= 8) status = 'Algunos registros pendientes';
  else status = 'Comenzando a registrar historial';

  return {
    name: 'Cuidado preventivo', id: 'cuidado' as PillarId,
    score: total, max: 20, pct: clamp(total * 5, 10, 100),
    status, description: PILLAR_DESC.cuidado, tips: tips.slice(0, 2),
    isEstimated: vaccines.length === 0 && vetVisits.length === 0 && preventives.length === 0,
  };
}

// ─── Pilar 3: Raza + Edad ────────────────────────────────────────────────────

function scoreRazaEdad(input: ScoreInput): PillarScore {
  const { pet, weightRecords, groomings } = input;
  const breed = profileFor(pet);
  const age = ageInYears(pet.birth_date);
  const tips: string[] = [];
  let pts = 20;
  let isEstimated = false;

  const isCat = pet.species === 'cat';
  // Los gatos no manejan raza en Vivra — la especie ya define su perfil
  const hasBreed = isCat || (pet.breed && pet.breed.toLowerCase() !== 'other' && pet.breed.toLowerCase() !== 'mixed');
  const hasAge = age !== null;

  if (!hasBreed && !hasAge) {
    return {
      name: 'Raza y edad', id: 'raza' as PillarId, score: 12, max: 20, pct: 60,
      status: 'Perfil incompleto', description: PILLAR_DESC.raza,
      tips: ['Agregar raza y fecha de nacimiento permite personalizar el análisis'],
      isEstimated: true,
    };
  }

  if (!hasBreed) {
    isEstimated = true;
    pts = Math.min(pts, 15);
    tips.push('Agrega la raza en el perfil para un análisis más preciso');
  }

  if (!hasAge) {
    isEstimated = true;
    pts = Math.min(pts, 15);
    tips.push('La fecha de nacimiento permite detectar riesgos asociados a la edad');
  }

  // Riesgo dental por edad y raza — solo informativo, no alarmante
  if (hasAge && age! >= 2) {
    const isDentalRisk = breed.dentalRisk === 'high' || breed.dentalRisk === 'very_high'
      || breed.sizeCategory === 'toy' || breed.sizeCategory === 'small'
      || breed.risks.includes('brachycephalic_syndrome');
    const groomingDays = groomings[0] ? daysBetween(groomings[0].date) : 999;

    if (isDentalRisk && groomingDays > 60) {
      pts -= 3;
      tips.push('La salud dental es importante en esta raza. Una limpieza periódica marca la diferencia');
    }
  }

  // Riesgo cardíaco por raza — recordatorio suave, no alarmante
  if (hasAge && age! >= 5 && breed.cardiacRisk === 'very_high') {
    pts -= 3;
    tips.push(`En ${breed.displayName}, los chequeos generales cobran mayor importancia a partir de los 5 años`);
  }

  // Obesidad: raza de riesgo + castrado + adulto mayor
  if (hasAge && age! >= 6 && breed.obesityRisk === 'very_high' && pet.is_neutered) {
    const latestWeight = weightRecords[0]?.weight_kg ?? pet.weight_kg;
    if (latestWeight && latestWeight > breed.idealWeightKgMax) {
      pts -= 2;
      tips.push('Las razas con tendencia a subir de peso necesitan porciones controladas en esta etapa');
    }
  }

  // Senior: mensaje de cuidado, no de alarma
  if (hasAge && isSeniorPet(pet, age!)) {
    pts -= 2;
    if (tips.length < 2) {
      tips.push('En la etapa senior, los chequeos más frecuentes ayudan a detectar cambios a tiempo');
    }
  }

  let status: string;
  const breedName = hasBreed ? breed.displayName : 'Raza mixta';
  if (pts >= 18) status = `${breedName} · Sin alertas activas`;
  else if (pts >= 14) status = `${breedName} · Algunas recomendaciones`;
  else if (pts >= 8) status = `${breedName} · Atención sugerida`;
  else status = `${breedName} · Varias áreas de atención`;

  return {
    name: 'Raza y edad', id: 'raza' as PillarId,
    score: clamp(pts, 2, 20), max: 20, pct: clamp(pts * 5, 10, 100),
    status, description: PILLAR_DESC.raza, tips: tips.slice(0, 2), isEstimated,
  };
}

// ─── Pilar 5: Nutrición ───────────────────────────────────────────────────────

function scoreNutricion(input: ScoreInput): PillarScore {
  const { foods } = input;
  const tips: string[] = [];

  if (foods.length === 0) {
    return {
      name: 'Nutrición', id: 'nutricion' as PillarId, score: 4, max: 20, pct: 20,
      status: 'Pendiente de registro', description: PILLAR_DESC.nutricion,
      tips: ['Registra el alimento de tu mascota para completar este indicador'],
      isEstimated: true,
    };
  }

  const f = foods[0];

  // IMPORTANTE: este pilar NO juzga si la porción es la correcta. La ración
  // adecuada la define el veterinario o nutricionista, no un score de bienestar
  // — estimarla con una fórmula genérica generaba mensajes alarmantes ("tu
  // ración difiere del estimado…") sobre porciones recomendadas por un profesional.
  // En su lugar medimos algo objetivo y honesto: ¿está el alimento registrado y
  // con sus datos al día? Registrar ya suma; completar marca/tipo/ración suma más.
  let pts = 14; // base: hay un alimento registrado
  if (f.brand) pts += 2;
  if (f.type) pts += 2;
  if (f.daily_grams) pts += 2;
  pts = Math.min(20, pts);

  // Nudges de completitud — siempre de "dato faltante", nunca de "porción mal".
  if (!f.daily_grams) {
    tips.push('Agrega la ración diaria (g) para un registro más completo');
  }
  if (!f.type) {
    tips.push('Indica el tipo de alimento para completar el registro');
  }

  // Frescura del registro: si el end_date está set, la bolsa cerró formalmente.
  // Si no, usamos start_date/created_at. Solo es un recordatorio de re-registrar
  // si cambió de alimento — nunca una alarma.
  const foodLogDate = f.end_date ?? f.start_date ?? f.created_at ?? null;
  const daysSinceFoodLog = foodLogDate ? daysBetween(foodLogDate) : null;
  const isStaleFood = daysSinceFoodLog !== null && daysSinceFoodLog > 90;
  const isVeryStaleFood = daysSinceFoodLog !== null && daysSinceFoodLog > 180;

  if (isVeryStaleFood) {
    pts = Math.min(pts, 12);
    tips.unshift('Hace más de 6 meses que no registras una bolsa — si cambiaste de alimento, regístralo');
  } else if (isStaleFood) {
    pts = Math.min(pts, 16);
    tips.unshift('Si ya compraste una bolsa nueva, regístrala para mantener los promedios al día');
  }

  const total = clamp(pts, 2, 20);
  let status: string;
  if (total >= 18) status = `${f.brand ?? 'Alimento'} · registro completo`;
  else if (total >= 14) status = `${f.brand ?? 'Alimento'} registrado`;
  else status = 'Alimentación registrada';

  return {
    name: 'Nutrición', id: 'nutricion' as PillarId,
    score: total, max: 20, pct: clamp(total * 5, 10, 100),
    status, description: PILLAR_DESC.nutricion, tips: tips.slice(0, 2),
    isEstimated: isVeryStaleFood,
  };
}

// ─── Suficiencia de datos ─────────────────────────────────────────────────────

/**
 * Determina cuántos datos "reales" tiene el usuario.
 * Pensado para mostrar un estado de "recolectando datos" en vez de un score bajo.
 */
function evaluateDataSufficiency(input: ScoreInput): {
  sufficiency: DataSufficiency;
  pilarsWithData: number;
  missingDataCount: number;
} {
  const { pet, weightRecords, vaccines, vetVisits, foods } = input;

  const hasWeight = !!(weightRecords[0]?.weight_kg ?? pet.weight_kg);
  const hasVaccinesOrVet = vaccines.length > 0 || vetVisits.length > 0;
  const hasBreedOrAge = pet.species === 'cat' || !!(pet.breed && pet.breed.toLowerCase() !== 'other' && pet.breed.toLowerCase() !== 'mixed') || !!pet.birth_date;
  const hasFood = foods.length > 0;

  // 4 pilares ahora — sin actividad. Thresholds: ≥3 = ready, ≥2 = building.
  const dataPoints = [hasWeight, hasVaccinesOrVet, hasBreedOrAge, hasFood];
  const withData = dataPoints.filter(Boolean).length;
  const missing = dataPoints.filter(b => !b).length;

  let sufficiency: DataSufficiency;
  if (withData >= 3) {
    sufficiency = 'ready';
  } else if (withData >= 2) {
    sufficiency = 'building';
  } else {
    sufficiency = 'too_early';
  }

  return { sufficiency, pilarsWithData: withData, missingDataCount: missing };
}

// ─── Flags de sugerencias (siempre en tono amable) ───────────────────────────

function buildFlags(input: ScoreInput): ScoreFlag[] {
  const { pet, weightRecords, vaccines, vetVisits, groomings, foods } = input;
  const breed = profileFor(pet);
  const age = ageInYears(pet.birth_date);
  const flags: ScoreFlag[] = [];

  // Sugerencia: peso por encima del rango (nunca "sobrepeso crítico")
  const latestWeight = weightRecords[0]?.weight_kg ?? pet.weight_kg;
  const prevWeight = weightRecords[1]?.weight_kg;
  if (latestWeight && latestWeight > breed.idealWeightKgMax * 1.08) {
    const gaining = prevWeight && latestWeight > prevWeight;
    flags.push({
      id: 'weight_check',
      severity: gaining ? 'suggestion' : 'tip',
      message: gaining
        ? `El peso está aumentando gradualmente (${latestWeight} kg) — puede valer la pena ajustar la dieta`
        : `El peso está un poco por encima del rango ideal para ${breed.displayName}`,
      action: 'Ver historial de peso',
      href: '/salud/peso',
    });
  }

  // Recordatorio: visita al vet — solo si hay historial Y han pasado más de 14 meses
  if (vetVisits.length > 0) {
    const daysSince = daysBetween(vetVisits[0].date);
    if (daysSince > 425) { // ~14 meses
      flags.push({
        id: 'vet_reminder',
        severity: 'reminder',
        message: 'Ha pasado más de un año desde la última visita registrada al vet',
        action: 'Agendar chequeo de rutina',
        href: '/salud/historial',
      });
    }
  }

  // Sugerencia: vacunas — solo si las tiene registradas y parecen antiguas
  if (vaccines.length > 0) {
    const anyRecent = vaccines.some(v => daysBetween(v.date_given) < 365);
    if (!anyRecent) {
      flags.push({
        id: 'vaccine_check',
        severity: 'tip',
        message: 'Las vacunas registradas pueden estar próximas a actualizarse',
        action: 'Revisar calendario de vacunación',
        href: '/salud/vacunas',
      });
    }
  }

  // Recordatorio: salud dental para razas de riesgo ≥ 2 años
  if (age !== null && age >= 2) {
    const isDentalBreed = breed.dentalRisk === 'high' || breed.dentalRisk === 'very_high'
      || breed.risks.includes('dental_disease')
      || breed.risks.includes('brachycephalic_syndrome');
    const groomDays = groomings[0] ? daysBetween(groomings[0].date) : 999;

    if (isDentalBreed && groomDays > 75) {
      flags.push({
        id: 'dental_tip',
        severity: 'tip',
        message: 'La salud dental es especialmente importante en esta raza. Limpieza periódica recomendada',
        action: 'Ver registro de grooming',
        href: '/salud/grooming',
      });
    }
  }

  // Recordatorio: revisión cardíaca para razas de riesgo (solo ≥6 años y sin visita reciente)
  if (breed.cardiacRisk === 'very_high' && age !== null && age >= 6) {
    const lastVisitDays = vetVisits[0] ? daysBetween(vetVisits[0].date) : 999;
    if (lastVisitDays > 365) {
      flags.push({
        id: 'cardiac_tip',
        severity: 'suggestion',
        message: `En ${breed.displayName} los chequeos de rutina son especialmente importantes a partir de los 5–6 años`,
        action: 'Ver historial veterinario',
        href: '/salud/historial',
      });
    }
  }

  // Recordatorio: senior — chequeos más frecuentes (solo si hay historial vet existente)
  if (age !== null && isSeniorPet(input.pet, age) && vetVisits.length > 0) {
    const lastVisitDays = daysBetween(vetVisits[0].date);
    if (lastVisitDays > 210) {
      flags.push({
        id: 'senior_care',
        severity: 'reminder',
        message: 'En la etapa senior se recomienda un chequeo cada 6 meses',
        action: 'Ver historial veterinario',
        href: '/salud/historial',
      });
    }
  }

  // Recordatorio: examen de sangre anual
  const bloodTests = input.bloodTests ?? [];
  const hasRecentBloodTest = bloodTests.some(bt => daysBetween(bt.date) <= 365);
  if (!hasRecentBloodTest) {
    flags.push({
      id: 'blood_test',
      severity: bloodTests.length === 0 ? 'tip' : 'reminder',
      message: bloodTests.length === 0
        ? 'Un examen de sangre anual es clave para la detección temprana'
        : 'Ha pasado más de un año desde el último examen de sangre',
      action: 'Registrar examen de sangre',
      href: '/salud/historial',
    });
  }

  // Recordatorio: faltan datos clave (solo si hay pocos datos)
  if (foods.length === 0) {
    flags.push({
      id: 'food_missing',
      severity: 'tip',
      message: 'Registrar el alimento completa el análisis nutricional',
      action: 'Agregar alimento',
      href: '/alimentacion',
    });
  }

  // Ordenar: suggestion primero, luego reminder, luego tip
  const order: Record<string, number> = { suggestion: 0, reminder: 1, tip: 2 };
  return flags
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, 4); // máximo 4 flags
}

// ─── Categorías del score ─────────────────────────────────────────────────────

const SCORE_CATEGORIES: Array<{
  min: number;
  category: ScoreCategory;
  color: string;
  headline: string;
  sublines: string[];
}> = [
  {
    min: 85, category: 'excellent', color: '#22c55e',
    headline: 'En excelente forma',
    sublines: ['Todo apunta a un estado de salud muy bueno', 'Sigue así, lo estás haciendo genial'],
  },
  {
    min: 70, category: 'good', color: '#22c55e',
    headline: 'Muy buen estado',
    sublines: ['Hay pequeñas oportunidades de mejora', 'Un par de ajustes y llegamos al máximo'],
  },
  {
    min: 55, category: 'fair', color: '#f59e0b',
    headline: 'Buen comienzo',
    sublines: ['Completa más registros para un análisis más preciso', 'Cada dato que agregas mejora el score'],
  },
  {
    min: 40, category: 'fair', color: '#f97316',
    headline: 'Perfil en construcción',
    sublines: ['Aún faltan datos para un análisis completo', 'Empieza por registrar el peso y las vacunas'],
  },
  {
    min: 0, category: 'building', color: '#94a3b8',
    headline: 'Comenzando el historial',
    sublines: ['Agrega más datos para ver el Vitality Score completo', 'Cuantos más registros, más preciso el análisis'],
  },
];

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Escala un pilar de la escala interna 0–20 a la escala pública 0–25.
 * Necesario porque eliminamos el Pilar 4 (Actividad) y redistribuimos sus 20 pts
 * entre los 4 pilares restantes (5 pts extra cada uno) para mantener total = 100.
 */
function scaleTo25(p: PillarScore): PillarScore {
  const newScore = Math.min(25, Math.round(p.score * 1.25));
  return {
    ...p,
    score: newScore,
    max: 25,
    pct: Math.min(100, Math.round((newScore / 25) * 100)),
  };
}

/**
 * Calcula el Vivra Vitality Score completo.
 *
 * Nunca muestra "crítico" — el peor estado visible es "perfil en construcción".
 * Tampoco usa lenguaje médico afirmativo — solo sugerencias y recomendaciones.
 */
export function calculateVitalityScore(input: ScoreInput): VitalityScoreResult {
  // Las funciones internas siguen calculando sobre 20 pts por compatibilidad histórica,
  // y aquí escalamos a 25 pts cada una al cierre.
  const p1 = scaleTo25(scorePeso(input));
  const p2 = scaleTo25(scoreCuidado(input));
  const p3 = scaleTo25(scoreRazaEdad(input));
  const p5 = scaleTo25(scoreNutricion(input));

  const pillars = [p1, p2, p3, p5];
  const { sufficiency, pilarsWithData, missingDataCount } = evaluateDataSufficiency(input);

  const { pet, weightRecords, vaccines, vetVisits, foods } = input;

  // ── Áreas pendientes con CTA amigable ─────────────────────────────────────
  // IMPORTANTE: debe ser exactamente paralelo a los 4 checks de evaluateDataSufficiency
  // para que pendingAreas.length == missingDataCount siempre.
  const pendingAreas: PendingArea[] = [];

  // Pilar 1: Peso
  if (!(weightRecords[0]?.weight_kg ?? pet.weight_kg)) {
    pendingAreas.push({ label: 'Registra el peso actual', href: '/salud/peso' });
  }

  // Pilar 2: Vacunas / Vet
  if (vaccines.length === 0 && vetVisits.length === 0) {
    pendingAreas.push({ label: 'Registra vacunas o visitas al vet', href: '/salud/vacunas' });
  }

  // Pilar 3: Raza y edad
  const hasBreedOrAgePending = pet.species !== 'cat' && !(pet.breed && pet.breed.toLowerCase() !== 'other' && pet.breed.toLowerCase() !== 'mixed') && !pet.birth_date;
  if (hasBreedOrAgePending) {
    pendingAreas.push({ label: 'Completa raza y fecha de nacimiento en el perfil', href: '/perfil' });
  }

  // Pilar 5: Alimentación
  if (foods.length === 0) {
    pendingAreas.push({ label: 'Agrega el alimento actual', href: '/alimentacion' });
  }

  // ── Score numérico solo si hay datos suficientes ───────────────────────────
  // Con < 2 áreas con datos, el número no significa nada — mejor no mostrarlo.
  const showScore = sufficiency !== 'too_early';
  const rawTotal = clamp(pillars.reduce((sum, p) => sum + p.score, 0), 0, 100);
  const total = showScore ? rawTotal : 0;

  const cat = SCORE_CATEGORIES.find(c => rawTotal >= c.min) ?? SCORE_CATEGORIES[SCORE_CATEGORIES.length - 1];
  const flags = buildFlags(input);
  const age = ageInYears(input.pet.birth_date);

  // ── Headline y subline adaptados al estado ─────────────────────────────────
  let headline: string;
  let subline: string;
  let color: string;

  if (!showScore) {
    headline = 'Completando el perfil';
    subline = 'Agrega unos datos más para ver cómo está ' + (pet.species === 'cat' ? 'tu gato' : 'tu perro');
    color = '#94a3b8';
  } else if (sufficiency === 'building') {
    headline = cat.headline;
    subline = missingDataCount === 1
      ? 'Falta 1 área para el análisis completo'
      : `Faltan ${missingDataCount} áreas para el análisis completo`;
    color = cat.color;
  } else {
    headline = cat.headline;
    subline = cat.sublines[0];
    color = cat.color;
  }

  return {
    total,
    showScore,
    category: cat.category,
    color,
    headline,
    subline,
    pillars,
    flags,
    dataSufficiency: sufficiency,
    pilarsWithData,
    missingDataCount,
    pendingAreas,
    ageYears: age,
    isSenior: age !== null ? isSeniorPet(input.pet, age) : false,
  };
}
