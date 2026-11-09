import type { Db } from './db';
import type {
  BodyMeasurement,
  Exercise,
  ExerciseSession,
  LoadType,
  MuscleGroup,
  RoutineExercise,
  RoutineSummary,
  Settings,
  Workout,
  WorkoutSet,
  WorkoutSummary,
} from '@/domain/types';

// ---------------------------------------------------------------------------
// Row types (as stored) and mappers to the app's types
// ---------------------------------------------------------------------------

interface ExerciseRow {
  id: number;
  name: string;
  muscle_group: string;
  is_custom: number;
  load_type: string;
}

interface WorkoutRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  notes: string | null;
  routine_id: number | null;
}

interface SetRow {
  id: number;
  workout_id: number;
  exercise_id: number;
  set_index: number;
  reps: number;
  weight_kg: number;
  completed: number;
}

const toExercise = (r: ExerciseRow): Exercise => ({
  id: r.id,
  name: r.name,
  muscleGroup: r.muscle_group as MuscleGroup,
  isCustom: r.is_custom === 1,
  loadType: (r.load_type ?? 'barbell') as LoadType,
});

const toWorkout = (r: WorkoutRow): Workout => ({
  id: r.id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  notes: r.notes,
  routineId: r.routine_id ?? null,
});

const toSet = (r: SetRow): WorkoutSet => ({
  id: r.id,
  workoutId: r.workout_id,
  exerciseId: r.exercise_id,
  setIndex: r.set_index,
  reps: r.reps,
  weightKg: r.weight_kg,
  completed: r.completed === 1,
});

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export interface ExerciseListItem extends Exercise {
  sessions: number;
  lastDone: string | null;
}

export async function listExercises(db: Db): Promise<ExerciseListItem[]> {
  const rows = await db.getAllAsync<ExerciseRow & { sessions: number; last_done: string | null }>(`
    SELECT e.*,
           COUNT(DISTINCT w.id) AS sessions,
           MAX(w.started_at)    AS last_done
    FROM exercises e
    LEFT JOIN workout_sets s ON s.exercise_id = e.id AND s.completed = 1
    LEFT JOIN workouts w     ON w.id = s.workout_id AND w.finished_at IS NOT NULL
    GROUP BY e.id
    ORDER BY e.name COLLATE NOCASE
  `);
  return rows.map((r) => ({ ...toExercise(r), sessions: r.sessions, lastDone: r.last_done }));
}

export async function getExercise(db: Db, id: number): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', id);
  return row ? toExercise(row) : null;
}

export class DuplicateExerciseError extends Error {
  constructor(name: string) {
    super(`"${name}" already exists`);
  }
}

export async function createExercise(
  db: Db,
  name: string,
  muscleGroup: MuscleGroup,
  loadType: LoadType = 'barbell',
): Promise<number> {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean) throw new Error('Name is required');
  const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM exercises WHERE name = ?', clean);
  if (existing) throw new DuplicateExerciseError(clean);
  const result = await db.runAsync(
    'INSERT INTO exercises (name, muscle_group, is_custom, load_type) VALUES (?, ?, 1, ?)',
    clean,
    muscleGroup,
    loadType,
  );
  return result.lastInsertRowId;
}

