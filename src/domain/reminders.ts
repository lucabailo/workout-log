/**
 * When each optional reminder should fire. Pure functions of the data, so the app can
 * re-plan every reminder from scratch whenever something changes (and they are tested).
 */
import { FORGOTTEN_AFTER_MS } from './routines';
import { workoutsThisWeek } from './stats';

const MINUTE = 60_000;

/** The next `hour` o'clock that is still ahead of `now`. */
export function nextHour(hour: number, now: Date): Date {
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= now.getTime() + MINUTE) d.setDate(d.getDate() + 1);
  return d;
}

/** "Did you forget to finish?" once a workout has been open for 2 hours. Null if that moment is gone. */
export function forgottenWorkoutAt(startedAt: string, now: Date): Date | null {
  const at = Date.parse(startedAt) + FORGOTTEN_AFTER_MS;
  return at > now.getTime() + MINUTE ? new Date(at) : null;
}

export const GOAL_REMINDER_HOUR = 17;

/**
 * Sunday afternoon check on the weekly goal. This week's Sunday if the goal isn't reached yet,
 * otherwise next week's (when nothing is logged yet, so `done` is 0).
 * Re-planned after every workout, so the count in the message is always current.
 */
export function weeklyGoalReminder(
  startDates: string[],
  goal: number,
  now: Date,
): { at: Date; done: number; goal: number } {
  const sunday = new Date(now);
  sunday.setHours(GOAL_REMINDER_HOUR, 0, 0, 0);
  sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
  const done = workoutsThisWeek(startDates, now);
  if (done < goal && sunday.getTime() > now.getTime() + MINUTE) return { at: sunday, done, goal };
  const next = new Date(sunday);
  next.setDate(next.getDate() + 7);
  return { at: next, done: 0, goal };
}

export const INACTIVITY_DAYS = 4;
export const INACTIVITY_HOUR = 18;

/** A nudge `days` days after the last workout, at 6 pm. Null when there is no workout or it is past. */
export function inactivityReminderAt(lastWorkoutIso: string | null, now: Date, days = INACTIVITY_DAYS): Date | null {
  if (!lastWorkoutIso) return null;
  const at = new Date(lastWorkoutIso);
  at.setDate(at.getDate() + days);
  at.setHours(INACTIVITY_HOUR, 0, 0, 0);
  return at.getTime() > now.getTime() + MINUTE ? at : null;
}

/**
 * Progressions (in % of the 1RM) that have just gone through all their steps:
 * the routine was done a multiple of the step count. A good moment to update the 1RM.
 */
export function finishedCycles<T extends { steps: number }>(exercises: T[], timesDone: number): T[] {
  if (timesDone <= 0) return [];
  return exercises.filter((e) => e.steps > 0 && timesDone % e.steps === 0);
}
