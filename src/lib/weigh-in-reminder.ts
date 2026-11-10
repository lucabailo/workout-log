import type { Db } from '@/db/db';
import { getSettings, listMeasurements } from '@/db/repository';
import { nextWeighInReminder } from '@/domain/stats';

import { cancel, notificationsSupported, scheduleAt } from './notifications';

const ID = 'weigh-in';

/**
 * Keeps the weekly weigh-in reminder up to date: one week after the last measurement, at the
 * chosen hour. Called at launch and whenever a measurement or the setting changes, so it
 * only reminds you when a week has really gone by.
 */
export async function refreshWeighInReminder(db: Db) {
  if (!notificationsSupported) return;
  const settings = await getSettings(db);
  if (!settings.weighInReminder) return cancel(ID);
  const [last] = await listMeasurements(db);
  const at = nextWeighInReminder(last?.measuredAt ?? null, settings.weighInHour);
  await scheduleAt(
    ID,
    at,
    'weigh-in',
    {
      title: 'Time to weigh in',
      body: last
        ? 'It’s been a week since your last weigh-in. Log it to keep your trend up to date.'
        : 'Log your weight to start your trend.',
    },
    'reminders',
  );
}
