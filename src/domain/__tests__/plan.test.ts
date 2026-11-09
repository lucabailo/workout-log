import { formatDateInput, formatReps, formatRest, parseDate, parseReps, parseRest } from '../format';
import { looksForgotten, plannedSets, suggestedTargetUpdates, supersetLabels } from '../routines';
import { activityGrid, recordCount, weeklyStreak } from '../stats';
import { defaultPlan } from '../plan';
import type { ExerciseSession, RoutineExercise } from '../types';

// Wednesday 11 Nov 2026, local time
const NOW = new Date(2026, 10, 11, 12, 0, 0);
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 18, 0, 0).toISOString();

describe('reps and rest', () => {
  it('formats and parses rep ranges', () => {
    expect(formatReps(6, 8)).toBe('6–8');
    expect(formatReps(8, 8)).toBe('8');
    expect(parseReps('6-8')).toEqual({ min: 6, max: 8 });
    expect(parseReps('10 – 8')).toEqual({ min: 8, max: 10 });
    expect(parseReps('12')).toEqual({ min: 12, max: 12 });
    expect(parseReps('0')).toBeNull();
    expect(parseReps('abc')).toBeNull();
  });

  it('formats and parses rest times', () => {
    expect(formatRest(150)).toBe('2:30');
    expect(formatRest(45)).toBe('45 s');
    expect(parseRest('2:30')).toBe(150);
    expect(parseRest('90')).toBe(90);
    expect(parseRest('2')).toBe(120);
    expect(parseRest('x')).toBeNull();
  });
});

describe('weeklyStreak', () => {
  // weeks: this week (Mon 9 Nov) 1 workout, last week 3, the week before 3, then 1
  const dates = [
    day(2026, 11, 10),
    day(2026, 11, 2), day(2026, 11, 4), day(2026, 11, 6),
    day(2026, 10, 26), day(2026, 10, 28), day(2026, 10, 30),
    day(2026, 10, 20),
  ];

  it('counts back from last week while the current week is still open', () => {
    expect(weeklyStreak(dates, 3, NOW)).toBe(2);
  });

  it('includes the current week once the goal is met', () => {
    expect(weeklyStreak(dates, 1, NOW)).toBe(4);
  });

  it('is zero without workouts', () => {
    expect(weeklyStreak([], 3, NOW)).toBe(0);
  });
});

describe('activityGrid', () => {
  it('marks trained days, Monday first, current week last', () => {
    const grid = activityGrid([day(2026, 11, 10), day(2026, 11, 2), day(2026, 8, 1)], 4, NOW);
    expect(grid).toHaveLength(4);
    expect(grid[3][1]).toBe(true); // Tue 10 Nov
    expect(grid[2][0]).toBe(true); // Mon 2 Nov
    expect(grid.flat().filter(Boolean)).toHaveLength(2); // August is outside the window
  });
});

describe('recordCount', () => {
  const s = (date: string, sets: [number, number][]): ExerciseSession => ({
    workoutId: 0,
    date,
    sets: sets.map(([reps, weightKg]) => ({ reps, weightKg })),
  });

  it('counts workouts that beat all earlier ones, not the first', () => {
    const bench = [s('2026-10-01', [[5, 80]]), s('2026-10-08', [[5, 85]]), s('2026-10-15', [[5, 82.5]])];
    const squat = [s('2026-10-02', [[5, 100]])];
    expect(recordCount([bench, squat])).toBe(1);
  });
});

describe('suggestedTargetUpdates', () => {
  const plan: RoutineExercise[] = [
    { exerciseId: 1, name: 'Bench Press', loadType: 'barbell', sets: 4, repsMin: 6, repsMax: 8, targetKg: 80, restSeconds: 150, supersetWithNext: false, plan: defaultPlan() },
    { exerciseId: 2, name: 'Overhead Press', loadType: 'barbell', sets: 3, repsMin: 8, repsMax: 8, targetKg: 45, restSeconds: 120, supersetWithNext: false, plan: defaultPlan() },
    { exerciseId: 3, name: 'Lateral Raise', loadType: 'dumbbell', sets: 3, repsMin: 12, repsMax: 15, targetKg: null, restSeconds: 60, supersetWithNext: false, plan: defaultPlan() },
  ];

  it('suggests the heaviest weight done for at least the bottom of the range', () => {
    const done = new Map([
      [1, [{ reps: 8, weightKg: 82.5 }, { reps: 5, weightKg: 85 }]],
      [2, [{ reps: 8, weightKg: 45 }]],
      [3, [{ reps: 12, weightKg: 12 }]],
    ]);
    expect(suggestedTargetUpdates(plan, done)).toEqual([
      { exerciseId: 1, name: 'Bench Press', fromKg: 80, toKg: 82.5 },
    ]);
  });

  it('adds up planned sets', () => {
    expect(plannedSets(plan)).toBe(10);
  });
});

describe('parseDate', () => {
  it('reads day/month/year and rejects impossible dates', () => {
    expect(parseDate('14/03/1999', NOW)).toBe('1999-03-14');
    expect(parseDate('1.2.2001', NOW)).toBe('2001-02-01');
    expect(parseDate('31/02/2000', NOW)).toBeNull();
    expect(parseDate('01/01/2030', NOW)).toBeNull();
    expect(parseDate('1999-03-14', NOW)).toBeNull();
  });
});

describe('formatDateInput', () => {
  it('adds the slashes while typing', () => {
    expect(formatDateInput('1')).toBe('1');
    expect(formatDateInput('14')).toBe('14');
    expect(formatDateInput('140')).toBe('14/0');
    expect(formatDateInput('1403')).toBe('14/03');
    expect(formatDateInput('14031')).toBe('14/03/1');
    expect(formatDateInput('14031999')).toBe('14/03/1999');
  });

  it('ignores anything that is not a digit and stops at 8 digits', () => {
    expect(formatDateInput('14/03/1999')).toBe('14/03/1999');
    expect(formatDateInput('14-03-1999 extra 12')).toBe('14/03/1999');
  });

  it('lets backspace remove a digit next to a slash', () => {
    // "14/0" with the 0 deleted becomes "14/", which is shown as "14"
    expect(formatDateInput('14/')).toBe('14');
    expect(formatDateInput('14/03/')).toBe('14/03');
  });
});

describe('supersetLabels', () => {
  it('labels linked exercises A1, A2… and leaves single ones alone', () => {
    const plan = [
      { exerciseId: 1, supersetWithNext: false, plan: defaultPlan() },
      { exerciseId: 2, supersetWithNext: true },
      { exerciseId: 3, supersetWithNext: false, plan: defaultPlan() },
      { exerciseId: 4, supersetWithNext: true },
      { exerciseId: 5, supersetWithNext: true },
      { exerciseId: 6, supersetWithNext: false, plan: defaultPlan() },
    ];
    expect([...supersetLabels(plan)]).toEqual([
      [2, 'A1'],
      [3, 'A2'],
      [4, 'B1'],
      [5, 'B2'],
      [6, 'B3'],
    ]);
  });
});

describe('looksForgotten', () => {
  it('is true from two hours after the start', () => {
    const start = '2026-11-09T10:00:00.000Z';
    expect(looksForgotten(start, Date.parse('2026-11-09T11:59:00.000Z'))).toBe(false);
    expect(looksForgotten(start, Date.parse('2026-11-09T12:00:00.000Z'))).toBe(true);
  });
});
