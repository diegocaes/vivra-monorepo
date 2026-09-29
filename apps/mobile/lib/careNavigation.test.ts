import { describe, expect, it } from 'vitest';
import { groomingBackRoute, passportBackRoute } from './careNavigation';

describe('care detail navigation', () => {
  it('returns Grooming to the visible section that opened it', () => {
    expect(groomingBackRoute('inicio')).toBe('/(app)');
    expect(groomingBackRoute('salud')).toBe('/(app)/cuidado');
    expect(groomingBackRoute('cuidado')).toBe('/(app)/cuidado');
  });

  it('never returns Grooming to the hidden actividad stack', () => {
    expect(groomingBackRoute(undefined)).toBe('/(app)/cuidado');
    expect(groomingBackRoute('vuelos')).toBe('/(app)/cuidado');
  });

  it('returns Pasaporte to Viajes when opened without navigation history', () => {
    expect(passportBackRoute()).toBe('/(app)/viajes');
  });
});
