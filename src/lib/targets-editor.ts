import { router } from 'expo-router';

import type { ExercisePlan } from '@/domain/plan';
import type { LoadType } from '@/domain/types';

/**
 * One exercise as the routine editor holds it. Numbers stay text until saving, so typing
 * "6-" is allowed. Shared with the exercise targets screen, which edits one of them.
 */
export interface ExerciseDraft {
  key: number;
  exerciseId: number;
  name: string;
  loadType: LoadType;
  sets: string;
  reps: string;
  kg: string;
  rest: string;
  /** Done back to back with the next row (no rest in between). */
  superset: boolean;
  plan: ExercisePlan;
}

/**
 * The routine editor and the targets screen are separate routes, so the draft being edited
 * is handed over here (like the exercise picker) instead of through the URL.
 */
let pending: { draft: ExerciseDraft; onDone: (draft: ExerciseDraft) => void } | null = null;

export function editTargets(draft: ExerciseDraft, onDone: (draft: ExerciseDraft) => void) {
  pending = { draft, onDone };
  router.push('/exercise-targets');
}

/** The draft the targets screen should show, or null if it was opened directly. */
export function pendingTargets(): ExerciseDraft | null {
  return pending?.draft ?? null;
}

export function deliverTargets(draft: ExerciseDraft) {
  const p = pending;
  pending = null;
  p?.onDone(draft);
}