/** Completed sets of one exercise, grouped by finished workout, newest first. */
export async function exerciseSessions(db: Db, exerciseId: number): Promise<ExerciseSession[]> {
  const rows = await db.getAllAsync<{ workout_id: number; started_at: string; reps: number; weight_kg: number }>(
    `SELECT w.id AS workout_id, w.started_at, s.reps, s.weight_kg
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
     WHERE s.exercise_id = ? AND s.completed = 1 AND w.finished_at IS NOT NULL
     ORDER BY w.started_at DESC, w.id DESC, s.set_index`,
    exerciseId,
  );
  const sessions: ExerciseSession[] = [];
  for (const r of rows) {
    let session = sessions[sessions.length - 1];
    if (!session || session.workoutId !== r.workout_id) {
      session = { workoutId: r.workout_id, date: r.started_at, sets: [] };
      sessions.push(session);
    }
    session.sets.push({ reps: r.reps, weightKg: r.weight_kg });
  }
  return sessions;
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export async function getActiveWorkout(db: Db): Promise<Workout | null> {
  const row = await db.getFirstAsync<WorkoutRow>(
    'SELECT * FROM workouts WHERE finished_at IS NULL ORDER BY id DESC LIMIT 1',
  );
  return row ? toWorkout(row) : null;
}

/** Starts a new workout, or returns the one already in progress (there is never more than one). */
export async function startWorkout(db: Db): Promise<number> {
  const active = await getActiveWorkout(db);
  if (active) return active.id;
  const result = await db.runAsync('INSERT INTO workouts (started_at) VALUES (?)', now());
  return result.lastInsertRowId;
}

export async function getWorkout(db: Db, id: number): Promise<Workout | null> {
  const row = await db.getFirstAsync<WorkoutRow>('SELECT * FROM workouts WHERE id = ?', id);
  return row ? toWorkout(row) : null;
}

/**
 * Ends a workout. Sets that were never ticked off are dropped. A workout with no completed
 * set is deleted instead of saved, and the function returns false.
 */
export async function finishWorkout(db: Db, id: number, notes?: string): Promise<boolean> {
  let saved = false;
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workout_sets WHERE workout_id = ? AND completed = 0', id);
    const row = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM workout_sets WHERE workout_id = ?',
      id,
    );
    if (!row || row.n === 0) {
      await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
      return;
    }
    await db.runAsync(
      'UPDATE workouts SET finished_at = ?, notes = ? WHERE id = ?',
      now(),
      notes?.trim() || null,
      id,
    );
    saved = true;
  });
  return saved;
}

export async function setWorkoutNotes(db: Db, id: number, notes: string): Promise<void> {
  await db.runAsync('UPDATE workouts SET notes = ? WHERE id = ?', notes.trim() || null, id);
}

export async function deleteWorkout(db: Db, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workout_sets WHERE workout_id = ?', id);
    await db.runAsync('DELETE FROM workouts WHERE id = ?', id);
  });
}

