import type { Json, Tables, TablesInsert, TablesUpdate } from './database.types';

export type { Database, Json, Tables, TablesInsert, TablesUpdate } from './database.types';

export type JsonObject = { [key: string]: Json | undefined };

/** Safely narrows JSON returned by Supabase functions before reading fields. */
export function asJsonObject(value: Json | null): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

/** Canonical row types generated from the live Supabase `public` schema. */
export type ActivityLog = Tables<'activity_logs'>;
export type Adventure = Tables<'adventures'>;
export type FlightDocument = Tables<'flight_documents'>;
export type Flight = Tables<'flights'>;
export type Food = Tables<'foods'>;
export type Grooming = Tables<'groomings'>;
export type Notification = Tables<'notifications'>;
export type PetShareInvite = Tables<'pet_share_invites'>;
export type PetShare = Tables<'pet_shares'>;
export type Pet = Tables<'pets'>;
export type PreventiveTreatment = Tables<'preventive_treatments'>;
export type PushToken = Tables<'push_tokens'>;
export type ReferralCode = Tables<'referral_codes'>;
export type Referral = Tables<'referrals'>;
export type Treat = Tables<'treats'>;
export type UserSubscription = Tables<'user_subscriptions'>;
export type Vaccine = Tables<'vaccines'>;
export type VetVisit = Tables<'vet_visits'>;
export type WeightRecord = Tables<'weight_records'>;

/** Validates nested `pets(*)` relation results before they enter app state. */
export function isPetRow(value: unknown): value is Pet {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as { id?: unknown; user_id?: unknown; name?: unknown };
  return typeof candidate.id === 'string'
    && typeof candidate.user_id === 'string'
    && typeof candidate.name === 'string';
}

/** Canonical insert/update helpers for code that writes complete records. */
export type PetInsert = TablesInsert<'pets'>;
export type PetUpdate = TablesUpdate<'pets'>;
export type FlightInsert = TablesInsert<'flights'>;
export type FlightUpdate = TablesUpdate<'flights'>;
export type VaccineInsert = TablesInsert<'vaccines'>;
export type VaccineUpdate = TablesUpdate<'vaccines'>;
export type PreventiveTreatmentInsert = TablesInsert<'preventive_treatments'>;
export type PreventiveTreatmentUpdate = TablesUpdate<'preventive_treatments'>;
