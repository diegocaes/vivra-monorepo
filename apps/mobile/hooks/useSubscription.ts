import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import Purchases, {
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';
import { ENTITLEMENT_ID, PAYWALL_OFFERING_ID } from '../constants/revenueCat';
import { resolvePremiumAccess } from '../lib/premiumResolution';
import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';
import {
  canUseNativeRevenueCat,
  getRevenueCatUserId,
  identifyRevenueCatUser,
} from '../lib/revenueCatSession';

interface SubscriptionState {
  isPremium: boolean;
  error: string | null;
  isLoading: boolean;
  packages: PurchasesPackage[];
  currentOffering: string | null;
  paywallOffering: PurchasesOffering | null;
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
  const [error, setError] = useState<string | null>(null);
  const lastKnown = useRef({ premium: false, checkedAt: 0 });
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [currentOffering, setCurrentOffering] = useState<string | null>(null);
  const [paywallOffering, setPaywallOffering] = useState<PurchasesOffering | null>(null);

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

      if (cancelled) return;
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
    if (!canUseNativeRevenueCat() || !user) return;
    // Read the current, identified customer instead of trusting an event that
    // may have been emitted during a different account's login.
    const handler = () => {
      if (getRevenueCatUserId() === user.id) void checkSubscription();
    };

    Purchases.addCustomerInfoUpdateListener(handler);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(handler);
    };
  }, [user]);

  const checkSubscription = useCallback(async (): Promise<boolean> => {
    const checkId = ++request.current;
    if (!user) { setIsPremium(false); return false; }
    const result = await resolvePremiumAccess([
      async () => {
        if (!canUseNativeRevenueCat()) return false;
        if (getRevenueCatUserId() !== user.id) await identifyRevenueCatUser(user.id);
        if (getRevenueCatUserId() !== user.id) throw new Error('Subscription account changed');
        const info = await Purchases.getCustomerInfo();
        if (getRevenueCatUserId() !== user.id) throw new Error('Subscription account changed');
        return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      },
      async () => {
        const { data, error: readError } = await supabase.from('user_subscriptions')
          .select('plan, source, premium_until').eq('user_id', user.id).maybeSingle();
        if (readError) throw readError;
        return data?.plan === 'premium' && !!data.premium_until
          && new Date(data.premium_until).getTime() > Date.now();
      },
      async () => {
        const { data, error: readError } = await supabase.rpc('get_shared_premium_until');
        if (readError) throw readError;
        return !!data && new Date(data as string).getTime() > Date.now();
      },
    ]);
    if (checkId !== request.current) return false;
    if (result === null) {
      setError('No pudimos comprobar tu suscripción. Revisa la conexión e intenta de nuevo.');
      // Brief, account-scoped grace for a previously verified session. Unknown
      // access never becomes a purchase prompt or a permanent Premium grant.
      const cached = lastKnown.current.premium && Date.now() - lastKnown.current.checkedAt < 300_000;
      setIsPremium(cached);
      return cached;
    }
    lastKnown.current = { premium: result, checkedAt: Date.now() };
    setError(null);
    setIsPremium(result);
    return result;
  }, [user]);

  const loadOfferings = useCallback(async () => {
    if (!canUseNativeRevenueCat()) {
      setCurrentOffering(null);
      setPaywallOffering(null);
      setPackages([]);
      return;
    }

    try {
      const offerings = await Purchases.getOfferings();
      // The new RevenueCat paywall is deliberately attached to an isolated
      // Offering. If it is unavailable for any reason, the existing `default`
      // Offering and the hand-built paywall continue to work.
      const revenueCatPaywallOffering = offerings.all[PAYWALL_OFFERING_ID] ?? null;
      const packageOffering = revenueCatPaywallOffering ?? offerings.current;
      setPaywallOffering(revenueCatPaywallOffering);
      setCurrentOffering(packageOffering?.identifier ?? null);
      setPackages(packageOffering?.availablePackages ?? []);
    } catch (e) {
      console.error('Load offerings error:', e);
      setPaywallOffering(null);
    }
  }, []);

  const purchase = useCallback(async (pkg: PurchasesPackage): Promise<boolean> => {
    if (!canUseNativeRevenueCat()) return false;

    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const premium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      await checkSubscription();
      return premium;
    } catch (e: any) {
      if (e.userCancelled) return false;
      console.error('Purchase error:', e);
      Alert.alert('Error de compra', 'No se pudo completar la compra. Intenta de nuevo.');
      return false;
    }
  }, [checkSubscription]);

  const restore = useCallback(async (): Promise<boolean> => {
    if (!canUseNativeRevenueCat()) return false;

    try {
      await Purchases.restorePurchases();
      return await checkSubscription();
    } catch (e) {
      console.error('Restore error:', e);
      return false;
    }
  }, [checkSubscription]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await checkSubscription();
    await loadOfferings();
    setIsLoading(false);
  }, [checkSubscription, loadOfferings]);

  // Memoizado: el valor va a un Context, así que una identidad nueva en cada
  // render re-renderizaría a TODOS los consumidores sin que nada haya cambiado.
  return useMemo(
    () => ({
      isPremium,
      error,
      isLoading,
      packages,
      currentOffering,
      paywallOffering,
      purchase,
      restore,
      refresh,
    }),
    [
      isPremium,
      error,
      isLoading,
      packages,
      currentOffering,
      paywallOffering,
      purchase,
      restore,
      refresh,
    ],
  );
}
