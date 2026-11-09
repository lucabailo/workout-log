/**
 * @jest-environment node
 */
import {
  addSet,
  allSessionsByExercise,
  allTimeTotals,
  deleteRoutine,
  finishWorkout,
  getActiveWorkout,
  getRoutine,
  getSettings,
  getWorkoutBlocks,
  listExercises,
  listMeasurements,
  listRoutines,
  listWorkoutSummaries,
  saveMeasurement,
  saveRoutine,
  saveSettings,
  startWorkoutFromRoutine,
  updateRoutineTargets,
  updateSet,
  workoutPlan,
} from '../repository';
import { SCHEMA_VERSION } from '../schema';
import type { Db } from '../db';
import { createTestDb } from './test-db';

let db: Db;
let bench: number;
let ohp: number;

beforeEach(async () => {
  db = await createTestDb();
  const all = await listExercises(db);
  bench = all.find((e) => e.name === 'Bench Press')!.id;
  ohp = all.find((e) => e.name === 'Overhead Press')!.id;
});

async function pushDay(targetKg: number | null = 80) {
  return saveRoutine(db, {
    name: '  Push day ',
    exercises: [
      { exerciseId: bench, sets: 3, repsMin: 6, repsMax: 8, targetKg, restSeconds: 150 },
      { exerciseId: ohp, sets: 2, repsMin: 8, repsMax: 8, targetKg: null, restSeconds: 120 },
    ],
  });
}

describe('schema v2', () => {
  it('runs every migration and sets load types on default exercises', async () => {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(SCHEMA_VERSION);
    const all = await listExercises(db);
    expect(all.find((e) => e.name === 'Pull-up')?.loadType).toBe('bodyweight');
    expect(all.find((e) => e.name === 'Hammer Curl')?.loadType).toBe('dumbbell');
    expect(all.find((e) => e.name === 'Back Squat')?.loadType).toBe('barbell');
  });
});

describe('routines', () => {
  it('saves a routine with its exercises in order', async () => {
    const id = await pushDay();
    const r = await getRoutine(db, id);
    expect(r?.name).toBe('Push day');
    expect(r?.exercises.map((e) => [e.name, e.sets, e.repsMin, e.repsMax, e.targetKg])).toEqual([
      ['Bench Press', 3, 6, 8, 80],
      ['Overhead Press', 2, 8, 8, null],
    ]);
  });

  it('replaces the exercises when edited', async () => {
    const id = await pushDay();
    await saveRoutine(db, {
      id,
      name: 'Push',
      exercises: [{ exerciseId: ohp, sets: 4, repsMin: 10, repsMax: 6, targetKg: 0, restSeconds: 90 }],
    });
    const r = await getRoutine(db, id);
    expect(r?.name).toBe('Push');
    // reps max is never below min, and a target of 0 means "no target"
    expect(r?.exercises).toEqual([expect.objectContaining({ exerciseId: ohp, sets: 4, repsMin: 10, repsMax: 10, targetKg: null })]);
    expect(await listRoutines(db)).toHaveLength(1);
  });

  it('refuses a routine without a name or exercises', async () => {
    await expect(saveRoutine(db, { name: ' ', exercises: [] })).rejects.toThrow('name');
    await expect(saveRoutine(db, { name: 'Legs', exercises: [] })).rejects.toThrow('exercise');
  });

  it('starts a workout with every set pre-filled from the plan', async () => {
    // last time: OHP 40 kg × 8 for two sets
    const earlier = await startWorkoutFromRoutine(db, await pushDay());
    const firstBlocks = await getWorkoutBlocks(db, earlier);
    for (const b of firstBlocks) for (const s of b.sets) await updateSet(db, s.id, { weightKg: b.exercise.id === ohp ? 40 : 80, completed: true });
    await finishWorkout(db, earlier);

    const routineId = (await listRoutines(db))[0].id;
    const workoutId = await startWorkoutFromRoutine(db, routineId);
    const blocks = await getWorkoutBlocks(db, workoutId);
    expect(blocks.map((b) => [b.exercise.name, b.sets.length])).toEqual([
      ['Bench Press', 3],
      ['Overhead Press', 2],
    ]);
    expect(blocks[0].sets[0]).toMatchObject({ weightKg: 80, reps: 8, completed: false }); // target, top of range
    expect(blocks[1].sets[1]).toMatchObject({ weightKg: 40, reps: 8 }); // no target: last time
    expect((await workoutPlan(db, workoutId)).get(bench)?.restSeconds).toBe(150);
    // only one workout at a time
    expect(await startWorkoutFromRoutine(db, routineId)).toBe(workoutId);
  });

  it('shows the routine name in the history and when it was last done', async () => {
    const id = await pushDay();
    const w = await startWorkoutFromRoutine(db, id);
    const sets = (await getWorkoutBlocks(db, w))[0].sets;
    await updateSet(db, sets[0].id, { completed: true });
    await finishWorkout(db, w);
    expect((await listWorkoutSummaries(db))[0].routineName).toBe('Push day');
    expect((await getRoutine(db, id))?.lastDone).not.toBeNull();
  });

  it('updates targets after a workout', async () => {
    const id = await pushDay();
    await updateRoutineTargets(db, id, [{ exerciseId: bench, targetKg: 82.5 }]);
    expect((await getRoutine(db, id))?.exercises[0].targetKg).toBe(82.5);
  });

  it('deleting a routine keeps the workouts done with it', async () => {
    const id = await pushDay();
    const w = await startWorkoutFromRoutine(db, id);
    const set = (await getWorkoutBlocks(db, w))[0].sets[0];
    await updateSet(db, set.id, { completed: true });
    await finishWorkout(db, w);
    await deleteRoutine(db, id);
    expect(await listRoutines(db)).toHaveLength(0);
    const history = await listWorkoutSummaries(db);
    expect(history).toHaveLength(1);
    expect(history[0].routineName).toBeNull();
  });
});

