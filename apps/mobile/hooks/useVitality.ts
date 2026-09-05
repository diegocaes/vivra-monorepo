import { useMemo } from 'react';
import { calculateVitalityScore, type ScoreInput, type VitalityScoreResult } from '@vivra/shared';

export function useVitality(petData: Omit<ScoreInput, 'pet'> & {
  pet: ScoreInput['pet'] | null;
}): VitalityScoreResult | null {
  const { pet, vaccines, weightRecords, foods, vetVisits, groomings, preventives } = petData;

  return useMemo(() => {
    if (!pet) return null;

    return calculateVitalityScore({ pet, weightRecords, vaccines, vetVisits, groomings, foods, preventives });
  }, [pet, vaccines, weightRecords, foods, vetVisits, groomings, preventives]);
}
