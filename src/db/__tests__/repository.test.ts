/**
 * @jest-environment node
 */
import {
  addSet,
  createExercise,
  deleteSet,
  DuplicateExerciseError,
  exerciseSessions,
  finishWorkout,
  getActiveWorkout,
  getWorkoutBlocks,
  listExercises,
  listWorkoutSummaries,
  previousSets,
  startWorkout,
  updateSet,
} from '../repository';
import { DEFAULT_EXERCISES } from '../schema';
import type { Db } from '../db';
import { createTestDb } from './test-db';

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

async function exerciseId(name: string): Promise<number> {
  const all = await listExercises(db);
  return all.find((e) => e.name === name)!.id;
}

/** Adds `sets` completed sets of one exercise to a workout. */
async function logSets(workoutId: number, exercise: number, sets: [number, number][]) {
  for (const [reps, weightKg] of sets) {
    const id = await addSet(db, workoutId, exercise);
    await updateSet(db, id, { reps, weightKg, completed: true });
  }
}

describe('exercises', () => {
  it('seeds the default library on first launch', async () => {
    expect(await listExercises(db)).toHaveLength(DEFAULT_EXERCISES.length);
  });

  it('creates custom exercises and refuses duplicates regardless of case', async () => {
    await createExercise(db, '  Bulgarian   Split Squat ', 'Legs');
    const created = (await listExercises(db)).find((e) => e.name === 'Bulgarian Split Squat');
    expect(created).toMatchObject({ muscleGroup: 'Legs', isCustom: true, sessions: 0 });

    await expect(createExercise(db, 'bench press', 'Chest')).rejects.toBeInstanceOf(DuplicateExerciseError);
  });
});

describe('workouts', () => {
  it('keeps a single workout in progress', async () => {
    const first = await startWorkout(db);
    expect(await startWorkout(db)).toBe(first);
    expect((await getActiveWorkout(db))?.id).toBe(first);
  });

  it('drops unticked sets on finish and deletes an empty workout', async () => {
    const bench = await exerciseId('Bench Press');
    const id = await startWorkout(db);
    await addSet(db, id, bench); // never completed

    expect(await finishWorkout(db, id)).toBe(false);
    expect(await getActiveWorkout(db)).toBeNull();
    expect(await listWorkoutSummaries(db)).toHaveLength(0);
  });

  it('summarises finished workouts with exercises in the order they were done', async () => {
    const squat = await exerciseId('Back Squat');
    const bench = await exerciseId('Bench Press');
    const id = await startWorkout(db);
    await logSets(id, squat, [[5, 100], [5, 100]]);
    await logSets(id, bench, [[8, 60]]);
    await addSet(db, id, bench); // unticked: must not count

    expect(await finishWorkout(db, id, ' Felt strong ')).toBe(true);

    const [summary] = await listWorkoutSummaries(db);
    expect(summary).toMatchObject({
      id,
      exerciseNames: ['Back Squat', 'Bench Press'],
      setCount: 3,
      volumeKg: 5 * 100 * 2 + 8 * 60,
    });
  });
});

describe('sets', () => {
  it('pre-fills a new set from the last set, or from last session', async () => {
    const bench = await exerciseId('Bench Press');
    const first = await startWorkout(db);
    await logSets(first, bench, [[8, 60], [6, 65]]);
    await finishWorkout(db, first);

    const second = await startWorkout(db);
    await addSet(db, second, bench);
    let [block] = await getWorkoutBlocks(db, second);
    expect(block.sets[0]).toMatchObject({ setIndex: 1, reps: 8, weightKg: 60, completed: false });

    await updateSet(db, block.sets[0].id, { weightKg: 62.5 });
    await addSet(db, second, bench);
    [block] = await getWorkoutBlocks(db, second);
    expect(block.sets[1]).toMatchObject({ setIndex: 2, reps: 8, weightKg: 62.5 });

    expect(await previousSets(db, bench, second)).toEqual([
      { reps: 8, weightKg: 60 },
      { reps: 6, weightKg: 65 },
    ]);
  });

  it('renumbers the remaining sets after a delete', async () => {
    const row = await exerciseId('Barbell Row');
    const id = await startWorkout(db);
    const a = await addSet(db, id, row);
    await addSet(db, id, row);
    await addSet(db, id, row);

    await deleteSet(db, a);

    const [block] = await getWorkoutBlocks(db, id);
    expect(block.sets.map((s) => s.setIndex)).toEqual([1, 2]);
  });

  it('returns exercise history grouped by workout, newest first', async () => {
    const dl = await exerciseId('Deadlift');
    const w1 = await startWorkout(db);
    await logSets(w1, dl, [[5, 120]]);
    await finishWorkout(db, w1);
    const w2 = await startWorkout(db);
    await logSets(w2, dl, [[5, 125], [3, 135]]);
    await finishWorkout(db, w2);

    const sessions = await exerciseSessions(db, dl);
    expect(sessions.map((s) => s.workoutId)).toEqual([w2, w1]);
    expect(sessions[0].sets).toHaveLength(2);
  });
});
