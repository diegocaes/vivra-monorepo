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

/** Schedule a local notification for a preventive treatment reminder.
 *  Default: alert 1 day before due date. */
export async function schedulePreventiveReminder(opts: {
  petName: string;
  type: 'antipulgas' | 'desparasitante' | 'combinado';
  nextDueDate: Date;
  daysBeforeAlert?: number;
}) {
  const { petName, type, nextDueDate, daysBeforeAlert = 1 } = opts;
  const label =
    type === 'antipulgas' ? 'antipulgas'
    : type === 'desparasitante' ? 'desparasitante'
    : 'preventivo mensual';

  // Alert N days before due date
  const alertDate = new Date(nextDueDate);
  alertDate.setDate(alertDate.getDate() - daysBeforeAlert);

  // Don't schedule if alert date is in the past
  if (alertDate <= new Date()) return;

  // Avoid stacking duplicate reminders for the same (pet, type). Cancel any
  // previously scheduled reminder of the same treatmentType for this pet.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const d = n.content.data as { type?: string; treatmentType?: string; petName?: string } | undefined;
    if (d?.type === 'preventive_reminder' && d.treatmentType === type && d.petName === petName) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const dayWord = daysBeforeAlert === 1 ? 'mañana' : `en ${daysBeforeAlert} días`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${petName}: ${label} próximo`,
      body: `El ${label} de ${petName} vence ${dayWord}. ¡No lo olvides!`,
      data: { type: 'preventive_reminder', treatmentType: type, petName },
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

  // Cancel any previously scheduled food reminder for this pet to avoid stacking.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const d = n.content.data as { type?: string; petName?: string } | undefined;
    if (d?.type === 'food_reminder' && d.petName === petName) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const alertDate = new Date();
  alertDate.setHours(9, 0, 0, 0); // Next day at 9am
  alertDate.setDate(alertDate.getDate() + 1);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${petName}: comida por acabarse`,
      body: `Quedan ~${daysRemaining} días de ${brand}. ¡Hora de comprar más!`,
      data: { type: 'food_reminder', petName },
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

/** Schedule a vaccine reminder when it's been more than 1 year since the last
 *  vaccine was given (i.e. on or after the next-due date). */
export async function scheduleVaccineReminder(opts: {
  petName: string;
  vaccineName: string;
  /** Date the vaccine was last given. We schedule the alert for +1 year. */
  lastGivenDate: Date;
}) {
  const { petName, vaccineName, lastGivenDate } = opts;

  const alertDate = new Date(lastGivenDate);
  alertDate.setFullYear(alertDate.getFullYear() + 1);
  alertDate.setHours(9, 0, 0, 0); // 9am of due day

  if (alertDate <= new Date()) return;

  // Cancel any prior reminder for this (pet, vaccineName) to avoid stacking.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const d = n.content.data as { type?: string; vaccineName?: string; petName?: string } | undefined;
    if (d?.type === 'vaccine_reminder' && d.vaccineName === vaccineName && d.petName === petName) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${petName}: vacuna pendiente`,
      body: `💉 Llevas más de un año sin registrar la vacuna de ${vaccineName} de ${petName}.`,
      data: { type: 'vaccine_reminder', vaccineName, petName },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: alertDate,
    },
  });
}

/** Schedule a weight log reminder 30 days after the last recorded weight. */
export async function scheduleWeightReminder(opts: {
  petName: string;
  /** Date of the last weight record. We schedule alert for +30 days. */
  lastWeightDate: Date;
}) {
  const { petName, lastWeightDate } = opts;

  const alertDate = new Date(lastWeightDate);
  alertDate.setDate(alertDate.getDate() + 30);
  alertDate.setHours(9, 0, 0, 0);

  if (alertDate <= new Date()) return;

  // Cancel any prior weight reminder for this pet to avoid stacking.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const d = n.content.data as { type?: string; petName?: string } | undefined;
    if (d?.type === 'weight_reminder' && d.petName === petName) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${petName}: hora de pesar`,
      body: `⚖️ Llevas más de 30 días sin registrar el peso de ${petName}. Mantener el seguimiento ayuda a detectar cambios.`,
      data: { type: 'weight_reminder', petName },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: alertDate,
    },
  });
}

/** Cancel all scheduled notifications (useful on logout) */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