export async function listWorkoutSummaries(db: Db): Promise<WorkoutSummary[]> {
  const rows = await db.getAllAsync<{
    id: number;
    started_at: string;
    finished_at: string;
    routine_name: string | null;
    set_count: number;
    volume: number;
  }>(`
    SELECT w.id, w.started_at, w.finished_at, r.name AS routine_name,
           COUNT(s.id) AS set_count,
           COALESCE(SUM(s.reps * s.weight_kg), 0) AS volume
    FROM workouts w
    LEFT JOIN routines r     ON r.id = w.routine_id
    LEFT JOIN workout_sets s ON s.workout_id = w.id AND s.completed = 1
    WHERE w.finished_at IS NOT NULL
    GROUP BY w.id
    ORDER BY w.started_at DESC, w.id DESC
  `);
  // Exercise names per workout, in the order they were first done.
  const names = await db.getAllAsync<{ workout_id: number; name: string }>(`
    SELECT s.workout_id, e.name, MIN(s.id) AS first_set
    FROM workout_sets s
    JOIN exercises e ON e.id = s.exercise_id
    JOIN workouts w  ON w.id = s.workout_id
    WHERE s.completed = 1 AND w.finished_at IS NOT NULL
    GROUP BY s.workout_id, e.id
    ORDER BY s.workout_id, first_set
  `);
  const byWorkout = new Map<number, string[]>();
  for (const n of names) {
    byWorkout.set(n.workout_id, [...(byWorkout.get(n.workout_id) ?? []), n.name]);
  }
  return rows.map((r) => ({
    id: r.id,
    routineName: r.routine_name,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    setCount: r.set_count,
    volumeKg: r.volume,
    exerciseNames: byWorkout.get(r.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Sets inside a workout
// ---------------------------------------------------------------------------

export interface WorkoutExerciseBlock {
  exercise: Exercise;
  sets: WorkoutSet[];
}

/** The workout's sets grouped by exercise, in the order the exercises were added. */
export async function getWorkoutBlocks(db: Db, workoutId: number): Promise<WorkoutExerciseBlock[]> {
  const rows = await db.getAllAsync<SetRow & { name: string; muscle_group: string; is_custom: number; load_type: string }>(
    `SELECT s.*, e.name, e.muscle_group, e.is_custom, e.load_type
     FROM workout_sets s
     JOIN exercises e ON e.id = s.exercise_id
     WHERE s.workout_id = ?
     ORDER BY s.id`,
    workoutId,
  );
  const blocks = new Map<number, WorkoutExerciseBlock>();
  for (const r of rows) {
    if (!blocks.has(r.exercise_id)) {
      blocks.set(r.exercise_id, {
        exercise: toExercise({
          id: r.exercise_id,
          name: r.name,
          muscle_group: r.muscle_group,
          is_custom: r.is_custom,
          load_type: r.load_type,
        }),
        sets: [],
      });
    }
    blocks.get(r.exercise_id)!.sets.push(toSet(r));
  }
  for (const block of blocks.values()) block.sets.sort((a, b) => a.setIndex - b.setIndex);
  return [...blocks.values()];
}

/** Sets of the most recent finished workout that included this exercise (the "previous" column). */
export async function previousSets(
  db: Db,
  exerciseId: number,
  excludeWorkoutId: number,
): Promise<Pick<WorkoutSet, 'reps' | 'weightKg'>[]> {
  const last = await db.getFirstAsync<{ id: number }>(
    `SELECT w.id FROM workouts w
     JOIN workout_sets s ON s.workout_id = w.id
     WHERE s.exercise_id = ? AND s.completed = 1 AND w.finished_at IS NOT NULL AND w.id != ?
     ORDER BY w.started_at DESC, w.id DESC LIMIT 1`,
    exerciseId,
    excludeWorkoutId,
  );
  if (!last) return [];
  const rows = await db.getAllAsync<{ reps: number; weight_kg: number }>(
    `SELECT reps, weight_kg FROM workout_sets
     WHERE workout_id = ? AND exercise_id = ? AND completed = 1 ORDER BY set_index`,
    last.id,
    exerciseId,
  );
  return rows.map((r) => ({ reps: r.reps, weightKg: r.weight_kg }));
}

/**
 * Adds a set, pre-filled so the user only has to tick it off: a copy of the previous set in
 * this workout, or else the matching set from last time, or else empty.
 */
export async function addSet(db: Db, workoutId: number, exerciseId: number): Promise<number> {
  const last = await db.getFirstAsync<SetRow>(
    'SELECT * FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_index DESC LIMIT 1',
    workoutId,
    exerciseId,
  );
  const setIndex = last ? last.set_index + 1 : 1;
  let reps = last?.reps ?? 0;
  let weight = last?.weight_kg ?? 0;
  if (!last) {
    const previous = await previousSets(db, exerciseId, workoutId);
    if (previous[0]) {
      reps = previous[0].reps;
      weight = previous[0].weightKg;
    }
  }
  const result = await db.runAsync(
    `INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed)
     VALUES (?, ?, ?, ?, ?, 0)`,
    workoutId,
    exerciseId,
    setIndex,
    reps,
    weight,
  );
  return result.lastInsertRowId;
}

export async function updateSet(
  db: Db,
  setId: number,
  changes: Partial<Pick<WorkoutSet, 'reps' | 'weightKg' | 'completed'>>,
): Promise<void> {
  const current = await db.getFirstAsync<SetRow>('SELECT * FROM workout_sets WHERE id = ?', setId);
  if (!current) return;
  await db.runAsync(
    'UPDATE workout_sets SET reps = ?, weight_kg = ?, completed = ? WHERE id = ?',
    Math.max(0, Math.round(changes.reps ?? current.reps)),
    Math.max(0, changes.weightKg ?? current.weight_kg),
    (changes.completed ?? current.completed === 1) ? 1 : 0,
    setId,
  );
}

/** Deletes a set and renumbers the remaining sets of that exercise 1, 2, 3… */
export async function deleteSet(db: Db, setId: number): Promise<void> {
  const set = await db.getFirstAsync<SetRow>('SELECT * FROM workout_sets WHERE id = ?', setId);
  if (!set) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM workout_sets WHERE id = ?', setId);
    const rest = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM workout_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_index',
      set.workout_id,
      set.exercise_id,
    );
    for (let i = 0; i < rest.length; i++) {
      await db.runAsync('UPDATE workout_sets SET set_index = ? WHERE id = ?', i + 1, rest[i].id);
    }
  });
}

export async function removeExerciseFromWorkout(db: Db, workoutId: number, exerciseId: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_sets WHERE workout_id = ? AND exercise_id = ?', workoutId, exerciseId);
}

/** Every start date of finished workouts, for the weekly counter. */
export async function finishedWorkoutDates(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ started_at: string }>(
    'SELECT started_at FROM workouts WHERE finished_at IS NOT NULL',
  );
  return rows.map((r) => r.started_at);
}

/** Every completed set of every finished workout, grouped per exercise, for all-time records. */
export async function allSessionsByExercise(db: Db): Promise<Map<number, ExerciseSession[]>> {
  const rows = await db.getAllAsync<{
    exercise_id: number;
    workout_id: number;
    started_at: string;
    reps: number;
    weight_kg: number;
  }>(
    `SELECT s.exercise_id, w.id AS workout_id, w.started_at, s.reps, s.weight_kg
     FROM workout_sets s
     JOIN workouts w ON w.id = s.workout_id
     WHERE s.completed = 1 AND w.finished_at IS NOT NULL
     ORDER BY s.exercise_id, w.started_at, w.id, s.set_index`,
  );
  const result = new Map<number, ExerciseSession[]>();
  for (const r of rows) {
    const list = result.get(r.exercise_id) ?? [];
    let session = list[list.length - 1];
    if (!session || session.workoutId !== r.workout_id) {
      session = { workoutId: r.workout_id, date: r.started_at, sets: [] };
      list.push(session);
    }
    session.sets.push({ reps: r.reps, weightKg: r.weight_kg });
    result.set(r.exercise_id, list);
  }
  return result;
}

export interface Totals {
  workouts: number;
  seconds: number;
  volumeKg: number;
}

export async function allTimeTotals(db: Db): Promise<Totals> {
  const w = await db.getFirstAsync<{ n: number; secs: number | null }>(
    `SELECT COUNT(*) AS n,
            SUM((julianday(finished_at) - julianday(started_at)) * 86400) AS secs
     FROM workouts WHERE finished_at IS NOT NULL`,
  );
  const v = await db.getFirstAsync<{ volume: number | null }>(
    `SELECT SUM(s.reps * s.weight_kg) AS volume
     FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
     WHERE s.completed = 1 AND w.finished_at IS NOT NULL`,
  );
  return { workouts: w?.n ?? 0, seconds: Math.round(w?.secs ?? 0), volumeKg: v?.volume ?? 0 };
}

// ---------------------------------------------------------------------------
// Routines (the user's plan)
// ---------------------------------------------------------------------------

interface RoutineExerciseRow {
  routine_id: number;
  exercise_id: number;
  name: string;
  load_type: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  target_kg: number | null;
  rest_seconds: number;
}

const toRoutineExercise = (r: RoutineExerciseRow): RoutineExercise => ({
  exerciseId: r.exercise_id,
  name: r.name,
  loadType: r.load_type as LoadType,
  sets: r.sets,
  repsMin: r.reps_min,
  repsMax: r.reps_max,
  targetKg: r.target_kg,
  restSeconds: r.rest_seconds,
});

async function routineExercises(db: Db, routineId?: number): Promise<RoutineExerciseRow[]> {
  return db.getAllAsync<RoutineExerciseRow>(
    `SELECT re.routine_id, re.exercise_id, e.name, e.load_type, re.sets, re.reps_min, re.reps_max,
            re.target_kg, re.rest_seconds
     FROM routine_exercises re
     JOIN exercises e ON e.id = re.exercise_id
     ${routineId === undefined ? '' : 'WHERE re.routine_id = ?'}
     ORDER BY re.routine_id, re.position`,
    ...(routineId === undefined ? [] : [routineId]),
  );
}

export async function listRoutines(db: Db): Promise<RoutineSummary[]> {
  const rows = await db.getAllAsync<{ id: number; name: string; notes: string | null; last_done: string | null }>(
    `SELECT r.id, r.name, r.notes,
            (SELECT MAX(w.started_at) FROM workouts w WHERE w.routine_id = r.id AND w.finished_at IS NOT NULL) AS last_done
     FROM routines r
     ORDER BY r.position, r.id`,
  );
  const exercises = await routineExercises(db);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    notes: r.notes,
    lastDone: r.last_done,
    exercises: exercises.filter((e) => e.routine_id === r.id).map(toRoutineExercise),
  }));
}

