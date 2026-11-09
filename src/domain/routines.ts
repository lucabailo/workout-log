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
    if (e.targetKg === null) continue;
    const sets = doneSetsByExercise.get(e.exerciseId) ?? [];
    const best = Math.max(0, ...sets.filter((s) => s.reps >= e.repsMin).map((s) => s.weightKg));
    if (best > e.targetKg) updates.push({ exerciseId: e.exerciseId, name: e.name, fromKg: e.targetKg, toKg: best });
  }
  return updates;
}

/** Total sets planned in a routine. */
export function plannedSets(exercises: Pick<RoutineExercise, 'sets'>[]): number {
  return exercises.reduce((n, e) => n + e.sets, 0);
}
