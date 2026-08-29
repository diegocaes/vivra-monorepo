import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import Purchases, { type PurchasesPackage, type CustomerInfo } from 'react-native-purchases';
import { ENTITLEMENT_ID } from '../constants/revenueCat';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import {
  canUseNativeRevenueCat,
  getRevenueCatUserId,
  identifyRevenueCatUser,
} from '../lib/revenueCatSession';

interface SubscriptionState {
  isPremium: boolean;
  isLoading: boolean;
  packages: PurchasesPackage[];
  currentOffering: string | null;
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export type { SubscriptionState };

/**
 * Estado real de la suscripción. NO usar directamente en pantallas: montarlo
 * varias veces dispara RevenueCat + 3-4 queries por pantalla y deja `isPremium`
 * inconsistente entre ellas durante segundos (un usuario que pagó podía ver
 * features bloqueadas). Se monta UNA sola vez en SubscriptionProvider; las
 * pantallas consumen el contexto vía `useSubscription()`.
 */
export function useSubscriptionState(): SubscriptionState {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [currentOffering, setCurrentOffering] = useState<string | null>(null);

  // Initialize RevenueCat.
  // No se pueden agregar `checkSubscription`/`loadOfferings` a las deps: son
  // consts declarados más abajo y el array se evalúa durante el render, así que
  // referenciarlos acá lanzaría un ReferenceError por TDZ. El efecto sí puede
  // llamarlos porque su cuerpo corre después del render.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!user) { setIsLoading(false); return; }

      // Configure once, then identify the authenticated Supabase user with
      // RevenueCat's supported logIn flow. This prevents entitlements from a
      // previous account being shown on a shared device.
      if (canUseNativeRevenueCat() && getRevenueCatUserId() !== user.id) {
        try {
          await identifyRevenueCatUser(user.id);
        } catch (e) {
          console.error('RevenueCat init error:', e);
          // RevenueCat being temporarily unavailable must not hide Premium
          // bought on the web, earned by referral, or shared by a co-owner.
          // checkSubscription falls back to the server-side Supabase state.
        }
      }

      try {
        await checkSubscription();
        if (!cancelled && canUseNativeRevenueCat()) await loadOfferings();
      } catch (e) {
        console.error('RevenueCat load error:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [user]);

  // Listen for subscription changes (real-time RevenueCat events).
  // `user` va en las deps a propósito: al cambiar de cuenta hay que
  // re-registrar el listener contra el nuevo usuario configurado en RevenueCat.
  useEffect(() => {
    if (!canUseNativeRevenueCat() || !getRevenueCatUserId()) return;

    const handler = (info: CustomerInfo) => {
      const premium = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      if (premium) {
        setIsPremium(true);
      } else {
        // A RevenueCat "not active" update only answers the Apple-IAP part of
        // the question. Re-evaluate web/referral/promo/shared access before
        // marking the whole account free.
        void checkSubscription();
      }
      // The server receives RevenueCat's signed webhook. Never let a mobile
      // client write its own entitlement or expiry into Supabase.
    };

    Purchases.addCustomerInfoUpdateListener(handler);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(handler);
    };
  }, [user]);

  const checkSubscription = useCallback(async () => {
    // 1. Check RevenueCat (paid IAP entitlement) — source of truth for IAP
    if (canUseNativeRevenueCat()) {
      try {
        const rcInfo = await Purchases.getCustomerInfo();
        const rcPremium = rcInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
        if (rcPremium) {
          setIsPremium(true);
          return;
        }
      } catch (e: any) {
        console.warn('[useSubscription] RevenueCat getCustomerInfo failed:', e?.message ?? e);
      }
    }

    if (!user) { setIsPremium(false); return; }

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

    // 3. Co-owner inherited premium. A narrow SECURITY DEFINER RPC returns
    //    only the effective date; clients never read a partner's billing row.
    try {
      const { data: sharedUntil, error: sharedError } = await supabase.rpc('get_shared_premium_until');
      if (sharedError) {
        console.warn('[useSubscription] shared premium check failed:', sharedError.message);
      } else if (sharedUntil && new Date(sharedUntil as string).getTime() > Date.now()) {
        setIsPremium(true);
        return;
      }
    } catch (e: any) {
      console.warn('[useSubscription] pet_shares check threw:', e?.message ?? e);
    }

    setIsPremium(false);
  }, [user]);

  const loadOfferings = useCallback(async () => {
    if (!canUseNativeRevenueCat()) {
      setCurrentOffering(null);
      setPackages([]);
      return;
    }

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
    if (!canUseNativeRevenueCat()) return false;

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
    if (!canUseNativeRevenueCat()) return false;

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

  // Memoizado: el valor va a un Context, así que una identidad nueva en cada
  // render re-renderizaría a TODOS los consumidores sin que nada haya cambiado.
  return useMemo(
    () => ({ isPremium, isLoading, packages, currentOffering, purchase, restore, refresh }),
    [isPremium, isLoading, packages, currentOffering, purchase, restore, refresh],
  );
}
