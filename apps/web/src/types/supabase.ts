export interface Pet {
  id: string;
  user_id: string;
  name: string;
  breed: string | null;
  birth_date: string | null;
  gender: string | null;
  weight_kg: number | null;
  photo_url: string | null;
  chip_id: string | null;
  color: string | null;
  theme_color: string | null;
  is_neutered: boolean | null;
  birth_city: string | null;
  birth_country: string | null;
  support_type: string | null;
  vaccine_card_url: string | null;
  created_at: string;
}

export interface Vaccine {
  id: string;
  pet_id: string;
  name: string;
  date_given: string;
  next_due: string | null;
  vet_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface VetVisit {
  id: string;
  pet_id: string;
  date: string;
  reason: string;
  vet_name: string | null;
  location: string | null;
  diagnosis: string | null;
  treatment: string | null;
  cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface Grooming {
  id: string;
  pet_id: string;
  date: string;
  type: string;
  groomer_name: string | null;
  location: string | null;
  cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface Food {
  id: string;
  pet_id: string;
  brand: string;
  food_type: string | null;
  /** @deprecated use food_type */
  type: string | null;
  daily_grams: number | null;
  bag_size: number | null;
  bag_unit: string | null;
  amount_grams: number | null;
  frequency: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface Flight {
  id: string;
  pet_id: string;
  airline: string;
  flight_number: string | null;
  origin: string;
  destination: string;
  flight_date: string;
  cabin_or_cargo: string;
  ticket_price: number | null;
  crate_approved: boolean;
  vet_certificate: boolean;
  chip_verified: boolean;
  vaccines_updated: boolean;
  import_permit: boolean;
  health_certificate: boolean;
  notes: string | null;
  created_at: string;
}

export interface FlightDocument {
  id: string;
  flight_id: string;
  name: string;
  file_url: string;
  created_at: string;
}

export interface Adventure {
  id: string;
  pet_id: string;
  title: string;
  description: string | null;
  date: string;
  location: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface WeightRecord {
  id: string;
  pet_id: string;
  weight_kg: number;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  pet_id: string | null;
  type: string;
  title: string;
  message: string;
  icon: string | null;
  href: string | null;
  read: boolean;
  dismissed: boolean;
  created_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'ios' | 'android';
  created_at: string;
  updated_at: string;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan: 'free' | 'premium';
  source: 'referral' | 'iap' | 'promo' | 'trial' | null;
  premium_until: string | null;
  trial_ends_at: string | null;
  iap_product_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  uses_count: number;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  code: string;
  status: 'pending' | 'completed' | 'rewarded';
  reward_granted: boolean;
  created_at: string;
}

export interface Treat {
  id: string;
  pet_id: string;
  name: string;
  brand: string | null;
  price: number | null;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface PreventiveTreatment {
  id: string;
  pet_id: string;
  type: 'antipulgas' | 'desparasitante';
  brand: string | null;
  date_applied: string;
  next_due: string | null;
  notes: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  pet_id: string;
  date: string;
  walks: number;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
}
