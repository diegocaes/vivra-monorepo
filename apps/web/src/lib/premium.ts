/**
 * Vivra Premium — Centralized premium/free gating logic
 *
 * This module is the SINGLE SOURCE OF TRUTH for what's free and what's premium.
 * Used by both web (Astro SSR) and will be used by iOS (React Native) since it's pure TS.
 *
 * To change what's gated: edit FEATURE_GATES and LIMITS below.
 * To test premium locally: set FORCE_PREMIUM=true in .env
 */

// ── Types ──

export interface UserSubscription {
  plan: 'free' | 'premium';
  source: 'referral' | 'iap' | 'promo' | 'trial' | null;
  premium_until: string | null;
  trial_ends_at: string | null;
}

export interface PremiumStatus {
  isPremium: boolean;
  plan: 'free' | 'premium';
  source: string | null;
  daysLeft: number;
  isTrial: boolean;
  isExpiringSoon: boolean; // ≤3 days left
}

// ── Feature gates ──
// true = requires premium. Change a value to toggle gating on/off.

export const FEATURE_GATES = {
  // Mascotas
  multiplePets: true,         // Mas de 1 mascota

  // Salud
  vitalityScore: false,       // Score basico: FREE para todos
  vitalityDetails: true,      // Desglose por pilar, flags, recomendaciones
  weightChart: true,          // Grafica de peso historica
  exportHealthPdf: true,      // Exportar historial en PDF

  // Alimentacion
  foodTracking: false,        // Registrar comida: FREE
  foodInventory: true,        // Inventario avanzado, alertas de stock
  costAnalysis: true,         // Costo por dia, analytics

  // Viajes
  passport: false,            // Pasaporte basico: FREE
  flightDocuments: true,      // Subir documentos de vuelo
  printPassport: true,        // Imprimir pasaporte

  // Calendario y recordatorios
  calendar: false,            // Calendario basico: FREE
  pushNotifications: true,    // Notificaciones push (iOS)

  // Social
  referrals: false,           // Sistema de referidos: FREE (es el growth engine)
  badges: false,              // Insignias: FREE (engagement)

  // Data
  dataExport: true,           // Exportar todos los datos
} as const;

export type Feature = keyof typeof FEATURE_GATES;

// ── Limits ──

export const LIMITS = {
  free: {
    maxPets: 1,
    maxVaccineRecords: 20,
    maxWeightRecords: 6,
    maxVetVisits: 10,
    maxFoods: 1,
    maxFlights: 1,
  },
  premium: {
    maxPets: 10,
    maxVaccineRecords: Infinity,
    maxWeightRecords: Infinity,
    maxVetVisits: Infinity,
    maxFoods: Infinity,
    maxFlights: Infinity,
  },
} as const;

export type LimitKey = keyof typeof LIMITS.free;

// ── Core logic ──

/**
 * Evaluate premium status from a subscription record.
 * Pure function — no DB calls, works anywhere (web, iOS, tests).
 */
export function evaluatePremium(sub: UserSubscription | null): PremiumStatus {
  // Force premium for local testing (works in Astro/Vite and React Native)
  try {
    const forcePremium =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.FORCE_PREMIUM === 'true') ||
      (typeof process !== 'undefined' && (process as any).env?.FORCE_PREMIUM === 'true');
    if (forcePremium) {
      return { isPremium: true, plan: 'premium', source: 'promo', daysLeft: 999, isTrial: false, isExpiringSoon: false };
    }
  } catch { /* ignore in environments where neither is available */ }

  if (!sub || sub.plan !== 'premium' || !sub.premium_until) {
    return { isPremium: false, plan: 'free', source: null, daysLeft: 0, isTrial: false, isExpiringSoon: false };
  }

  const now = Date.now();
  const until = new Date(sub.premium_until).getTime();
  const daysLeft = Math.max(0, Math.ceil((until - now) / (1000 * 60 * 60 * 24)));

  if (daysLeft <= 0) {
    return { isPremium: false, plan: 'free', source: sub.source, daysLeft: 0, isTrial: false, isExpiringSoon: false };
  }

  const isTrial = sub.source === 'trial' && !!sub.trial_ends_at;

  return {
    isPremium: true,
    plan: 'premium',
    source: sub.source,
    daysLeft,
    isTrial,
    isExpiringSoon: daysLeft <= 3,
  };
}

/**
 * Check if a specific feature is accessible.
 */
export function canAccess(feature: Feature, premium: PremiumStatus): boolean {
  if (!FEATURE_GATES[feature]) return true; // Feature is free
  return premium.isPremium;
}

/**
 * Get the limit for a specific resource.
 */
export function getLimit(key: LimitKey, premium: PremiumStatus): number {
  return premium.isPremium ? LIMITS.premium[key] : LIMITS.free[key];
}

/**
 * Check if user is at or over a limit.
 */
export function isAtLimit(key: LimitKey, currentCount: number, premium: PremiumStatus): boolean {
  const limit = getLimit(key, premium);
  return currentCount >= limit;
}

// ── Supabase helper (server-side only) ──

/**
 * Fetch premium status from Supabase. Use in Astro pages/layouts.
 */
export async function getPremiumStatus(supabase: any, userId: string): Promise<PremiumStatus> {
  try {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('plan, source, premium_until, trial_ends_at')
      .eq('user_id', userId)
      .maybeSingle();

    return evaluatePremium(data as UserSubscription | null);
  } catch {
    // Table doesn't exist yet — treat as free
    return evaluatePremium(null);
  }
}
