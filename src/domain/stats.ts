import type { ExerciseSession, WorkoutSet } from './types';

type SetLike = Pick<WorkoutSet, 'reps' | 'weightKg'>;

/**
 * Estimated one-rep max with the Epley formula: weight × (1 + reps / 30).
 * A single rep is the weight itself. Sets without reps or weight count as 0.
 */
export function estimatedOneRepMax({ reps, weightKg }: SetLike): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Total load moved: the sum of reps × weight. */
export function volume(sets: SetLike[]): number {
  return sets.reduce((sum, s) => sum + Math.max(0, s.reps) * Math.max(0, s.weightKg), 0);
}

export interface PersonalRecords {
  heaviestKg: number;
  bestOneRepMaxKg: number;
  bestSessionVolumeKg: number;
  sessions: number;
}

export function personalRecords(sessions: ExerciseSession[]): PersonalRecords {
  let heaviestKg = 0;
  let bestOneRepMaxKg = 0;
  let bestSessionVolumeKg = 0;
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.reps > 0) heaviestKg = Math.max(heaviestKg, set.weightKg);
      bestOneRepMaxKg = Math.max(bestOneRepMaxKg, estimatedOneRepMax(set));
    }
    bestSessionVolumeKg = Math.max(bestSessionVolumeKg, volume(session.sets));
  }
  return { heaviestKg, bestOneRepMaxKg, bestSessionVolumeKg, sessions: sessions.length };
}

export interface ProgressPoint {
  date: string;
  value: number;
}

/** Best estimated 1RM of each session, oldest first, for the progress chart. */
export function oneRepMaxProgress(sessions: ExerciseSession[]): ProgressPoint[] {
  return sessions
    .map((s) => ({ date: s.date, value: Math.max(0, ...s.sets.map(estimatedOneRepMax)) }))
    .filter((p) => p.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Indexes of the sets in `current` that beat everything in `previous` by estimated 1RM.
 * Only the first set to reach a new best is marked, so a PR is not counted twice.
 * The first time an exercise is done there is nothing to beat, so no set is a record.
 */
export function newRecordIndexes(current: SetLike[], previous: ExerciseSession[]): number[] {
  if (previous.length === 0) return [];
  let best = personalRecords(previous).bestOneRepMaxKg;
  const indexes: number[] = [];
  current.forEach((set, i) => {
    const e1rm = estimatedOneRepMax(set);
    if (e1rm > best && e1rm > 0) {
      indexes.push(i);
      best = e1rm;
    }
  });
  return indexes;
}

/** Number of workouts started in the same ISO week (Monday to Sunday) as `now`. */
export function workoutsThisWeek(startDates: string[], now: Date = new Date()): number {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return startDates.filter((d) => new Date(d) >= monday).length;
}

/** Monday 00:00 (local time) of the week containing `date`. */
export function weekStart(date: Date): Date {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** How many weeks before the current one `date` falls in (0 = this week). */
function weeksAgo(date: Date, now: Date): number {
  return Math.round((weekStart(now).getTime() - weekStart(date).getTime()) / WEEK_MS);
}

/**
 * Consecutive weeks in which the weekly goal was reached, counting back from this week.
 * The current week only counts once the goal is met, so an unfinished week never breaks
 * the streak (rest days are fine).
 */
export function weeklyStreak(startDates: string[], goal: number, now: Date = new Date()): number {
  const perWeek = new Map<number, number>();
  for (const d of startDates) {
    const w = weeksAgo(new Date(d), now);
    if (w >= 0) perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const reached = (w: number) => (perWeek.get(w) ?? 0) >= Math.max(1, goal);
  let streak = reached(0) ? 1 : 0;
  for (let w = 1; reached(w); w++) streak++;
  return streak;
}

/** Trained days for the last `weeks` weeks: one array per week (oldest first), Monday to Sunday. */
export function activityGrid(startDates: string[], weeks = 12, now: Date = new Date()): boolean[][] {
  const grid = Array.from({ length: weeks }, () => Array<boolean>(7).fill(false));
  for (const d of startDates) {
    const date = new Date(d);
    const w = weeksAgo(date, now);
    if (w < 0 || w >= weeks) continue;
    grid[weeks - 1 - w][(date.getDay() + 6) % 7] = true;
  }
  return grid;
}

/**
 * How many times a personal record was set across the whole history: every workout where
 * an exercise's best estimated 1RM beat all its earlier workouts. The first time an exercise
 * is done only sets the baseline.
 */
export function recordCount(sessionsByExercise: Iterable<ExerciseSession[]>): number {
  let count = 0;
  for (const sessions of sessionsByExercise) {
    const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
    let best = 0;
    sorted.forEach((s, i) => {
      const top = Math.max(0, ...s.sets.map(estimatedOneRepMax));
      if (i > 0 && top > best) count++;
      best = Math.max(best, top);
    });
  }
  return count;
}

/** Local calendar day of a date or ISO timestamp, as "YYYY-MM-DD". */
export function dayKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The days of one month laid out in weeks, Monday first (P4 calendar). Cells before the 1st
 * and after the last day are null. `month` is 0-based, like Date.
 */
export function monthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array((first.getDay() + 6) % 7).fill(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
