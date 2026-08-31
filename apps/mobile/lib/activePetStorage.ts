import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_PET_KEY_PREFIX = 'vivra:active-pet:';

function storageKey(userId: string): string {
  return `${ACTIVE_PET_KEY_PREFIX}${userId}`;
}

export async function loadActivePetId(userId: string): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(storageKey(userId));
    return stored?.trim() || null;
  } catch {
    // The app remains usable if local storage is temporarily unavailable.
    return null;
  }
}

export async function saveActivePetId(userId: string, petId: string | null): Promise<void> {
  try {
    if (petId) {
      await AsyncStorage.setItem(storageKey(userId), petId);
    } else {
      await AsyncStorage.removeItem(storageKey(userId));
    }
  } catch {
    // Selection persistence is a convenience; it must never block navigation.
  }
}
