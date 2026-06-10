import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

/**
 * Map a notification's `href` (web-style route set by the server push
 * dispatcher or local schedulers) to the mobile route. Falls back to the
 * dashboard so a tap always lands somewhere sensible.
 */
function hrefToMobileRoute(href: string | undefined): string {
  if (!href) return '/(app)';
  if (href.includes('preventivos')) return '/(app)/salud/preventivos';
  if (href.includes('vacunas')) return '/(app)/salud/vacunas';
  if (href.includes('peso')) return '/(app)/salud/peso';
  if (href.includes('alimentacion')) return '/(app)/alimentacion';
  if (href.includes('grooming')) return '/(app)/actividad/grooming';
  if (href.includes('perfil')) return '/(app)/perfil';
  if (href.includes('salud')) return '/(app)/salud';
  return '/(app)';
}

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

/**
 * Get the Expo push token. By default this is SILENT: it only returns a token
 * if the user already granted notification permission. Pass
 * `promptIfNeeded: true` to show the iOS permission dialog — only do that at
 * a moment of value (after onboarding, after saving a reminder-worthy
 * record), never at cold start. Permission prompts without context get
 * rejected ~60% of the time and iOS won't let us re-ask.
 */
async function registerForPushNotifications(promptIfNeeded = false): Promise<string | null> {
  if (!Device.isDevice) {
    // Push notifications don't work on simulator
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    if (!promptIfNeeded) return null; // silent mode: never show the dialog
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

/**
 * Ask for notification permission (showing the iOS dialog if needed) and
 * persist the push token. Call this from moments of value:
 *   - Onboarding success screen ("Entrar a Vivra" tap)
 *   - After saving the first preventive/vaccine (reminders are the benefit)
 * Safe to call repeatedly — if permission was already granted or denied,
 * no dialog appears (iOS only shows it once per install).
 */
export async function requestPushPermissionAndRegister(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const token = await registerForPushNotifications(true);
    if (!token) return false;

    await supabase.from('push_tokens').upsert(
      {
        user_id: user.id,
        token,
        platform: Platform.OS as 'ios' | 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );
    return true;
  } catch (e: any) {
    console.warn('[notifications] permission request failed:', e?.message ?? e);
    return false;
  }
}

/**
 * Cancel any locally-scheduled notifications whose `type` belongs to a feature
 * we've since removed from the product. Local notifications are persisted in
 * the iOS device (not in our code), so they keep firing forever until the
 * user uninstalls the app — even if the code that scheduled them is long
 * gone. This sweep runs on every app startup and is cheap (only acts on
 * matches).
 *
 * Deprecated types tracked here:
 *   daily_activity      — 7pm "did you walk your dog?" (removed in R1)
 *   walk_reminder       — older variant of the same
 *   activity_reminder   — older variant of the same
 *   grooming_reminder   — removed in R1 (now in /actividad/grooming)
 *   adventure_reminder  — adventures feature was dropped entirely
 *   food_reminder       — decided in R5 not to nag about food
 */
const DEPRECATED_NOTIF_TYPES = new Set([
  'daily_activity',
  'walk_reminder',
  'activity_reminder',
  'grooming_reminder',
  'adventure_reminder',
  'food_reminder',
]);

export async function cancelDeprecatedNotifications() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    let cancelled = 0;
    for (const n of scheduled) {
      const data = n.content.data as { type?: string } | undefined;
      if (data?.type && DEPRECATED_NOTIF_TYPES.has(data.type)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
        cancelled++;
      }
    }
    if (cancelled > 0) {
      console.log(`[notifications] Cancelled ${cancelled} deprecated scheduled notification(s)`);
    }
  } catch (e: any) {
    console.warn('[notifications] cleanup failed:', e?.message ?? e);
  }
}

export function useNotifications() {
  const { user } = useAuth();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // Register push token and save to Supabase. SILENT: never shows the
  // permission dialog — only refreshes the token for users who already
  // granted. The dialog is triggered at moments of value via
  // requestPushPermissionAndRegister() (onboarding success, first reminder).
  const registerToken = useCallback(async () => {
    if (!user) return;

    try {
      const token = await registerForPushNotifications(false);
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

    // Sweep deprecated local notifications scheduled by older app versions.
    // Critical: notifs persist in the device, not the code — without this,
    // existing users would keep getting "did you walk your dog?" at 7pm
    // forever, because that notif was scheduled DAILY in a previous build.
    cancelDeprecatedNotifications();

    // Listen for incoming notifications while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // Notification received in foreground — handler above controls display
    });

    // Listen for user tapping on a notification → deep-link to the screen
    // the notification is about (server pushes set data.href; local
    // schedulers set data.type which we also map).
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { href?: string; type?: string }
        | undefined;
      let route = hrefToMobileRoute(data?.href);
      if (route === '/(app)' && data?.type) {
        // Local notifications don't carry href — infer from type.
        if (data.type === 'preventive_reminder') route = '/(app)/salud/preventivos';
        else if (data.type === 'vaccine_reminder') route = '/(app)/salud/vacunas';
        else if (data.type === 'weight_reminder') route = '/(app)/salud/peso';
      }
      // Small delay: on cold start the router isn't ready immediately.
      setTimeout(() => {
        try { router.push(route as any); } catch { /* router not ready — dashboard shows anyway */ }
      }, 400);
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
