import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import Purchases, { type PurchasesPackage, type CustomerInfo } from 'react-native-purchases';
import { REVENUECAT_API_KEY, ENTITLEMENT_ID } from '../constants/revenueCat';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

interface SubscriptionState {
  isPremium: boolean;
  isLoading: boolean;
  packages: PurchasesPackage[];
  currentOffering: string | null;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

// Tracks the RevenueCat-configured user. Cleared on signOut to prevent stale
// state when switching accounts on the same device.
let configuredUserId: string | null = null;
export function clearRevenueCatUser() {
  configuredUserId = null;
}

/**
 * Mirror RevenueCat entitlement state to Supabase user_subscriptions.
 * Called after purchase / restore / customerInfo updates so web and analytics
 * see consistent premium status. Best-effort: failure here doesn't block the
 * user — RevenueCat is the source of truth for IAP, this is just sync.
 */
async function syncIapPremiumToSupabase(info: CustomerInfo) {
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];

  try {
    if (entitlement) {
      // Active IAP: write premium_until to Supabase
      // expirationDate is ISO string when set; null for lifetime entitlements.
      // Default to ~1 year out if missing (lifetime / no expiry available).
      const expiration = entitlement.expirationDate
        ? entitlement.expirationDate
        : new Date(Date.now() + 365 * 86400000).toISOString();

      const { error } = await supabase.rpc('set_iap_premium', {
        p_premium_until: expiration,
        p_iap_product_id: entitlement.productIdentifier ?? null,
      });
      if (error) console.warn('[useSubscription] set_iap_premium error:', error.message);
    } else {
      // No active IAP: clear any stale 'iap' rows in Supabase
      const { error } = await supabase.rpc('clear_iap_premium');
      if (error) console.warn('[useSubscription] clear_iap_premium error:', error.message);
    }
  } catch (e: any) {
    console.warn('[useSubscription] iap sync threw:', e?.message ?? e);
  }
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [currentOffering, setCurrentOffering] = useState<string | null>(null);

