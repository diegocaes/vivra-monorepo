import { useMemo } from 'react';
import { calculateVitalityScore, VitalityScoreResult, ScoreInput } from '@vivra/shared';
import type { PetData } from './usePet';

export function useVitality(petData: PetData): VitalityScoreResult | null {
  const { pet, vaccines, weightRecords, foods, vetVisits, groomings, activityLogs, adventures } = petData;

  return useMemo(() => {
    if (!pet) return null;

    const input: ScoreInput = {
      pet: {
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
      adventures: adventures.map(a => ({ date: a.date })),
      activityLogs: activityLogs.map(a => ({
        date: a.date,
        walks: a.walks,
        duration_minutes: a.duration_minutes,
      })),
      foods: foods.map(f => ({
        brand: f.brand,
        daily_grams: f.daily_grams,
        bag_size: f.bag_size,
        bag_unit: f.bag_unit,
        type: f.type,
      })),
    };

    return calculateVitalityScore(input);
  }, [pet, vaccines, weightRecords, foods, vetVisits, groomings, activityLogs, adventures]);
}
