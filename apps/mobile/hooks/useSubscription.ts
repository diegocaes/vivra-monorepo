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

    // Fallback: check Supabase trial/referral premium (not in RevenueCat)
    try {
      if (user) {
        const { data } = await supabase
          .from('user_subscriptions')
          .select('plan, premium_until')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.plan === 'premium' && data?.premium_until) {
          const daysLeft = Math.ceil((new Date(data.premium_until).getTime() - Date.now()) / 86400000);
          if (daysLeft > 0) {
            setIsPremium(true);
            return;
          }
        }
      }
    } catch { /* user_subscriptions may not exist */ }

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
