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

// ESTRATEGIA 2026-07: casi todo es FREE para maximizar uso y retención.
// Premium queda reducido a 2 cosas: detalle de gastos por categoría y co-dueño.
// El TOTAL de gastos es visible para todos; el desglose por categoría es premium.
export const FEATURE_GATES = {
  // Mascotas
  multiplePets: false,        // FREE — multi-mascota impulsa retención

  // Salud
  vitalityScore: false,       // FREE
  vitalityDetails: false,     // FREE — desglose por pilar, flags, recomendaciones
  weightChart: false,         // FREE — grafica de peso historica
  exportHealthPdf: false,     // FREE

  // Alimentacion
  foodTracking: false,        // FREE
  foodInventory: false,       // FREE
  costAnalysis: true,         // PREMIUM — desglose de gastos POR CATEGORÍA (el total es free)

  // Viajes
  passport: false,            // FREE
  flightDocuments: false,     // FREE
  printPassport: false,       // FREE

  // Calendario y recordatorios
  calendar: false,            // FREE
  pushNotifications: false,   // FREE

  // Social
  referrals: false,           // FREE (es el growth engine)
  badges: false,              // FREE (engagement)
  coOwnerSharing: true,       // PREMIUM — compartir mascota con co-dueno

  // Data
  dataExport: false,          // FREE
} as const;

export type Feature = keyof typeof FEATURE_GATES;

// ── Limits ──

export const LIMITS = {
  free: {
    maxPets: 10,
    maxVaccineRecords: Infinity,
    maxWeightRecords: Infinity,
    maxVetVisits: Infinity,
    maxFoods: Infinity,
    maxFlights: Infinity,
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
 * Includes co-owner sharing: if a sharing partner has premium, this user gets it too.
 */
export async function getPremiumStatus(supabase: any, userId: string): Promise<PremiumStatus> {
  try {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('plan, source, premium_until, trial_ends_at')
      .eq('user_id', userId)
      .maybeSingle();

    const ownStatus = evaluatePremium(data as UserSubscription | null);
    if (ownStatus.isPremium) return ownStatus;

    // On-load expiry defense: if a non-IAP premium has expired, demote the
    // row via a SECURITY DEFINER RPC so analytics queries / admin views stay
    // consistent. The pg_cron job does the same nightly — this is a fast-path
    // fallback for users who load the app before the cron runs.
    if (
      data &&
      data.plan === 'premium' &&
      data.source &&
      ['referral', 'trial', 'promo'].includes(data.source) &&
      data.premium_until &&
      new Date(data.premium_until).getTime() < Date.now()
    ) {
      try {
        const { error: rpcError } = await supabase.rpc('expire_my_premium_if_due');
        if (rpcError) console.warn('[premium] expire_my_premium_if_due failed:', rpcError.message);
      } catch (e: any) {
        console.warn('[premium] expire RPC threw:', e?.message ?? e);
      }
    }

    // Co-owner premium sharing: check if any sharing partner has active premium
    try {
      const { createSupabaseAdminClient } = await import('./supabase');
      const admin = createSupabaseAdminClient();
      const [sharedWithMe, myShares] = await Promise.all([
        admin.from('pet_shares').select('owner_id').eq('shared_with', userId),
        admin.from('pet_shares').select('shared_with').eq('owner_id', userId),
      ]);

      const partnerIds = new Set<string>();
      sharedWithMe.data?.forEach((s: any) => partnerIds.add(s.owner_id));
      myShares.data?.forEach((s: any) => partnerIds.add(s.shared_with));

      if (partnerIds.size > 0) {
        const { data: partnerSubs } = await admin
          .from('user_subscriptions')
          .select('plan, source, premium_until, trial_ends_at')
          .in('user_id', [...partnerIds]);

        for (const sub of partnerSubs || []) {
          const partnerStatus = evaluatePremium(sub as UserSubscription);
          if (partnerStatus.isPremium) {
            return {
              isPremium: true,
              plan: 'premium',
              source: 'shared',
              daysLeft: partnerStatus.daysLeft,
              isTrial: false,
              isExpiringSoon: partnerStatus.isExpiringSoon,
            };
          }
        }
      }
    } catch {
      // Silently ignore if pet_shares doesn't exist
    }

    return ownStatus;
  } catch {
    // Table doesn't exist yet — treat as free
    return evaluatePremium(null);
  }
}
