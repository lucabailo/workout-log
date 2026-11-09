import { plannedSetCount, type PlanBase } from './plan';
import type { RoutineExercise, WorkoutSet } from './types';

type DoneSet = Pick<WorkoutSet, 'reps' | 'weightKg'>;

export interface TargetUpdate {
  exerciseId: number;
  name: string;
  fromKg: number;
  toKg: number;
}

/**
 * Exercises where the workout went above the routine's target: the heaviest weight lifted
 * for at least the bottom of the rep range becomes the suggested new target.
 * Exercises without a target are left alone (they already follow last time's weight).
 */
export function suggestedTargetUpdates(
  plan: RoutineExercise[],
  doneSetsByExercise: Map<number, DoneSet[]>,
): TargetUpdate[] {
  const updates: TargetUpdate[] = [];
  for (const e of plan) {
    // progressions set their own weight every session
    if (e.targetKg === null || e.plan?.mode === 'progression') continue;
    const sets = doneSetsByExercise.get(e.exerciseId) ?? [];
    const best = Math.max(0, ...sets.filter((s) => s.reps >= e.repsMin).map((s) => s.weightKg));
    if (best > e.targetKg) updates.push({ exerciseId: e.exerciseId, name: e.name, fromKg: e.targetKg, toKg: best });
  }
  return updates;
}

/** Total sets planned in a routine. */
export function plannedSets(exercises: (Pick<RoutineExercise, 'sets'> & Partial<PlanBase>)[]): number {
  return exercises.reduce((n, e) => n + (e.plan ? plannedSetCount(e as PlanBase) : e.sets), 0);
}

/**
 * Labels for exercises that are part of a superset: the first group is A1, A2…, the next B1, B2…
 * Exercises done on their own get no label. `supersetWithNext` links an exercise to the one after it.
 */
export function supersetLabels(exercises: Pick<RoutineExercise, 'exerciseId' | 'supersetWithNext'>[]): Map<number, string> {
  const labels = new Map<number, string>();
  let group = 0;
  let index = 0;
  exercises.forEach((e, i) => {
    const linkedToPrevious = i > 0 && exercises[i - 1].supersetWithNext;
    if (!linkedToPrevious && !e.supersetWithNext) return;
    if (!linkedToPrevious) {
      group++;
      index = 0;
    }
    index++;
    labels.set(e.exerciseId, `${String.fromCharCode(64 + group)}${index}`);
  });
  return labels;
}

/** A workout still open this long after it started was most likely forgotten. */
export const FORGOTTEN_AFTER_MS = 2 * 60 * 60 * 1000;

export function looksForgotten(startedAt: string, now: number): boolean {
  return now - Date.parse(startedAt) >= FORGOTTEN_AFTER_MS;
}
