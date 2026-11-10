import type { Db } from '@/db/db';
import {
  finishedWorkoutDates,
  getActiveWorkout,
  getSettings,
  lastFinishedCycle,
  listMeasurements,
  listPrograms,
  saveSettings,
} from '@/db/repository';
import { programSlot } from '@/domain/plan';
import {
  forgottenWorkoutAt,
  inactivityReminderAt,
  INACTIVITY_DAYS,
  nextHour,
  weeklyGoalReminder,
} from '@/domain/reminders';
import { nextWeighInReminder } from '@/domain/stats';

import { cancel, notificationsSupported, scheduleAt } from './notifications';

const CYCLE_HOUR = 9;
const CYCLE_NOTICE_WITHIN_MS = 36 * 60 * 60 * 1000;

/**
 * Re-plans every reminder from the current data: weekly weigh-in, a workout left open,
 * the weekly goal, a few days without training and finished progressions.
 * Called at launch and after anything that changes them (a workout started or finished,
 * a measurement logged, a setting changed), so each message is always up to date.
 */
export async function refreshReminders(db: Db, now: Date = new Date()) {
  if (!notificationsSupported) return;
  const s = await getSettings(db);
  const jobs: Promise<unknown>[] = [];

  // Weekly weigh-in: a week after the last measurement.
  if (s.weighInReminder) {
    const [last] = await listMeasurements(db);
    jobs.push(
      scheduleAt(
        'weigh-in',
        nextWeighInReminder(last?.measuredAt ?? null, s.weighInHour, now),
        { kind: 'weigh-in', path: '/log-measurement' },
        {
          title: 'Time to weigh in',
          body: last
            ? 'It’s been a week since your last weigh-in. Log it to keep your trend up to date.'
            : 'Log your weight to start your trend.',
        },
        'reminders',
      ),
    );
  } else jobs.push(cancel('weigh-in'));

  // A workout still open 2 hours after it started.
  const active = await getActiveWorkout(db);
  const forgottenAt = active && s.forgottenWorkoutReminder ? forgottenWorkoutAt(active.startedAt, now) : null;
  jobs.push(
    forgottenAt
      ? scheduleAt(
          'forgotten-workout',
          forgottenAt,
          { kind: 'forgotten', path: '/active' },
          { title: 'Still training?', body: 'Your workout has been open for 2 hours. Tap to finish it or keep going.' },
          'reminders',
        )
      : cancel('forgotten-workout'),
  );

  const dates = await finishedWorkoutDates(db);

  // Sunday afternoon, while the weekly goal is not reached.
  if (s.weeklyGoalReminder) {
    const g = weeklyGoalReminder(dates, s.weeklyGoal, now);
    const left = g.goal - g.done;
    jobs.push(
      scheduleAt(
        'weekly-goal',
        g.at,
        { kind: 'goal', path: '/workouts' },
        {
          title: left === 1 ? 'One workout left this week' : `${left} workouts left this week`,
          body: `You’ve done ${g.done} of ${g.goal}. There’s still time to reach your weekly goal.`,
        },
        'reminders',
      ),
    );
  } else jobs.push(cancel('weekly-goal'));

  // A few days without workouts, with the program's next routine if there is one.
  const last = dates.reduce<string | null>((a, d) => (a === null || d > a ? d : a), null);
  const inactiveAt = s.inactivityReminder && !active ? inactivityReminderAt(last, now) : null;
  if (inactiveAt) {
    const [program] = await listPrograms(db);
    const slot = program ? programSlot(program.intro.length, program.rotation.length, program.position) : null;
    const next = program && slot ? (slot.phase === 'intro' ? program.intro : program.rotation)[slot.index] : null;
    jobs.push(
      scheduleAt(
        'inactivity',
        inactiveAt,
        { kind: 'inactivity', path: '/workouts' },
        {
          title: next ? `Today: ${next.name}?` : 'Time to train?',
          body: `No workouts for ${INACTIVITY_DAYS} days.${next ? ` Next in ${program.name}: ${next.name}.` : ''}`,
        },
        'reminders',
      ),
    );
  } else jobs.push(cancel('inactivity'));

  // A % progression just went through all its steps: suggest updating the 1RM (once per workout).
  if (s.cycleReminder) {
    const cycle = await lastFinishedCycle(db);
    if (
      cycle &&
      cycle.workoutId !== s.cycleNoticeWorkoutId &&
      now.getTime() - Date.parse(cycle.finishedAt) < CYCLE_NOTICE_WITHIN_MS
    ) {
      const names = cycle.exercises.map((e) => e.name);
      const path =
        cycle.exercises.length === 1 ? `/profile/exercises/${cycle.exercises[0].exerciseId}` : '/profile/exercises';
      jobs.push(
        scheduleAt(
          'progression-cycle',
          nextHour(CYCLE_HOUR, now),
          { kind: 'cycle', path },
          {
            title: 'Progression complete',
            body: `${names.join(', ')}: all steps done. You’re probably stronger now: update your 1RM so the next round uses the right weights.`,
          },
          'reminders',
        ).then(() => saveSettings(db, { cycleNoticeWorkoutId: cycle.workoutId })),
      );
    }
  } else jobs.push(cancel('progression-cycle'));

  await Promise.all(jobs.map((j) => j.catch(() => {})));
}
