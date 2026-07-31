import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useSubscription } from '../contexts/SubscriptionContext';
import { scheduleVaccineReminder, schedulePreventiveReminder, scheduleWeightReminder } from './useNotifications';
import type { Pet, Vaccine, WeightRecord, Food, PreventiveTreatment } from '../types/supabase';

export interface CoOwner {
  id: string;
  shared_with: string;
  shared_with_email: string | null;
  shared_with_name: string | null;
}

export type PreventiveRow = Pick<PreventiveTreatment, 'type' | 'date_given' | 'product_name'>;

export interface PetData {
  pet: Pet | null;
  pets: Pet[];
  isOwner: boolean;
  coOwners: CoOwner[];
  vaccines: Pick<Vaccine, 'name' | 'date_given'>[];
  weightRecords: Pick<WeightRecord, 'weight_kg' | 'date'>[];
  foods: Pick<Food, 'brand' | 'daily_grams' | 'bag_size' | 'bag_unit' | 'type' | 'food_type' | 'start_date' | 'end_date' | 'price' | 'notes' | 'created_at'>[];
  vetVisits: { date: string; reason: string; location: string | null }[];
  groomings: { type: string; date: string; location: string | null; groomer_name: string | null }[];
  /** Blood test records sorted by date desc. Used for the vitality score bonus + reminder. */
  bloodTests: { date: string }[];
  /** All preventives sorted by date_given desc. 'combinado' counts as both antipulgas + desparasitante. */
  preventives: PreventiveRow[];
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
  const [coOwners, setCoOwners] = useState<CoOwner[]>([]);
  const [vaccines, setVaccines] = useState<PetData['vaccines']>([]);
  const [weightRecords, setWeightRecords] = useState<PetData['weightRecords']>([]);
  const [foods, setFoods] = useState<PetData['foods']>([]);
  const [vetVisits, setVetVisits] = useState<PetData['vetVisits']>([]);
  const [groomings, setGroomings] = useState<PetData['groomings']>([]);
  const [bloodTests, setBloodTests] = useState<PetData['bloodTests']>([]);
  const [preventives, setPreventives] = useState<PreventiveRow[]>([]);
  const [lastAntipulgas, setLastAntipulgas] = useState<PetData['lastAntipulgas']>(null);
  const [lastDesparasitante, setLastDesparasitante] = useState<PetData['lastDesparasitante']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pet = pets.find(p => p.id === activePetId) ?? pets[0] ?? null;
  const isOwner = !!(pet && user && pet.user_id === user.id);

