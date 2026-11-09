/**
 * @jest-environment node
 */
import { defaultPlan, parseScheme } from '@/domain/plan';
import {
  activeWorkoutStatus,
  deleteRoutine,
  deleteSet,
  exerciseOneRepMax,
  finishWorkout,
  getProgram,
  getRoutine,
  getWorkoutBlocks,
  listExercises,
  listPrograms,
  listWorkoutSummaries,
  saveProgram,
  saveRoutine,
  setOneRepMax,
  startWorkoutFromRoutine,
  updateSet,
  workoutTargets,
} from '../repository';
import type { Db } from '../db';
import { createTestDb } from './test-db';

let db: Db;
let ohp: number;
let raise: number;
let pullup: number;

beforeEach(async () => {
  db = await createTestDb();
  const all = await listExercises(db);
  ohp = all.find((e) => e.name === 'Overhead Press')!.id;
  raise = all.find((e) => e.name === 'Lateral Raise')!.id;
  pullup = all.find((e) => e.name === 'Pull-up')!.id;
});

const ex = (exerciseId: number, plan = defaultPlan(), extra = {}) => ({
  exerciseId,
  sets: 3,
  repsMin: 6,
  repsMax: 6,
  targetKg: 10,
  restSeconds: 60,
  plan,
  ...extra,
});

async function doWorkout(routineId: number, programId?: number) {
  const id = await startWorkoutFromRoutine(db, routineId, { programId });
  for (const b of await getWorkoutBlocks(db, id)) {
    for (const s of b.sets) if (s.dropIndex === 0) await updateSet(db, s.id, { completed: true, reps: s.reps || 8 });
  }
  await finishWorkout(db, id);
  return id;
}

describe('advanced plans', () => {
  it('creates drop sets as linked rows and ticks them together', async () => {
    const r = await saveRoutine(db, { name: 'F', exercises: [ex(raise, { ...defaultPlan(), kind: 'drop', drops: 2 })] });
    const id = await startWorkoutFromRoutine(db, r);
    const [block] = await getWorkoutBlocks(db, id);
    expect(block.sets.map((s) => [s.setIndex, s.dropIndex, s.weightKg])).toEqual([
      [1, 0, 10], [1, 1, 7.5], [1, 2, 5.5],
      [2, 0, 10], [2, 1, 7.5], [2, 2, 5.5],
      [3, 0, 10], [3, 1, 7.5], [3, 2, 5.5],
    ]);
    await updateSet(db, block.sets[0].id, { completed: true });
    const after = (await getWorkoutBlocks(db, id))[0].sets;
    expect(after.slice(0, 3).every((s) => s.completed)).toBe(true);
    expect((await activeWorkoutStatus(db))!.doneSets).toBe(1);
    expect((await activeWorkoutStatus(db))!.totalSets).toBe(3);

    await deleteSet(db, after[0].id); // removes the whole first set, drops included
    const left = (await getWorkoutBlocks(db, id))[0].sets;
    expect(left).toHaveLength(6);
    expect(left.map((s) => s.setIndex)).toEqual([1, 1, 1, 2, 2, 2]);

    await updateSet(db, left[0].id, { completed: true });
    await finishWorkout(db, id);
    const [summary] = await listWorkoutSummaries(db);
    expect(summary.setCount).toBe(1);
    expect(summary.volumeKg).toBe(6 * 10 + 6 * 7.5 + 6 * 5.5);
  });

  it('creates max sets with no reps to reach', async () => {
    const r = await saveRoutine(db, { name: 'E', exercises: [ex(pullup, { ...defaultPlan(), kind: 'max' }, { targetKg: null })] });
    const id = await startWorkoutFromRoutine(db, r);
    const [block] = await getWorkoutBlocks(db, id);
    expect(block.sets.map((s) => [s.kind, s.reps])).toEqual([['max', 0], ['max', 0], ['max', 0]]);
  });

  it('follows the progression one step per finished workout, with % of the 1RM', async () => {
    const plan = {
      ...defaultPlan(),
      mode: 'progression' as const,
      progression: {
        unit: 'pct' as const,
        reserveRep: true,
        steps: [70, 75, 80, 85].map((load, i) => ({ sets: parseScheme(`4x${[12, 9, 6, 3][i]}`)!, load })),
      },
    };
    const r = await saveRoutine(db, { name: 'D', exercises: [ex(ohp, plan)] });
    expect((await getRoutine(db, r))!.exercises[0].plan).toEqual(plan);
    await setOneRepMax(db, ohp, 60);

    const first = await startWorkoutFromRoutine(db, r);
    let [block] = await getWorkoutBlocks(db, first);
    expect(block.sets.map((s) => [s.reps, s.weightKg])).toEqual(Array(4).fill([12, 42.5]));
    expect((await workoutTargets(db, first)).get(ohp)!.step).toBe(0);
    for (const s of block.sets) await updateSet(db, s.id, { completed: true });
    await finishWorkout(db, first);

    const second = await startWorkoutFromRoutine(db, r);
    [block] = await getWorkoutBlocks(db, second);
    expect(block.sets.map((s) => [s.reps, s.weightKg])).toEqual(Array(4).fill([9, 45]));
    expect((await workoutTargets(db, second)).get(ohp)!.step).toBe(1);
  });

  it('estimates the 1RM from history when none was typed', async () => {
    expect(await exerciseOneRepMax(db, ohp)).toBeNull();
    const r = await saveRoutine(db, { name: 'D', exercises: [ex(ohp, defaultPlan(), { targetKg: 60, sets: 1 })] });
    await doWorkout(r); // 60 kg × 6 reps
    expect(await exerciseOneRepMax(db, ohp)).toBe(72);
    await setOneRepMax(db, ohp, 70);
    expect(await exerciseOneRepMax(db, ohp)).toBe(70);
  });
});

describe('programs', () => {
  it('saves the intro and rotation, and moves on after each program workout', async () => {
    const [a, d, e] = [
      await saveRoutine(db, { name: 'A', exercises: [ex(ohp)] }),
      await saveRoutine(db, { name: 'D', exercises: [ex(ohp)] }),
      await saveRoutine(db, { name: 'E', exercises: [ex(raise)] }),
    ];
    const p = await saveProgram(db, { name: 'Dad’s split', intro: [a], rotation: [d, e] });
    let program = (await getProgram(db, p))!;
    expect(program.intro.map((x) => x.name)).toEqual(['A']);
    expect(program.rotation.map((x) => x.name)).toEqual(['D', 'E']);
    expect(program.position).toBe(0);

    await doWorkout(a, p);
    await doWorkout(d); // not from the program: does not move it
    await doWorkout(d, p);
    program = (await getProgram(db, p))!;
    expect(program.position).toBe(2);

    // a discarded workout (nothing ticked) does not count
    const empty = await startWorkoutFromRoutine(db, e, { programId: p });
    await finishWorkout(db, empty);
    expect((await getProgram(db, p))!.position).toBe(2);

    await saveProgram(db, { id: p, name: 'Renamed', intro: [], rotation: [e, d], position: 5 });
    program = (await getProgram(db, p))!;
    expect([program.name, program.position, program.rotation.map((x) => x.name)]).toEqual(['Renamed', 5, ['E', 'D']]);

    await deleteRoutine(db, e);
    expect((await listPrograms(db))[0].rotation.map((x) => x.name)).toEqual(['D']);
  });

  it('needs a name and a rotation', async () => {
    await expect(saveProgram(db, { name: ' ', intro: [], rotation: [1] })).rejects.toThrow();
    await expect(saveProgram(db, { name: 'P', intro: [], rotation: [] })).rejects.toThrow();
  });
});
