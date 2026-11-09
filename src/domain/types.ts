export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Full body',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** What the kg field means for an exercise. */
export const LOAD_TYPES = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

export interface Exercise {
  id: number;
  name: string;
  muscleGroup: MuscleGroup;
  isCustom: boolean;
  loadType: LoadType;
}

export interface Workout {
  id: number;
  startedAt: string; // ISO timestamp
  finishedAt: string | null; // null while the workout is in progress
  notes: string | null;
  routineId: number | null; // the routine it was started from, if any
}

export interface WorkoutSet {
  id: number;
  workoutId: number;
  exerciseId: number;
  setIndex: number;
  reps: number;
  weightKg: number;
  completed: boolean;
}

/** A finished workout as shown in the history list. */
export interface WorkoutSummary {
  id: number;
  routineName: string | null;
  startedAt: string;
  finishedAt: string;
  exerciseNames: string[];
  setCount: number;
  volumeKg: number;
}

/** All completed sets of one exercise in one workout. */
export interface ExerciseSession {
  workoutId: number;
  date: string; // ISO timestamp of the workout start
  sets: Pick<WorkoutSet, 'reps' | 'weightKg'>[];
}

/** One exercise of a routine, with the plan the user wrote for it. */
export interface RoutineExercise {
  exerciseId: number;
  name: string;
  loadType: LoadType;
  sets: number;
  repsMin: number;
  repsMax: number; // same as repsMin when there is no range
  targetKg: number | null; // null = no target, use last time's weight
  restSeconds: number;
  /** Done back to back with the next exercise of the routine (no rest in between). */
  supersetWithNext: boolean;
}

/** A day of the user's plan ("Push day"). */
export interface Routine {
  id: number;
  name: string;
  notes: string | null;
  exercises: RoutineExercise[];
}

/** A routine as shown in the list, with when it was last done. */
export interface RoutineSummary extends Routine {
  lastDone: string | null;
}

/** A body measurement; everything except the weight is optional (smart-scale values). */
export interface BodyMeasurement {
  id: number;
  measuredAt: string; // ISO date
  weightKg: number;
  bodyFatPct: number | null;
  muscleKg: number | null;
  waterPct: number | null;
  visceralFat: number | null;
}

export interface Settings {
  heightCm: number | null;
  birthDate: string | null; // YYYY-MM-DD
  weeklyGoal: number;
  defaultRestSeconds: number;
  vibrateOnRestEnd: boolean;
  onboarded: boolean;
}
