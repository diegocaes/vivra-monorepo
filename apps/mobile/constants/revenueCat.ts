import { Platform } from 'react-native';

// Replace with your actual RevenueCat API keys from dashboard.revenuecat.com
export const REVENUECAT_API_KEY = Platform.select({
  ios: 'appl_VQDRGwoWdAcaopINBQxXBjxiWpF',
  android: 'goog_YOUR_REVENUECAT_ANDROID_KEY',
}) ?? '';

// Product identifiers — must match App Store Connect
export const PRODUCT_IDS = {
  MONTHLY: 'vivra_premium_monthly',   // $2.99/month
  YEARLY: 'vivra_premium_yearly',     // $19.99/year
} as const;

// Entitlement identifier — configured in RevenueCat dashboard
export const ENTITLEMENT_ID = 'premium';

// Free plan limits
export const FREE_LIMITS = {
  MAX_PETS: 1,
} as const;

// Premium features list (for paywall display)
export const PREMIUM_FEATURES = [
  { icon: 'people' as const, title: 'Compartir con tu pareja', description: 'Ambos dueños pueden ver y registrar todo' },
  { icon: 'paw' as const, title: 'Mascotas ilimitadas', description: 'Agrega hasta 5 mascotas en tu cuenta' },
  { icon: 'stats-chart' as const, title: 'Estadísticas avanzadas', description: 'Gráficos de peso, tendencias y análisis detallado' },
  { icon: 'document-text' as const, title: 'Exportar PDF', description: 'Exporta el historial médico y pasaporte' },
  { icon: 'color-palette' as const, title: 'Temas de color', description: 'Personaliza con 6 colores diferentes' },
] as const;
