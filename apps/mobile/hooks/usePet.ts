import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useSubscription } from '../contexts/SubscriptionContext';
import { scheduleVaccineReminder, schedulePreventiveReminder, scheduleWeightReminder } from './useNotifications';
import type { Pet, Vaccine, WeightRecord, Food, PreventiveTreatment } from '@vivra/shared/lib/database';
import { isPetRow } from '@vivra/shared/lib/database';
import { buildVaccineOverview, friendlyError, isPreventiveType, preventiveNextDue, resolveActivePet, type PreventiveType } from '@vivra/shared';
import { captureError } from '../lib/sentry';
import { firstSupabaseFailure } from '../lib/supabaseResults';
import { loadActivePetId, saveActivePetId } from '../lib/activePetStorage';

export interface CoOwner {
  id: string;
  shared_with: string;
  shared_with_email: string | null;
  shared_with_name: string | null;
}

export type PreventiveRow = Omit<
  Pick<PreventiveTreatment, 'type' | 'date_given' | 'next_due' | 'product_name'>,
  'type'
> & { type: PreventiveType };

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
  const [preventives, setPreventives] = useState<PreventiveRow[]>([]);
  const [lastAntipulgas, setLastAntipulgas] = useState<PetData['lastAntipulgas']>(null);
  const [lastDesparasitante, setLastDesparasitante] = useState<PetData['lastDesparasitante']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const petDataRequestId = useRef(0);
  const petListRequestId = useRef(0);
  const activePetIdRef = useRef<string | null>(null);

  const pet = resolveActivePet(pets, activePetId);
  const isOwner = !!(pet && user && pet.user_id === user.id);

  const reportLoadError = useCallback((loadError: unknown, phase: string) => {
    const errorLike = typeof loadError === 'object' && loadError !== null
      ? loadError as { message?: string; code?: string }
      : { message: String(loadError) };

    console.warn(`[usePet] ${phase} failed:`, errorLike.message ?? loadError);
    captureError(loadError, { phase });
    setError(friendlyError(errorLike));
  }, []);

  const fetchPets = useCallback(async (
    preferredPetId: string | null = activePetIdRef.current,
  ): Promise<Pet | null> => {
    if (!user) return null;
    const requestId = ++petListRequestId.current;

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

    // A previous user's or refresh request's response must never replace the
    // current accessible-pet list.
    if (requestId !== petListRequestId.current) return null;

    const ownedPets = ownedRes.data ?? [];
    const sharedPets = (sharedRes.data ?? [])
      .flatMap(share => Array.isArray(share.pets) ? share.pets : [share.pets])
      .filter(isPetRow);

    const allPets = [...ownedPets, ...sharedPets];
    const selectedPet = resolveActivePet(allPets, preferredPetId);
    setPets(allPets);

    const nextPetId = selectedPet?.id ?? null;
    activePetIdRef.current = nextPetId;
    setActivePetId(nextPetId);
    void saveActivePetId(user.id, nextPetId);
    if (!selectedPet) setError(null);
    return selectedPet;
  }, [user]);

  const selectActivePet = useCallback((petId: string) => {
    if (!user || !pets.some(candidate => candidate.id === petId)) return;
    activePetIdRef.current = petId;
    setActivePetId(petId);
    void saveActivePetId(user.id, petId);
  }, [user, pets]);

  const fetchPetData = useCallback(async (targetPet: Pet) => {
    const requestId = ++petDataRequestId.current;

    try {
      const [
        vaccinesRes,
        weightsRes,
        foodsRes,
        visitsRes,
        groomingsRes,
        preventivesRes,
        coOwnersRes,
      ] = await Promise.all([
        supabase.from('vaccines').select('id, name, date_given, next_due, brand, lot_number').eq('pet_id', targetPet.id).order('date_given', { ascending: false }),
        supabase.from('weight_records').select('weight_kg, date').eq('pet_id', targetPet.id).order('date', { ascending: false }),
        supabase.from('foods').select('brand, daily_grams, bag_size, bag_unit, type, food_type, start_date, end_date, price, notes, created_at').eq('pet_id', targetPet.id).order('created_at', { ascending: false }),
        supabase.from('vet_visits').select('date, reason, location').eq('pet_id', targetPet.id).order('date', { ascending: false }),
        supabase.from('groomings').select('type, services, date, location, groomer_name').eq('pet_id', targetPet.id).order('date', { ascending: false }),
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
      const allPreventives = (preventivesRes.data ?? [])
        .filter(treatment => isPreventiveType(treatment.type))
        .map(treatment => ({
          ...treatment,
          type: treatment.type as PreventiveType,
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

  // Initial load: restore the last selection for this account before choosing
  // a fallback. This keeps owner/co-owner switching stable across app restarts.
  useEffect(() => {
    if (!user) {
      petListRequestId.current += 1;
      activePetIdRef.current = null;
      setActivePetId(null);
      setPets([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    loadActivePetId(user.id)
      .then((storedPetId) => {
        if (cancelled) return null;
        activePetIdRef.current = storedPetId;
        setActivePetId(storedPetId);
        return fetchPets(storedPetId);
      })
      .catch(loadError => reportLoadError(loadError, 'pets_load'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      petListRequestId.current += 1;
    };
  }, [user?.id, fetchPets, reportLoadError]);

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
    preventives,
    lastAntipulgas,
    lastDesparasitante,
    loading,
    error,
    refresh,
    setActivePetId: selectActivePet,
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
    preventives,
    lastAntipulgas,
    lastDesparasitante,
    loading,
    error,
    refresh,
    selectActivePet,
  ]);
}
