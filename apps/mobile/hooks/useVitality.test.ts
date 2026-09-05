import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVitality } from './useVitality';

afterEach(() => vi.useRealTimers());

describe('mobile vitality score', () => {
  it('keeps the food closing date so a recently finished bag is not marked stale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T12:00:00Z'));
    const petData = {
      pet: { species: 'dog', breed: null, birth_date: null, weight_kg: null, gender: null, is_neutered: null },
      weightRecords: [], vaccines: [], vetVisits: [], groomings: [], preventives: [],
      foods: [{ brand: 'Warf', daily_grams: 250, bag_size: 3.5, bag_unit: 'kg', type: 'raw',
        start_date: '2026-01-01', created_at: '2026-01-01', end_date: '2026-09-01' }],
    };
    function Score() {
      const nutrition = useVitality(petData)?.pillars.find(pillar => pillar.id === 'nutricion');
      return `${nutrition?.pct}:${nutrition?.isEstimated}`;
    }
    expect(renderToStaticMarkup(createElement(Score))).toBe('100:false');
  });
});
