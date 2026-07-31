import { describe, expect, it } from 'vitest';
import { formatCurrency, parseNumericField } from './utils';

describe('parseNumericField', () => {
  it('acepta números válidos', () => {
    expect(parseNumericField('250')).toBe(250);
    expect(parseNumericField('6.5')).toBe(6.5);
    expect(parseNumericField(42)).toBe(42);
    expect(parseNumericField(' 10 ')).toBe(10);
  });

  it('devuelve null en vacío o ausente (campo opcional del form)', () => {
    expect(parseNumericField('')).toBeNull();
    expect(parseNumericField('   ')).toBeNull();
    expect(parseNumericField(null)).toBeNull();
    expect(parseNumericField(undefined)).toBeNull();
  });

  // Este es el bug que rompía inserts en Postgres con un 500.
  it('nunca deja pasar NaN', () => {
    expect(parseNumericField('abc')).toBeNull();
    expect(parseNumericField('12abc')).toBeNull();
    expect(parseNumericField({})).toBeNull();
    expect(parseNumericField(Number.NaN)).toBeNull();
  });

  it('rechaza Infinity', () => {
    expect(parseNumericField('Infinity')).toBeNull();
    expect(parseNumericField(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('rechaza negativos por defecto', () => {
    expect(parseNumericField('-5')).toBeNull();
    expect(parseNumericField('-0.1')).toBeNull();
  });

  it('respeta el rango min/max', () => {
    expect(parseNumericField('200', { max: 150 })).toBeNull();
    expect(parseNumericField('0.05', { min: 0.1 })).toBeNull();
    expect(parseNumericField('80', { min: 0.1, max: 150 })).toBe(80);
  });
});

describe('formatCurrency', () => {
  it('formatea con separadores de miles y 2 decimales', () => {
    expect(formatCurrency(1234.5)).toBe('1,234.50');
    expect(formatCurrency(0)).toBe('0.00');
  });
});
