import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
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

let configuredUserId: string | null = null;

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

  // Listen for subscription changes
  useEffect(() => {
    if (!configuredUserId) return;

    const handler = (info: CustomerInfo) => {
      const premium = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      setIsPremium(premium);
    };

    Purchases.addCustomerInfoUpdateListener(handler);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(handler);
    };
  }, [user]);

  const checkSubscription = useCallback(async () => {
    // 1. Check RevenueCat (paid IAP entitlement)
    try {
      const info = await Purchases.getCustomerInfo();
      const rcPremium = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      if (rcPremium) {
        setIsPremium(true);
        return;
      }
    } catch (e) {
      console.error('Check subscription error:', e);
    }

    if (!user) { setIsPremium(false); return; }

    // 2. Own Supabase subscription row (referral / trial / promo)
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('plan, source, premium_until')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data?.plan === 'premium' && data?.premium_until) {
        const until = new Date(data.premium_until).getTime();
        const daysLeft = Math.ceil((until - Date.now()) / 86400000);
        if (daysLeft > 0) {
          setIsPremium(true);
          return;
        }
        // On-load expiry defense (R7b): if a non-IAP premium has expired,
        // demote the row locally so DB stays consistent with reality. The
        // pg_cron job (R7a) does the same nightly — this is a fallback.
        if (data.source && ['referral', 'trial', 'promo'].includes(data.source)) {
          await supabase
            .from('user_subscriptions')
            .update({ plan: 'free', source: null, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .lt('premium_until', new Date().toISOString());
        }
      }
    } catch { /* user_subscriptions may not exist yet — ignore */ }

    // 3. Co-owner inherited premium: any sharing partner with active premium
    //    grants this user premium too. Mirrors web's evaluatePremiumWithSharing.
    try {
      const [sharedWithMe, myShares] = await Promise.all([
        supabase.from('pet_shares').select('owner_id').eq('shared_with', user.id),
        supabase.from('pet_shares').select('shared_with').eq('owner_id', user.id),
      ]);

      const partnerIds = new Set<string>();
      sharedWithMe.data?.forEach((s: any) => s.owner_id && partnerIds.add(s.owner_id));
      myShares.data?.forEach((s: any) => s.shared_with && partnerIds.add(s.shared_with));

      if (partnerIds.size > 0) {
        const { data: partnerSubs } = await supabase
          .from('user_subscriptions')
          .select('plan, premium_until')
          .in('user_id', [...partnerIds]);

        const now = Date.now();
        const sharedPremium = (partnerSubs || []).some(
          (sub: any) => sub.plan === 'premium' && sub.premium_until && new Date(sub.premium_until).getTime() > now,
        );
        if (sharedPremium) {
          setIsPremium(true);
          return;
        }
      }
    } catch { /* pet_shares may not exist yet — ignore */ }

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
