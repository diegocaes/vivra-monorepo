import { describe, expect, it } from 'vitest';
import { groomingBackRoute, passportBackRoute } from './careNavigation';

describe('care detail navigation', () => {
  it('returns Grooming to the visible section that opened it', () => {
    expect(groomingBackRoute('inicio')).toBe('/(app)');
    expect(groomingBackRoute('salud')).toBe('/(app)/salud');
  });

  it('never returns Grooming to the hidden actividad stack', () => {
    expect(groomingBackRoute(undefined)).toBe('/(app)/salud');
    expect(groomingBackRoute('vuelos')).toBe('/(app)/salud');
  });

  it('returns Pasaporte to Perfil, its only entry point', () => {
    expect(passportBackRoute()).toBe('/(app)/perfil');
  });
});
