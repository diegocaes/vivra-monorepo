import Purchases from 'react-native-purchases';
import Constants from 'expo-constants';
import { REVENUECAT_API_KEY } from '../constants/revenueCat';

// RevenueCat is process-wide. Keeping this state outside React hooks avoids
// importing useSubscription from useAuth (which created an auth ↔ billing
// module cycle during app startup).
let identifiedUserId: string | null = null;

/**
 * Expo Go does not include Vivra's native App Store billing environment and
 * rejects the iOS RevenueCat key. We still exercise the whole UI there, while
 * Premium falls back to the signed server-side subscription in Supabase.
 * Development/App Store builds return a different ownership value and keep
 * using RevenueCat normally.
 */
export function canUseNativeRevenueCat() {
  return Constants.appOwnership !== 'expo';
}

export function getRevenueCatUserId() {
  return identifiedUserId;
}

export async function identifyRevenueCatUser(userId: string) {
  if (!canUseNativeRevenueCat()) return;

  const sdkConfigured = await Purchases.isConfigured();
  if (!sdkConfigured) {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
  }

  if (identifiedUserId === userId) return;

  await Purchases.logIn(userId);
  identifiedUserId = userId;
}

export async function clearRevenueCatUser() {
  identifiedUserId = null;
  if (!canUseNativeRevenueCat()) return;

  try {
    if (!(await Purchases.isConfigured())) return;
    await Purchases.logOut();
  } catch (error: any) {
    // A failed SDK logout must not block Supabase logout. The next login still
    // identifies the authenticated user before checking entitlements.
    console.warn(
      '[revenueCatSession] RevenueCat logout failed:',
      error?.message ?? error,
    );
  }
}
