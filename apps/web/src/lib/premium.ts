/**
 * Vivra Premium — Centralized premium/free gating logic
 *
 * This module is the SINGLE SOURCE OF TRUTH for what's free and what's premium.
 * Used by both web (Astro SSR) and will be used by iOS (React Native) since it's pure TS.
 *
 * To change what's gated: edit FEATURE_GATES below.
 * To test premium locally: set FORCE_PREMIUM=true in .env
 */

// ── Types ──

export interface UserSubscription {
  plan: 'free' | 'premium';
  source: 'referral' | 'iap' | 'promo' | 'trial' | 'web' | 'shared' | null;
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
// true = requires premium. Everything not listed here is free.

// ESTRATEGIA 2026-07: casi todo es FREE para maximizar uso y retención.
// Premium: co-dueño, detalle de gastos (desglose por categoría Y totales por
// sección como "total gastado en alimentación/vet/vuelos") y colores de tema
// (naranja y azul free, el resto premium). El TOTAL general es free.
export const FEATURE_GATES = {
  costAnalysis: true,         // PREMIUM — desglose por categoría + totales por sección (el total general es free)
  themeColors: true,          // PREMIUM — colores de tema más allá de naranja y azul
  coOwnerSharing: true,       // PREMIUM — compartir mascota con co-dueño
} as const;

export type Feature = keyof typeof FEATURE_GATES;

// Tope de cordura por cuenta (aplica igual a free y premium, solo anti-abuso)
export const MAX_PETS = 10;

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

  // Fecha corrupta/no parseable → getTime() es NaN, y NaN falla TODA comparación
  // (incluida `daysLeft <= 0`), así que sin esta guarda el flujo caía hasta el
  // final y devolvía isPremium: true. Un dato malo regalaba premium para siempre.
  if (!Number.isFinite(until)) {
    return { isPremium: false, plan: 'free', source: sub.source, daysLeft: 0, isTrial: false, isExpiringSoon: false };
  }

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
