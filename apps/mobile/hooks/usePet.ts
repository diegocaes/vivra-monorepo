import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useSubscription } from './useSubscription';
import { scheduleVaccineReminder, scheduleGroomingReminder } from './useNotifications';
import type { Pet, Vaccine, WeightRecord, Food } from '../types/supabase';

export interface PetData {
  pet: Pet | null;
  pets: Pet[];
  vaccines: Pick<Vaccine, 'name' | 'date_given'>[];
  weightRecords: Pick<WeightRecord, 'weight_kg' | 'date'>[];
  foods: Pick<Food, 'brand' | 'daily_grams' | 'bag_size' | 'bag_unit' | 'type' | 'start_date' | 'created_at'>[];
  vetVisits: { date: string; reason: string }[];
  groomings: { type: string; date: string }[];
  activityLogs: { date: string; walks: number; duration_minutes: number | null }[];
  adventures: { date: string }[];
  lastAntipulgas: { date_given: string; product_name: string | null } | null;
  lastDesparasitante: { date_given: string; product_name: string | null } | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setActivePetId: (id: string) => void;
}

export function usePet(): PetData {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [pets, setPets] = useState<Pet[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [vaccines, setVaccines] = useState<PetData['vaccines']>([]);
  const [weightRecords, setWeightRecords] = useState<PetData['weightRecords']>([]);
  const [foods, setFoods] = useState<PetData['foods']>([]);
  const [vetVisits, setVetVisits] = useState<PetData['vetVisits']>([]);
  const [groomings, setGroomings] = useState<PetData['groomings']>([]);
  const [activityLogs, setActivityLogs] = useState<PetData['activityLogs']>([]);
  const [adventures, setAdventures] = useState<PetData['adventures']>([]);
  const [lastAntipulgas, setLastAntipulgas] = useState<PetData['lastAntipulgas']>(null);
  const [lastDesparasitante, setLastDesparasitante] = useState<PetData['lastDesparasitante']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pet = pets.find(p => p.id === activePetId) ?? pets[0] ?? null;

  const fetchPets = useCallback(async () => {
    if (!user) return;
    const { data, error: err } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (err) {
      setError(err.message);
      return;
    }
    setPets((data as Pet[]) ?? []);
    if (data && data.length > 0) {
      setActivePetId(prev => prev ?? data[0].id);
    }
  }, [user]);

  const fetchPetData = useCallback(async () => {
    if (!pet) return;
    setError(null);

    try {
      const [
        vaccinesRes,
        weightsRes,
        foodsRes,
        visitsRes,
        groomingsRes,
        activityRes,
        adventuresRes,
        antipulgasRes,
        desparasitanteRes,
      ] = await Promise.all([
        supabase.from('vaccines').select('name, date_given').eq('pet_id', pet.id).order('date_given', { ascending: false }),
        supabase.from('weight_records').select('weight_kg, date').eq('pet_id', pet.id).order('date', { ascending: false }),
        supabase.from('foods').select('brand, daily_grams, bag_size, bag_unit, type, start_date, created_at').eq('pet_id', pet.id).order('created_at', { ascending: false }),
        supabase.from('vet_visits').select('date, reason').eq('pet_id', pet.id).order('date', { ascending: false }),
        supabase.from('groomings').select('type, date').eq('pet_id', pet.id).order('date', { ascending: false }),
        supabase.from('activity_logs').select('date, walks, duration_minutes').eq('pet_id', pet.id).order('date', { ascending: false }).limit(60),
        supabase.from('adventures').select('date').eq('pet_id', pet.id).order('date', { ascending: false }).limit(30),
        supabase.from('preventive_treatments').select('date_given, product_name').eq('pet_id', pet.id).eq('type', 'antipulgas').order('date_given', { ascending: false }).limit(1),
        supabase.from('preventive_treatments').select('date_given, product_name').eq('pet_id', pet.id).eq('type', 'desparasitante').order('date_given', { ascending: false }).limit(1),
      ]);

      setVaccines(vaccinesRes.data ?? []);
      setWeightRecords(weightsRes.data ?? []);
      setFoods(foodsRes.data ?? []);
      setVetVisits(visitsRes.data ?? []);
      setGroomings(groomingsRes.data ?? []);
      setActivityLogs(activityRes.data ?? []);
      setAdventures(adventuresRes.data ?? []);
      setLastAntipulgas(antipulgasRes.data?.[0] ?? null);
      setLastDesparasitante(desparasitanteRes.data?.[0] ?? null);

      // Schedule premium-only notifications
      if (isPremium && pet) {
        // Vaccine reminders (7 days before next dose)
        for (const v of vaccinesRes.data ?? []) {
          if (v.date_given) {
            const nextDue = new Date(v.date_given);
            nextDue.setFullYear(nextDue.getFullYear() + 1);
            scheduleVaccineReminder({ petName: pet.name, vaccineName: v.name, nextDueDate: nextDue });
          }
        }
        // Grooming reminder (28 days after last)
        const lastGroom = groomingsRes.data?.[0];
        if (lastGroom?.date) {
          scheduleGroomingReminder({ petName: pet.name, lastGroomingDate: new Date(lastGroom.date + 'T00:00:00') });
        }
      }
    } catch (e: any) {
      setError(e.message ?? 'Error cargando datos');
    }
  }, [pet?.id, isPremium]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchPets();
    await fetchPetData();
    setLoading(false);
  }, [fetchPets, fetchPetData]);

  // Initial load: fetch pets
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchPets().then(() => setLoading(false), () => setLoading(false));
  }, [user]);

  // When active pet changes, fetch its data
  useEffect(() => {
    if (!pet) return;
    setLoading(true);
    fetchPetData().then(() => setLoading(false), () => setLoading(false));
  }, [pet?.id]);

  return {
    pet,
    pets,
    vaccines,
    weightRecords,
    foods,
    vetVisits,
    groomings,
    activityLogs,
    adventures,
    lastAntipulgas,
    lastDesparasitante,
    loading,
    error,
    refresh,
    setActivePetId,
  };
}