describe('totals', () => {
  it('adds up finished workouts only', async () => {
    const id = await pushDay();
    const w = await startWorkoutFromRoutine(db, id);
    const set = (await getWorkoutBlocks(db, w))[0].sets[0];
    await updateSet(db, set.id, { completed: true, reps: 10, weightKg: 80 });
    await finishWorkout(db, w);
    const open = await startWorkoutFromRoutine(db, id);
    await addSet(db, open, bench);
    const totals = await allTimeTotals(db);
    expect(totals).toMatchObject({ workouts: 1, volumeKg: 800 });
    expect((await allSessionsByExercise(db)).get(bench)).toHaveLength(1);
    expect(await getActiveWorkout(db)).not.toBeNull();
  });
});

describe('body measurements', () => {
  it('stores optional smart-scale values and lists newest first', async () => {
    await saveMeasurement(db, { measuredAt: '2026-11-01', weightKg: 79, bodyFatPct: null, muscleKg: null, waterPct: null, visceralFat: null });
    const id = await saveMeasurement(db, { measuredAt: '2026-11-08', weightKg: 78.4, bodyFatPct: 16, muscleKg: 36.1, waterPct: null, visceralFat: null });
    const list = await listMeasurements(db);
    expect(list.map((m) => m.weightKg)).toEqual([78.4, 79]);
    await saveMeasurement(db, { ...list[0], weightKg: 78.2 }, id);
    expect((await listMeasurements(db))[0]).toMatchObject({ weightKg: 78.2, bodyFatPct: 16 });
  });

  it('requires a weight', async () => {
    await expect(
      saveMeasurement(db, { measuredAt: '2026-11-08', weightKg: 0, bodyFatPct: null, muscleKg: null, waterPct: null, visceralFat: null }),
    ).rejects.toThrow('weight');
  });
});

describe('settings', () => {
  it('returns defaults and saves changes', async () => {
    expect(await getSettings(db)).toMatchObject({ weeklyGoal: 3, onboarded: false, heightCm: null });
    await saveSettings(db, { weeklyGoal: 4, heightCm: 182, onboarded: true });
    await saveSettings(db, { weeklyGoal: 5 });
    expect(await getSettings(db)).toMatchObject({ weeklyGoal: 5, heightCm: 182, onboarded: true });
  });
});
