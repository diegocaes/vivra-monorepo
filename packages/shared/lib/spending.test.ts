import { describe, it, expect } from 'vitest';
import { toAmount, sumAmounts } from './spending';
import { formatCurrency } from './utils';
import { computeFoodStats } from './food-stats';

describe('toAmount', () => {
  it('acepta números positivos', () => {
    expect(toAmount(44.5)).toBe(44.5);
  });

  it('convierte texto numérico — Postgres numeric puede llegar como string', () => {
    expect(toAmount('44.5')).toBe(44.5);
  });

  it('descarta null, undefined y vacío', () => {
    expect(toAmount(null)).toBe(0);
    expect(toAmount(undefined)).toBe(0);
    expect(toAmount('')).toBe(0);
  });

  it('descarta lo que no es número', () => {
    expect(toAmount('abc')).toBe(0);
    expect(toAmount(NaN)).toBe(0);
    expect(toAmount(Infinity)).toBe(0);
    expect(toAmount({})).toBe(0);
  });

  it('descarta cero y negativos — un precio negativo es un dato malo', () => {
    expect(toAmount(0)).toBe(0);
    expect(toAmount(-99)).toBe(0);
  });
});

describe('sumAmounts', () => {
  it('suma la columna pedida', () => {
    expect(sumAmounts([{ cost: 10 }, { cost: 5.5 }], 'cost')).toBe(15.5);
  });

  it('tolera null/undefined de una consulta fallida', () => {
    expect(sumAmounts(null, 'price')).toBe(0);
    expect(sumAmounts(undefined, 'price')).toBe(0);
    expect(sumAmounts([], 'price')).toBe(0);
  });

  it('ignora filas sin la columna o con basura', () => {
    expect(sumAmounts([{ price: 10 }, { price: null }, { price: 'x' } as never], 'price')).toBe(10);
  });

  it('no arrastra restos de coma flotante', () => {
    // 0.1 + 0.2 === 0.30000000000000004 sin el redondeo.
    expect(sumAmounts([{ p: 0.1 }, { p: 0.2 }], 'p')).toBe(0.3);
  });

  it('da el mismo total sin importar el orden de las filas', () => {
    const filas = [{ p: 44.5 }, { p: 40.5 }, { p: 25.8 }, { p: 23 }, { p: 26 }];
    expect(sumAmounts(filas, 'p')).toBe(sumAmounts([...filas].reverse(), 'p'));
  });
});

describe('el total de alimentación cuadra con el del perfil', () => {
  // Esta es LA regresión que motivó ./spending.ts: la pantalla de
  // alimentación usa computeFoodStats y el perfil suma la columna directo.
  // Si los dos caminos se separan otra vez, esto se cae.
  const casos: { nombre: string; foods: any[] }[] = [
    {
      nombre: 'datos reales de producción',
      foods: [
        { price: 44.5 }, { price: 40.5 }, { price: 40 }, { price: 44 }, { price: 44 },
        { price: 44 }, { price: 44 }, { price: 25.8 }, { price: null }, { price: 23 },
        { price: 26 }, { price: 26 }, { price: 23 },
      ],
    },
    { nombre: 'con precio cero', foods: [{ price: 10 }, { price: 0 }] },
    { nombre: 'con precio negativo', foods: [{ price: 10 }, { price: -5 }] },
    { nombre: 'con precio como texto', foods: [{ price: '10.50' }, { price: 5 }] },
    { nombre: 'todos sin precio', foods: [{ price: null }, { price: null }] },
    { nombre: 'sin bolsas', foods: [] },
  ];

  for (const { nombre, foods } of casos) {
    it(nombre, () => {
      expect(computeFoodStats(foods).totalSpent).toBe(sumAmounts(foods, 'price'));
    });
  }

  it('el caso de producción da 424.80 exacto', () => {
    expect(computeFoodStats(casos[0].foods).totalSpent).toBe(424.8);
  });
});

describe('formato: el mismo monto se ve igual en toda la app', () => {
  // La regresión real que vio el usuario: /salud/historial pintaba el total
  // con `toFixed(0)` y el perfil con formatCurrency. El MISMO gasto de vet
  // salía como "$428" en una pantalla y "$427.99" en la otra.
  const totalVet = sumAmounts(
    [{ cost: 35.26 }, { cost: 65 }, { cost: 25 }, { cost: 50 },
     { cost: 105 }, { cost: 49.98 }, { cost: 71 }, { cost: 26.75 }],
    'cost',
  );

  it('suma los datos reales de vet a 427.99', () => {
    expect(totalVet).toBe(427.99);
  });

  it('formatCurrency conserva los centavos', () => {
    expect(formatCurrency(totalVet)).toBe('427.99');
  });

  it('toFixed(0) NO sirve para dinero — este era el bug', () => {
    expect(totalVet.toFixed(0)).toBe('428');
    expect(totalVet.toFixed(0)).not.toBe(formatCurrency(totalVet));
  });
});
