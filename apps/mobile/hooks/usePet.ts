import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useSubscription } from '../contexts/SubscriptionContext';
import { scheduleVaccineReminder, schedulePreventiveReminder, scheduleWeightReminder } from './useNotifications';
import type { Pet, Vaccine, WeightRecord, Food, PreventiveTreatment } from '../types/supabase';
import { buildVaccineOverview, friendlyError, preventiveNextDue } from '@vivra/shared';
import { captureError } from '../lib/sentry';
import { firstSupabaseFailure } from '../lib/supabaseResults';

export interface CoOwner {
  id: string;
  shared_with: string;
  shared_with_email: string | null;
  shared_with_name: string | null;
}

export type PreventiveRow = Pick<PreventiveTreatment, 'type' | 'date_given' | 'next_due' | 'product_name'>;

export interface PetData {
  pet: Pet | null;
  pets: Pet[];
  isOwner: boolean;
  coOwners: CoOwner[];
  vaccines: Pick<Vaccine, 'id' | 'name' | 'date_given' | 'next_due' | 'brand' | 'lot_number'>[];
  weightRecords: Pick<WeightRecord, 'weight_kg' | 'date'>[];
  foods: Pick<Food, 'brand' | 'daily_grams' | 'bag_size' | 'bag_unit' | 'type' | 'food_type' | 'start_date' | 'end_date' | 'price' | 'notes' | 'created_at'>[];
  vetVisits: { date: string; reason: string; location: string | null }[];
  groomings: { type: string; services: string[] | null; date: string; location: string | null; groomer_name: string | null }[];
  /** Blood test records sorted by date desc. Used for the vitality score bonus + reminder. */
  bloodTests: { date: string }[];
  /** All preventives sorted by date_given desc. 'combinado' counts as both antipulgas + desparasitante. */
  preventives: PreventiveRow[];
  lastAntipulgas: { date_given: string; next_due: string | null; product_name: string | null } | null;
  lastDesparasitante: { date_given: string; next_due: string | null; product_name: string | null } | null;
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
  const petDataRequestId = useRef(0);

  const pet = pets.find(p => p.id === activePetId) ?? pets[0] ?? null;
  const isOwner = !!(pet && user && pet.user_id === user.id);

  const reportLoadError = useCallback((loadError: unknown, phase: string) => {
    const errorLike = typeof loadError === 'object' && loadError !== null
      ? loadError as { message?: string; code?: string }
      : { message: String(loadError) };

    console.warn(`[usePet] ${phase} failed:`, errorLike.message ?? loadError);
    captureError(loadError, { phase });
    setError(friendlyError(errorLike));
  }, []);

  const fetchPets = useCallback(async (): Promise<Pet | null> => {
    if (!user) return null;

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

    const failure = firstSupabaseFailure([
      { name: 'mascotas propias', error: ownedRes.error },
      { name: 'mascotas compartidas', error: sharedRes.error },
    ]);
    if (failure?.error) {
      throw Object.assign(
        new Error(`${failure.name}: ${failure.error.message}`, { cause: failure.error }),
        { code: failure.error.code },
      );
    }

    const ownedPets = (ownedRes.data as Pet[]) ?? [];
    const sharedPets = (sharedRes.data ?? [])
      .map((s: any) => s.pets)
      .filter(Boolean) as Pet[];

    const allPets = [...ownedPets, ...sharedPets];
    const selectedPet = allPets.find(candidate => candidate.id === activePetId) ?? allPets[0] ?? null;
    setPets(allPets);

    setActivePetId(selectedPet?.id ?? null);
    if (!selectedPet) setError(null);
    return selectedPet;
  }, [user, activePetId]);