export async function getRoutine(db: Db, id: number): Promise<RoutineSummary | null> {
  return (await listRoutines(db)).find((r) => r.id === id) ?? null;
}

export interface RoutineDraft {
  id?: number;
  name: string;
  notes?: string | null;
  exercises: Omit<RoutineExercise, 'name' | 'loadType'>[];
}

/** Creates or replaces a routine and its exercises. Returns its id. */
export async function saveRoutine(db: Db, draft: RoutineDraft): Promise<number> {
  const name = draft.name.trim();
  if (!name) throw new Error('Give the routine a name');
  if (draft.exercises.length === 0) throw new Error('Add at least one exercise');
  let id = draft.id;
  await db.withTransactionAsync(async () => {
    if (id === undefined) {
      const pos = await db.getFirstAsync<{ p: number | null }>('SELECT MAX(position) AS p FROM routines');
      const result = await db.runAsync(
        'INSERT INTO routines (name, notes, position, created_at) VALUES (?, ?, ?, ?)',
        name,
        draft.notes?.trim() || null,
        (pos?.p ?? -1) + 1,
        now(),
      );
      id = result.lastInsertRowId;
    } else {
      await db.runAsync('UPDATE routines SET name = ?, notes = ? WHERE id = ?', name, draft.notes?.trim() || null, id);
      await db.runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', id);
    }
    for (const [position, e] of draft.exercises.entries()) {
      const repsMin = Math.max(1, Math.round(e.repsMin));
      await db.runAsync(
        `INSERT INTO routine_exercises
           (routine_id, exercise_id, position, sets, reps_min, reps_max, target_kg, rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id!,
        e.exerciseId,
        position,
        Math.max(1, Math.round(e.sets)),
        repsMin,
        Math.max(repsMin, Math.round(e.repsMax)),
        e.targetKg && e.targetKg > 0 ? e.targetKg : null,
        Math.max(0, Math.round(e.restSeconds)),
      );
    }
  });
  return id!;
}

export async function deleteRoutine(db: Db, id: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    // Past workouts keep their sets; they just stop pointing at the routine.
    await db.runAsync('UPDATE workouts SET routine_id = NULL WHERE routine_id = ?', id);
    await db.runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', id);
    await db.runAsync('DELETE FROM routines WHERE id = ?', id);
  });
}

/** Sets new target weights after a workout ("Update routine" on the summary). */
export async function updateRoutineTargets(
  db: Db,
  routineId: number,
  targets: { exerciseId: number; targetKg: number }[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const t of targets) {
      await db.runAsync(
        'UPDATE routine_exercises SET target_kg = ? WHERE routine_id = ? AND exercise_id = ?',
        t.targetKg,
        routineId,
        t.exerciseId,
      );
    }
  });
}

/**
 * Starts a workout from a routine: every exercise and set is created up front, pre-filled
 * with the target weight (or last time's weight when there is no target) and the top of the
 * rep range. If a workout is already in progress, that one is returned instead.
 */
export async function startWorkoutFromRoutine(db: Db, routineId: number): Promise<number> {
  const active = await getActiveWorkout(db);
  if (active) return active.id;
  const plan = await routineExercises(db, routineId);
  let workoutId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync('INSERT INTO workouts (started_at, routine_id) VALUES (?, ?)', now(), routineId);
    workoutId = result.lastInsertRowId;
    for (const e of plan) {
      const previous = await previousSets(db, e.exercise_id, workoutId);
      for (let i = 0; i < e.sets; i++) {
        const last = previous[i] ?? previous[previous.length - 1];
        await db.runAsync(
          `INSERT INTO workout_sets (workout_id, exercise_id, set_index, reps, weight_kg, completed)
           VALUES (?, ?, ?, ?, ?, 0)`,
          workoutId,
          e.exercise_id,
          i + 1,
          e.reps_max,
          e.target_kg ?? last?.weightKg ?? 0,
        );
      }
    }
  });
  return workoutId;
}

/** The routine plan behind a workout, per exercise id (empty for a free workout). */
export async function workoutPlan(db: Db, workoutId: number): Promise<Map<number, RoutineExercise>> {
  const w = await getWorkout(db, workoutId);
  const plan = new Map<number, RoutineExercise>();
  if (!w?.routineId) return plan;
  for (const r of await routineExercises(db, w.routineId)) plan.set(r.exercise_id, toRoutineExercise(r));
  return plan;
}

export async function getRoutineName(db: Db, id: number | null): Promise<string | null> {
  if (id === null) return null;
  const row = await db.getFirstAsync<{ name: string }>('SELECT name FROM routines WHERE id = ?', id);
  return row?.name ?? null;
}

// ---------------------------------------------------------------------------
// Body measurements
// ---------------------------------------------------------------------------

interface BodyRow {
  id: number;
  measured_at: string;
  weight_kg: number;
  body_fat_pct: number | null;
  muscle_kg: number | null;
  water_pct: number | null;
  visceral_fat: number | null;
}

const toBody = (r: BodyRow): BodyMeasurement => ({
  id: r.id,
  measuredAt: r.measured_at,
  weightKg: r.weight_kg,
  bodyFatPct: r.body_fat_pct,
  muscleKg: r.muscle_kg,
  waterPct: r.water_pct,
  visceralFat: r.visceral_fat,
});

/** Newest first. */
export async function listMeasurements(db: Db): Promise<BodyMeasurement[]> {
  const rows = await db.getAllAsync<BodyRow>('SELECT * FROM body_measurements ORDER BY measured_at DESC, id DESC');
  return rows.map(toBody);
}

export async function getMeasurement(db: Db, id: number): Promise<BodyMeasurement | null> {
  const row = await db.getFirstAsync<BodyRow>('SELECT * FROM body_measurements WHERE id = ?', id);
  return row ? toBody(row) : null;
}

export type MeasurementInput = Omit<BodyMeasurement, 'id'>;

export async function saveMeasurement(db: Db, m: MeasurementInput, id?: number): Promise<number> {
  if (!(m.weightKg > 0)) throw new Error('Enter your body weight');
  const values = [m.measuredAt, m.weightKg, m.bodyFatPct, m.muscleKg, m.waterPct, m.visceralFat] as const;
  if (id !== undefined) {
    await db.runAsync(
      `UPDATE body_measurements SET measured_at = ?, weight_kg = ?, body_fat_pct = ?, muscle_kg = ?,
         water_pct = ?, visceral_fat = ? WHERE id = ?`,
      ...values,
      id,
    );
    return id;
  }
  const result = await db.runAsync(
    `INSERT INTO body_measurements (measured_at, weight_kg, body_fat_pct, muscle_kg, water_pct, visceral_fat)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ...values,
  );
  return result.lastInsertRowId;
}

export async function deleteMeasurement(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM body_measurements WHERE id = ?', id);
}

// ---------------------------------------------------------------------------
// Settings (key/value)
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: Settings = {
  heightCm: null,
  birthDate: null,
  weeklyGoal: 3,
  defaultRestSeconds: 90,
  vibrateOnRestEnd: true,
  onboarded: false,
};

export async function getSettings(db: Db): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(db: Db, changes: Partial<Settings>): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(changes)) {
      if (!(key in DEFAULT_SETTINGS)) continue;
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        JSON.stringify(value),
      );
    }
  });
}

/** Volume of the last finished workout of the same routine before `beforeIso`, for "+320 kg vs last time". */
export async function previousRoutineVolume(db: Db, routineId: number, beforeIso: string): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM workouts
     WHERE routine_id = ? AND finished_at IS NOT NULL AND started_at < ?
     ORDER BY started_at DESC, id DESC LIMIT 1`,
    routineId,
    beforeIso,
  );
  if (!row) return null;
  const v = await db.getFirstAsync<{ volume: number | null }>(
    'SELECT SUM(reps * weight_kg) AS volume FROM workout_sets WHERE workout_id = ? AND completed = 1',
    row.id,
  );
  return v?.volume ?? 0;
}
