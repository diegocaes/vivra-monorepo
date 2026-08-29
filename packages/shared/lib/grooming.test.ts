import { describe, expect, it } from 'vitest';
import { formatGroomingServices, normalizeGroomingServices } from './grooming';

describe('grooming services', () => {
  it('keeps legacy single-service records compatible', () => {
    expect(normalizeGroomingServices(null, 'bano')).toEqual(['bano']);
    expect(formatGroomingServices(null, 'bano')).toBe('Baño');
  });

  it('deduplicates and formats multi-service sessions', () => {
    expect(normalizeGroomingServices(['bano', 'unas', 'bano'], 'corte')).toEqual(['bano', 'unas']);
    expect(formatGroomingServices(['bano', 'unas'], 'corte')).toBe('Baño · Corte de uñas');
  });
});