  const fetchPetData = useCallback(async (targetPet: Pet) => {
    const requestId = ++petDataRequestId.current;

    try {
      const [
        vaccinesRes,
        weightsRes,
        foodsRes,
        visitsRes,
        groomingsRes,
        bloodTestsRes,
        preventivesRes,
        coOwnersRes,
      ] = await Promise.all([
        supabase.from('vaccines').select('id, name, date_given, next_due, brand, lot_number').eq('pet_id', targetPet.id).order('date_given', { ascending: false }),
        supabase.from('weight_records').select('weight_kg, date').eq('pet_id', targetPet.id).order('date', { ascending: false }),
        supabase.from('foods').select('brand, daily_grams, bag_size, bag_unit, type, food_type, start_date, end_date, price, notes, created_at').eq('pet_id', targetPet.id).order('created_at', { ascending: false }),
        supabase.from('vet_visits').select('date, reason, location').eq('pet_id', targetPet.id).order('date', { ascending: false }),
        supabase.from('groomings').select('type, services, date, location, groomer_name').eq('pet_id', targetPet.id).order('date', { ascending: false }),
        supabase.from('blood_tests').select('date').eq('pet_id', targetPet.id).order('date', { ascending: false }),
        supabase.from('preventive_treatments').select('type, date_given, next_due, product_name').eq('pet_id', targetPet.id).order('date_given', { ascending: false }),
        user && targetPet.user_id === user.id
          ? supabase
              .from('pet_shares')
              .select('id, shared_with, shared_with_email, shared_with_name')
              .eq('pet_id', targetPet.id)
          : Promise.resolve({ data: [] as CoOwner[], error: null }),
      ]);

      const failure = firstSupabaseFailure([
        { name: 'vacunas', error: vaccinesRes.error },
        { name: 'peso', error: weightsRes.error },
        { name: 'alimentación', error: foodsRes.error },
        { name: 'visitas veterinarias', error: visitsRes.error },
        { name: 'grooming', error: groomingsRes.error },
        { name: 'exámenes', error: bloodTestsRes.error },
        { name: 'preventivos', error: preventivesRes.error },
        { name: 'personas compartidas', error: coOwnersRes.error },
      ]);
      if (failure?.error) {
        if (requestId !== petDataRequestId.current) return;
        throw Object.assign(
          new Error(`${failure.name}: ${failure.error.message}`, { cause: failure.error }),
          { code: failure.error.code },
        );
      }

      // A response for a previously selected pet must never overwrite the
      // current pet while the user is switching tabs or profiles quickly.
      if (requestId !== petDataRequestId.current) return;

      // Dog records created before next_due existed still represent real
      // applications. Apply the monthly dog default here so the Home and its
      // reminder cards cannot incorrectly say “Sin registro”.
      const allPreventives = ((preventivesRes.data as PreventiveRow[]) ?? []).map(treatment => ({
        ...treatment,
        next_due: preventiveNextDue(targetPet.species, treatment.date_given, treatment.next_due),
      }));
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
      setCoOwners((coOwnersRes.data as CoOwner[]) ?? []);
      setError(null);

      // Schedule one reminder per vaccine, only from a confirmed next date.
      if (isPremium) {
        // Un recordatorio por VACUNA, no por dosis. Las filas vienen ordenadas
        // por date_given DESC, así que la primera de cada nombre es la más
        // reciente. Sin esto, 3 dosis de "Rabia" programaban 3 avisos
        // idénticos para el mismo día.
        const vacunasMasRecientes = buildVaccineOverview(vaccinesRes.data ?? []).latestByName;
        for (const vacuna of vacunasMasRecientes) {
          scheduleVaccineReminder({
            petName: targetPet.name,
            vaccineName: vacuna.name,
            nextDueDate: vacuna.next_due ? new Date(`${vacuna.next_due}T09:00:00`) : null,
          }).catch(() => {});
        }

        // Weight reminder — fires 30 days after the most recent weight record
        const lastWeight = weightsRes.data?.[0];
        if (lastWeight?.date) {
          scheduleWeightReminder({
            petName: targetPet.name,
            lastWeightDate: new Date(`${lastWeight.date}T09:00:00`),
          }).catch(() => {});
        }
      }

      // Preventive reminders use the due date confirmed by the owner or vet.
      // Never invent a medical interval from the last application date.
      if (lastAnti?.next_due) {
        schedulePreventiveReminder({ petName: targetPet.name, type: 'antipulgas', nextDueDate: new Date(`${lastAnti.next_due}T09:00:00`) }).catch(() => {});
      }
      if (lastDes?.next_due) {
        schedulePreventiveReminder({ petName: targetPet.name, type: 'desparasitante', nextDueDate: new Date(`${lastDes.next_due}T09:00:00`) }).catch(() => {});
      }
    } catch (loadError) {
      if (requestId !== petDataRequestId.current) return;
      throw loadError;
    }
  }, [user, isPremium]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const selectedPet = await fetchPets();
      if (selectedPet) await fetchPetData(selectedPet);
    } catch (loadError) {
      reportLoadError(loadError, 'refresh');
    } finally {
      setLoading(false);
    }
  }, [fetchPets, fetchPetData, reportLoadError]);

  // Initial load: fetch pets
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchPets()
      .catch(loadError => reportLoadError(loadError, 'pets_load'))
      .finally(() => setLoading(false));
  }, [user]);

  // When active pet changes, fetch its data
  useEffect(() => {
    if (!pet) return;
    setLoading(true);
    fetchPetData(pet)
      .catch(loadError => reportLoadError(loadError, 'pet_data_load'))
      .finally(() => setLoading(false));
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
