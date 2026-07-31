import { describe, expect, it } from 'vitest';
import { calculateVitalityScore, type ScoreInput } from './vitality-score';

/** Input mínimo válido; cada test sobreescribe solo lo que le importa. */
function makeInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    pet: {
      breed: 'Jack Russell Terrier',
      birth_date: '2020-10-10',
      weight_kg: 6,
      gender: 'macho',
      is_neutered: false,
    },
    weightRecords: [{ weight_kg: 6, date: new Date().toISOString().slice(0, 10) }],
    vaccines: [{ name: 'Rabia', date_given: new Date().toISOString().slice(0, 10) }],
    vetVisits: [{ date: new Date().toISOString().slice(0, 10) }],
    groomings: [],
    foods: [],
    ...overrides,
  };
}

const today = () => new Date().toISOString().slice(0, 10);

describe('pilar de Nutrición', () => {
  /**
   * Regresión: el score comparaba kcal necesarias vs aportadas y generaba
   * mensajes como "La ración actual difiere del estimado (~153 g/día)".
   * Eso asustaba a dueños que seguían la porción indicada por su nutricionista.
   * El pilar ya NO juzga la porción — solo mide si el alimento está registrado.
   */
  it('no emite mensajes que cuestionen la porción', () => {
    const result = calculateVitalityScore(
      makeInput({
        foods: [
          {
            brand: 'Warf',
            daily_grams: 250,
            bag_size: 3.5,
            bag_unit: 'kg',
            type: 'raw',
            start_date: today(),
          },
        ],
      }),
    );

    const nutricion = result.pillars.find((p) => p.id === 'nutricion');
    const texto = [nutricion?.status, ...(nutricion?.tips ?? [])].join(' ').toLowerCase();

    expect(texto).not.toMatch(/g\/día/);
    expect(texto).not.toMatch(/difiere/);
    expect(texto).not.toMatch(/estimad/);
    expect(texto).not.toMatch(/revisarla/);
  });

  it('da puntaje alto cuando el alimento está bien registrado', () => {
    const result = calculateVitalityScore(
      makeInput({
        foods: [
          {
            brand: 'Warf',
            daily_grams: 250,
            bag_size: 3.5,
            bag_unit: 'kg',
            type: 'raw',
            start_date: today(),
          },
        ],
      }),
    );

    const nutricion = result.pillars.find((p) => p.id === 'nutricion');
    expect(nutricion?.pct).toBe(100);
    expect(nutricion?.isEstimated).toBe(false);
  });

  it('marca el pilar como estimado y bajo si no hay alimento', () => {
    const result = calculateVitalityScore(makeInput({ foods: [] }));
    const nutricion = result.pillars.find((p) => p.id === 'nutricion');

    expect(nutricion?.isEstimated).toBe(true);
    expect(nutricion?.pct).toBeLessThan(50);
  });

  it('sugiere completar datos faltantes sin alarmar', () => {
    const result = calculateVitalityScore(
      makeInput({
        foods: [{ brand: 'Warf', daily_grams: null, bag_size: null, bag_unit: null, type: null, start_date: today() }],
      }),
    );

    const nutricion = result.pillars.find((p) => p.id === 'nutricion');
    expect(nutricion?.tips.join(' ')).toMatch(/ración diaria|tipo de alimento/i);
  });
});

describe('calculateVitalityScore', () => {
  it('oculta el número cuando hay muy pocos datos', () => {
    const result = calculateVitalityScore({
      pet: { breed: null, birth_date: null, weight_kg: null, gender: null, is_neutered: null },
      weightRecords: [],
      vaccines: [],
      vetVisits: [],
      groomings: [],
      foods: [],
    });

    expect(result.showScore).toBe(false);
    expect(result.total).toBe(0);
    expect(result.pendingAreas.length).toBe(result.missingDataCount);
  });

  it('mantiene el total dentro de 0–100 y 4 pilares', () => {
    const result = calculateVitalityScore(
      makeInput({
        foods: [{ brand: 'Warf', daily_grams: 250, bag_size: 3.5, bag_unit: 'kg', type: 'raw', start_date: today() }],
      }),
    );

    expect(result.pillars).toHaveLength(4);
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThanOrEqual(100);
    result.pillars.forEach((p) => expect(p.max).toBe(25));
  });

  it('nunca usa lenguaje alarmante en el headline', () => {
    const result = calculateVitalityScore(makeInput());
    expect(result.headline.toLowerCase()).not.toMatch(/crítico|grave|peligro|urgente|enferm/);
  });
});
