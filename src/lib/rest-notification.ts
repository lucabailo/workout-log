import { cancel, notificationsSupported, scheduleAt } from './notifications';

/**
 * The "rest is over" notification, so it reaches you when the phone is locked or you are in
 * another app. While the app is open it is not shown: the on-screen timer is enough.
 */
const ID = 'rest-timer';

export { ensureNotificationPermission } from './notifications';

/** Schedules (or moves) the notification for the end of the rest. */
export async function scheduleRestEnd(endsAt: number, nextUp: string | null) {
  if (!notificationsSupported) return;
  if (endsAt - Date.now() < 1000) return cancelRestEnd();
  await scheduleAt(
    ID,
    endsAt,
    { kind: 'rest', path: '/active' },
    { title: 'Rest is over', body: nextUp ? `Next: ${nextUp}` : 'Time for your next set' },
    'rest-timer',
  );
}

export async function cancelRestEnd() {
  await cancel(ID);
}