  // Initialize RevenueCat
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!user) { setIsLoading(false); return; }

      // Only reconfigure if user changed
      if (configuredUserId !== user.id) {
        try {
          Purchases.configure({
            apiKey: REVENUECAT_API_KEY,
            appUserID: user.id,
          });
          configuredUserId = user.id;
        } catch (e) {
          console.error('RevenueCat init error:', e);
          if (!cancelled) setIsLoading(false);
          return;
        }
      }

      try {
        await checkSubscription();
        if (!cancelled) await loadOfferings();
      } catch (e) {
        console.error('RevenueCat load error:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [user]);

  // Listen for subscription changes (real-time RevenueCat events)
  useEffect(() => {
    if (!configuredUserId) return;

    const handler = (info: CustomerInfo) => {
      const premium = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPremium(premium);
      // Mirror state change to Supabase so web + analytics stay consistent.
      syncIapPremiumToSupabase(info);
    };

    Purchases.addCustomerInfoUpdateListener(handler);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(handler);
    };
  }, [user]);

  const checkSubscription = useCallback(async () => {
    // 1. Check RevenueCat (paid IAP entitlement) — source of truth for IAP
    let rcInfo: CustomerInfo | null = null;
    try {
      rcInfo = await Purchases.getCustomerInfo();
      const rcPremium = rcInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      if (rcPremium) {
        setIsPremium(true);
        // Sync to Supabase so web sees the same state
        syncIapPremiumToSupabase(rcInfo);
        return;
      }
    } catch (e: any) {
      console.warn('[useSubscription] RevenueCat getCustomerInfo failed:', e?.message ?? e);
    }

    if (!user) { setIsPremium(false); return; }

    // If RC says no IAP, opportunistically clear any stale 'iap' Supabase row.
    // Cheap RPC, idempotent.
    if (rcInfo && !rcInfo.entitlements.active[ENTITLEMENT_ID]) {
      syncIapPremiumToSupabase(rcInfo);
    }

    // 2. Own Supabase subscription row (referral / trial / promo)
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('plan, source, premium_until')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[useSubscription] user_subscriptions read error:', error.message);
      } else if (data?.plan === 'premium' && data?.premium_until) {
        const until = new Date(data.premium_until).getTime();
        const daysLeft = Math.ceil((until - Date.now()) / 86400000);
        if (daysLeft > 0) {
          setIsPremium(true);
          return;
        }
        // On-load expiry defense (R7b): if a non-IAP premium has expired,
        // ask the server to demote the row. Uses SECURITY DEFINER RPC because
        // user_subscriptions is RLS-protected and authenticated users cannot
        // UPDATE directly. Idempotent with the nightly pg_cron job.
        if (data.source && ['referral', 'trial', 'promo'].includes(data.source)) {
          const { error: rpcError } = await supabase.rpc('expire_my_premium_if_due');
          if (rpcError) {
            console.warn('[useSubscription] expire_my_premium_if_due failed:', rpcError.message);
          }
        }
      }
    } catch (e: any) {
      console.warn('[useSubscription] user_subscriptions check threw:', e?.message ?? e);
    }

    // 3. Co-owner inherited premium: any sharing partner with active premium
    //    grants this user premium too. Mirrors web's evaluatePremiumWithSharing.
    try {
      const [sharedWithMe, myShares] = await Promise.all([
        supabase.from('pet_shares').select('owner_id').eq('shared_with', user.id),
        supabase.from('pet_shares').select('shared_with').eq('owner_id', user.id),
      ]);

      if (sharedWithMe.error) console.warn('[useSubscription] pet_shares (shared_with) error:', sharedWithMe.error.message);
      if (myShares.error) console.warn('[useSubscription] pet_shares (owner_id) error:', myShares.error.message);

      const partnerIds = new Set<string>();
      sharedWithMe.data?.forEach((s: any) => s.owner_id && partnerIds.add(s.owner_id));
      myShares.data?.forEach((s: any) => s.shared_with && partnerIds.add(s.shared_with));

      if (partnerIds.size > 0) {
        const { data: partnerSubs, error: partnerErr } = await supabase
          .from('user_subscriptions')
          .select('plan, premium_until')
          .in('user_id', [...partnerIds]);

        if (partnerErr) console.warn('[useSubscription] partner subs error:', partnerErr.message);

        const now = Date.now();
        const sharedPremium = (partnerSubs || []).some(
          (sub: any) => sub.plan === 'premium' && sub.premium_until && new Date(sub.premium_until).getTime() > now,
        );
        if (sharedPremium) {
          setIsPremium(true);
          return;
        }
      }
    } catch (e: any) {
      console.warn('[useSubscription] pet_shares check threw:', e?.message ?? e);
    }

    setIsPremium(false);
  }, [user]);

  const loadOfferings = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setCurrentOffering(offerings.current.identifier);
        setPackages(offerings.current.availablePackages);
      }
    } catch (e) {
      console.error('Load offerings error:', e);
    }
  }, []);

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const premium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPremium(premium);
      // Mirror to Supabase immediately so web + analytics see it
      await syncIapPremiumToSupabase(customerInfo);
      return premium;
    } catch (e: any) {
      if (e.userCancelled) return false;
      console.error('Purchase error:', e);
      Alert.alert('Error de compra', 'No se pudo completar la compra. Intenta de nuevo.');
      return false;
    }
  }, []);

  const restore = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      const premium = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPremium(premium);
      // Sync restored state to Supabase
      await syncIapPremiumToSupabase(info);
      return premium;
    } catch (e) {
      console.error('Restore error:', e);
      return false;
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await checkSubscription();
    await loadOfferings();
    setIsLoading(false);
  }, [checkSubscription, loadOfferings]);

  return { isPremium, isLoading, packages, currentOffering, purchase, restore, refresh };
}
