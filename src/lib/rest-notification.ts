import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

/**
 * A local notification for the end of the rest timer, so it reaches you when the phone is
 * locked or you are in another app. Nothing goes through a server: the phone schedules it.
 * While the app is open the on-screen timer is enough, so the notification is not shown then.
 */
const CHANNEL = 'rest-timer';
const supported = Platform.OS === 'android' || Platform.OS === 'ios';
let scheduledId: string | null = null;
let setUp = false;

export function setUpRestNotifications() {
  if (!supported || setUp) return;
  setUp = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Rest timer',
      description: 'Tells you when the rest between sets is over',
      // (the enums are re-exported through `export *`, which the import lint rule can't follow)
      // eslint-disable-next-line import/namespace
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 150, 300],
      // eslint-disable-next-line import/namespace
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }).catch(() => {});
  }
  // Tapping the notification goes back to the workout.
  Notifications.addNotificationResponseReceivedListener((response) => {
    if (response.notification.request.content.data?.screen === 'active') router.push('/active');
  });
}

/** Asks for permission once. Returns whether notifications can be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Schedules (or moves) the "rest is over" notification. */
export async function scheduleRestEnd(endsAt: number, nextUp: string | null) {
  if (!supported) return;
  await cancelRestEnd();
  if (endsAt - Date.now() < 1000 || !(await ensureNotificationPermission())) return;
  scheduledId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rest is over',
      body: nextUp ? `Next: ${nextUp}` : 'Time for your next set',
      data: { screen: 'active' },
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endsAt, channelId: CHANNEL },
  });
}

/** Cancels the pending notification and removes it from the tray if it was already shown. */
export async function cancelRestEnd() {
  if (!supported || !scheduledId) return;
  const id = scheduledId;
  scheduledId = null;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.dismissNotificationAsync(id).catch(() => {});
}
