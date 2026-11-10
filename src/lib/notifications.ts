import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

/**
 * Shared setup for the app's local notifications (scheduled on the phone, no server).
 * Each notification carries `data.kind`; tapping it opens the matching screen.
 */
export const notificationsSupported = Platform.OS === 'android' || Platform.OS === 'ios';

export type NotificationKind = 'rest' | 'weigh-in' | 'forgotten' | 'goal' | 'inactivity' | 'cycle';

/** What a notification carries: its kind and the screen a tap opens. */
export interface NotificationData {
  kind: NotificationKind;
  path: string;
}

let setUp = false;

export function setUpNotifications() {
  if (!notificationsSupported || setUp) return;
  setUp = true;
  Notifications.setNotificationHandler({
    // With the app open, the rest timer is already on screen; other reminders still show.
    handleNotification: async (n) => {
      const show = n.request.content.data?.kind !== 'rest';
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    // (the enums are re-exported through `export *`, which the import lint rule can't follow)
    /* eslint-disable import/namespace */
    Notifications.setNotificationChannelAsync('rest-timer', {
      name: 'Rest timer',
      description: 'Tells you when the rest between sets is over',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 150, 300],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }).catch(() => {});
    Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      description: 'Weigh-in, weekly goal, workout left open and other reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
    /* eslint-enable import/namespace */
  }
  Notifications.addNotificationResponseReceivedListener((response) => {
    const path = response.notification.request.content.data?.path;
    if (typeof path === 'string' && path.startsWith('/')) router.push(path as never);
  });
}

/** Asks for permission once. Returns whether notifications can be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Schedules a one-off notification; scheduling again with the same id replaces it. */
export async function scheduleAt(
  id: string,
  at: Date | number,
  data: NotificationData,
  content: { title: string; body: string },
  channelId: string,
) {
  if (!notificationsSupported || !(await ensureNotificationPermission())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { ...content, data: { ...data }, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId },
  });
}

/** Cancels a scheduled notification and removes it from the tray if it was already shown. */
export async function cancel(id: string) {
  if (!notificationsSupported) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.dismissNotificationAsync(id).catch(() => {});
}
