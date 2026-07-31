import { createContext, useContext } from 'react';
import { useSubscriptionState, type SubscriptionState } from '../hooks/useSubscription';

/**
 * Suscripción como singleton.
 *
 * Antes cada pantalla llamaba a `useSubscription()` y montaba su propia copia
 * del estado: 6 pantallas = 6 inicializaciones de RevenueCat y 3-4 queries a
 * Supabase cada una, con `isPremium` pudiendo diferir entre pantallas mientras
 * resolvían. Eso toca revenue directamente (alguien que pagó viendo features
 * bloqueadas), así que el estado se monta UNA vez acá y todas leen de aquí.
 */
const SubscriptionContext = createContext<SubscriptionState | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionState();
  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

/**
 * API pública — idéntica a la que ya usaban las pantallas, así que ningún
 * consumidor tuvo que cambiar.
 */
export function useSubscription(): SubscriptionState {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription debe usarse dentro de SubscriptionProvider');
  }
  return ctx;
}
