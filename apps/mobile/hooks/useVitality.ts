import { useMemo } from 'react';
import { calculateVitalityScore, type VitalityScoreResult, type ScoreInput } from '@vivra/shared';
import type { PetData } from './usePet';

export function useVitality(petData: PetData): VitalityScoreResult | null {
  const { pet, vaccines, weightRecords, foods, vetVisits, groomings, preventives } = petData;

  return useMemo(() => {
    if (!pet) return null;

    const input: ScoreInput = {
      pet: {
        species: pet.species,
        breed: pet.breed,
        birth_date: pet.birth_date,
        weight_kg: pet.weight_kg,
        gender: pet.gender,
        is_neutered: pet.is_neutered,
      },
      weightRecords: weightRecords.map(w => ({ weight_kg: w.weight_kg, date: w.date })),
      vaccines: vaccines.map(v => ({ name: v.name, date_given: v.date_given })),
      vetVisits: vetVisits.map(v => ({ date: v.date })),
      groomings: groomings.map(g => ({ date: g.date })),
      foods: foods.map(f => ({
        brand: f.brand,
        daily_grams: f.daily_grams,
        bag_size: f.bag_size,
        bag_unit: f.bag_unit,
        type: f.type,
        start_date: f.start_date,
        created_at: f.created_at,
      })),
      preventives: preventives.map(p => ({ type: p.type, date_given: p.date_given, next_due: p.next_due })),
    };

    return calculateVitalityScore(input);
  }, [pet, vaccines, weightRecords, foods, vetVisits, groomings, preventives]);
}
