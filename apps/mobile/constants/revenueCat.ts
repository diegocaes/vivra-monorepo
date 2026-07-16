import { Platform } from 'react-native';

// Replace with your actual RevenueCat API keys from dashboard.revenuecat.com
export const REVENUECAT_API_KEY = Platform.select({
  ios: 'appl_VQDRGwoWdAcaopINBQxXBjxiWpF',
  android: 'goog_YOUR_REVENUECAT_ANDROID_KEY',
}) ?? '';

// Product identifiers — must match App Store Connect
export const PRODUCT_IDS = {
  MONTHLY: 'vivra_premium_monthly',   // $2.99/month
  YEARLY: 'vivra_premium_yearly',     // $14.99/year
} as const;

// Entitlement identifier — configured in RevenueCat dashboard
export const ENTITLEMENT_ID = 'premium';

// Free plan limits — multi-mascota es FREE (estrategia de retención 2026-07)
export const FREE_LIMITS = {
  MAX_PETS: 10,
} as const;

// Premium features list (for paywall display)
// Premium = co-dueño + detalle de gastos (desglose y totales por sección) + colores de tema.
export const PREMIUM_FEATURES = [
  { icon: 'people' as const, title: 'Co-dueño', description: 'Comparte la mascota con tu pareja: ambos ven y registran todo' },
  { icon: 'wallet' as const, title: 'Detalle de gastos', description: 'Desglose por categoría y totales de vet, alimento, vuelos y más' },
  { icon: 'color-palette' as const, title: 'Colores de tema', description: 'Personaliza el perfil de tu mascota con todos los colores' },
] as const;