  const fetchPets = useCallback(async () => {
    if (!user) return;

    // Fetch owned pets + shared pets in parallel
    const [ownedRes, sharedRes] = await Promise.all([
      supabase
        .from('pets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('pet_shares')
        .select('pet_id, pets(*)')
        .eq('shared_with', user.id),
    ]);

    if (ownedRes.error) {
      setError(ownedRes.error.message);
      return;
    }

    const ownedPets = (ownedRes.data as Pet[]) ?? [];
    const sharedPets = (sharedRes.data ?? [])
      .map((s: any) => s.pets)
      .filter(Boolean) as Pet[];

    const allPets = [...ownedPets, ...sharedPets];
    setPets(allPets);

    if (allPets.length > 0) {
      setActivePetId(prev => prev ?? allPets[0].id);
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
        bloodTestsRes,
        preventivesRes,
      ] = await Promise.all([
        supabase.from('vaccines').select('name, date_given').eq('pet_id', pet.id).order('date_given', { ascending: false }),
        supabase.from('weight_records').select('weight_kg, date').eq('pet_id', pet.id).order('date', { ascending: false }),
        supabase.from('foods').select('brand, daily_grams, bag_size, bag_unit, type, food_type, start_date, end_date, price, notes, created_at').eq('pet_id', pet.id).order('created_at', { ascending: false }),
        supabase.from('vet_visits').select('date, reason, location').eq('pet_id', pet.id).order('date', { ascending: false }),
        supabase.from('groomings').select('type, date, location, groomer_name').eq('pet_id', pet.id).order('date', { ascending: false }),
        supabase.from('blood_tests').select('date').eq('pet_id', pet.id).order('date', { ascending: false }),
        supabase.from('preventive_treatments').select('type, date_given, product_name').eq('pet_id', pet.id).order('date_given', { ascending: false }),
      ]);

      const allPreventives = (preventivesRes.data as PreventiveRow[]) ?? [];
      // 'combinado' counts as both antipulgas AND desparasitante for "last dose".
      const lastAnti = allPreventives.find(p => p.type === 'antipulgas' || p.type === 'combinado') ?? null;
      const lastDes = allPreventives.find(p => p.type === 'desparasitante' || p.type === 'combinado') ?? null;

      setVaccines(vaccinesRes.data ?? []);
      setWeightRecords(weightsRes.data ?? []);
      setFoods(foodsRes.data ?? []);
      setVetVisits(visitsRes.data ?? []);
      setGroomings(groomingsRes.data ?? []);
      setBloodTests(bloodTestsRes.data ?? []);
      setPreventives(allPreventives);
      setLastAntipulgas(lastAnti);
      setLastDesparasitante(lastDes);

      // Fetch co-owners if user is the owner
      if (user && pet.user_id === user.id) {
        const { data: shares } = await supabase
          .from('pet_shares')
          .select('id, shared_with, shared_with_email, shared_with_name')
          .eq('pet_id', pet.id);
        setCoOwners((shares as CoOwner[]) ?? []);
      } else {
        setCoOwners([]);
      }

      // Schedule premium-only notifications: vaccines overdue (>1y since given)
      if (isPremium && pet) {
        // Vaccine reminders — fires 1 year after each vaccine was given
        // (when "lleva más de un año sin poner vacunas"). Most recent dose
        // per vaccine name wins because the helper cancels duplicates.
        for (const v of vaccinesRes.data ?? []) {
          if (v.date_given) {
            scheduleVaccineReminder({
              petName: pet.name,
              vaccineName: v.name,
              lastGivenDate: new Date(v.date_given + 'T09:00:00'),
            }).catch(() => {});
          }
        }

        // Weight reminder — fires 30 days after the most recent weight record
        const lastWeight = weightsRes.data?.[0];
        if (lastWeight?.date) {
          scheduleWeightReminder({
            petName: pet.name,
            lastWeightDate: new Date(lastWeight.date + 'T09:00:00'),
          }).catch(() => {});
        }
      }

      // Preventive reminders — free + premium, everyone benefits. Schedule
      // one reminder per "last dose" (antipulgas, desparasitante) 1 day before
      // the next 30-day due date. For 'combinado', this fires twice (once
      // per type) because both coverage types matter.
      if (pet) {
        if (lastAnti?.date_given) {
          const nextDue = new Date(lastAnti.date_given + 'T09:00:00');
          nextDue.setDate(nextDue.getDate() + 30);
          schedulePreventiveReminder({ petName: pet.name, type: 'antipulgas', nextDueDate: nextDue }).catch(() => {});
        }
        if (lastDes?.date_given) {
          const nextDue = new Date(lastDes.date_given + 'T09:00:00');
          nextDue.setDate(nextDue.getDate() + 30);
          schedulePreventiveReminder({ petName: pet.name, type: 'desparasitante', nextDueDate: nextDue }).catch(() => {});
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

  // Memoize the context value: PetProvider passes this object straight into
  // <PetContext.Provider value={...}>. Without memo, every render of the
  // provider creates a fresh object and forces ALL consumers (dashboard
  // cards, tabs, headers) to re-render even when nothing they read changed.
  return useMemo(() => ({
    pet,
    pets,
    isOwner,
    coOwners,
    vaccines,
    weightRecords,
    foods,
    vetVisits,
    groomings,
    bloodTests,
    preventives,
    lastAntipulgas,
    lastDesparasitante,
    loading,
    error,
    refresh,
    setActivePetId,
  }), [
    pet,
    pets,
    isOwner,
    coOwners,
    vaccines,
    weightRecords,
    foods,
    vetVisits,
    groomings,
    bloodTests,
    preventives,
    lastAntipulgas,
    lastDesparasitante,
    loading,
    error,
    refresh,
  ]);
}
