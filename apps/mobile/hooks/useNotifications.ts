import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push notifications don't work on simulator
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Get the push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: projectId || undefined,
  });

  return tokenData.data;
}

export function useNotifications() {
  const { user } = useAuth();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Register push token and save to Supabase
  const registerToken = useCallback(async () => {
    if (!user) return;

    try {
      const token = await registerForPushNotifications();
      if (!token) return;

      // Upsert token in Supabase
      await supabase.from('push_tokens').upsert(
        {
          user_id: user.id,
          token,
          platform: Platform.OS as 'ios' | 'android',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' },
      );
    } catch (e) {
      console.error('Push token registration error:', e);
    }
  }, [user]);

  useEffect(() => {
    registerToken();

    // Listen for incoming notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // Notification received in foreground — handler above controls display
    });

    // Listen for user tapping on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((_response) => {
      // Could navigate to specific screen based on notification data
      // const data = response.notification.request.content.data;
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [registerToken]);

  return { registerToken };
}

// ── Local notification helpers ──

/** Schedule a local notification for a preventive treatment reminder */
export async function schedulePreventiveReminder(opts: {
  petName: string;
  type: 'antipulgas' | 'desparasitante';
  nextDueDate: Date;
  daysBeforeAlert?: number;
}) {
  const { petName, type, nextDueDate, daysBeforeAlert = 3 } = opts;
  const label = type === 'antipulgas' ? 'antipulgas' : 'desparasitante';

  // Alert N days before due date
  const alertDate = new Date(nextDueDate);
  alertDate.setDate(alertDate.getDate() - daysBeforeAlert);

  // Don't schedule if alert date is in the past
  if (alertDate <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${petName}: ${label} próximo`,
      body: `El ${label} de ${petName} vence en ${daysBeforeAlert} días. ¡No lo olvides!`,
      data: { type: 'preventive_reminder', treatmentType: type },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: alertDate,
    },
  });
}

/** Schedule a local notification for food bag running low */
export async function scheduleFoodReminder(opts: {
  petName: string;
  brand: string;
  daysRemaining: number;
}) {
  const { petName, brand, daysRemaining } = opts;

  if (daysRemaining > 3 || daysRemaining < 0) return;

  const alertDate = new Date();
  alertDate.setHours(9, 0, 0, 0); // Next day at 9am
  alertDate.setDate(alertDate.getDate() + 1);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${petName}: comida por acabarse`,
      body: `Quedan ~${daysRemaining} días de ${brand}. ¡Hora de comprar más!`,
      data: { type: 'food_reminder' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: alertDate,
    },
  });
}

/** Schedule a birthday notification for the pet */
export async function scheduleBirthdayNotification(opts: {
  petName: string;
  birthDate: string;
}) {
  const { petName, birthDate } = opts;
  const birth = new Date(birthDate + 'T00:00:00');
  const now = new Date();

  // Calculate next birthday
  const nextBirthday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate(), 9, 0, 0);
  if (nextBirthday <= now) {
    nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
  }

  const age = nextBirthday.getFullYear() - birth.getFullYear();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `¡Feliz cumpleaños ${petName}!`,
      body: `${petName} cumple ${age} ${age === 1 ? 'año' : 'años'} hoy. ¡Celébralo!`,
      data: { type: 'birthday' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextBirthday,
    },
  });
}

/** Cancel all scheduled notifications (useful on logout) */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
