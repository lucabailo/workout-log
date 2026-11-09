import { formatClock, formatDuration, formatKg, parseNumber } from '../format';
import {
  estimatedOneRepMax,
  newRecordIndexes,
  oneRepMaxProgress,
  personalRecords,
  volume,
  workoutsThisWeek,
} from '../stats';
import type { ExerciseSession } from '../types';

const session = (date: string, sets: [number, number][]): ExerciseSession => ({
  workoutId: 0,
  date,
  sets: sets.map(([reps, weightKg]) => ({ reps, weightKg })),
});

describe('estimatedOneRepMax', () => {
  it('uses the Epley formula', () => {
    expect(estimatedOneRepMax({ reps: 1, weightKg: 100 })).toBe(100);
    expect(estimatedOneRepMax({ reps: 10, weightKg: 60 })).toBeCloseTo(80);
    expect(estimatedOneRepMax({ reps: 0, weightKg: 100 })).toBe(0);
  });
});

describe('records and progress', () => {
  const history = [
    session('2026-10-01T10:00:00Z', [[5, 100], [5, 100]]),
    session('2026-10-08T10:00:00Z', [[3, 110], [8, 90]]),
  ];

  it('finds the personal records across sessions', () => {
    expect(volume(history[0].sets)).toBe(1000);
    const pr = personalRecords(history);
    expect(pr.heaviestKg).toBe(110);
    expect(pr.bestOneRepMaxKg).toBeCloseTo(121); // 110 kg × 3
    expect(pr.bestSessionVolumeKg).toBe(1050);
    expect(pr.sessions).toBe(2);
  });

  it('builds one chart point per session, oldest first', () => {
    const points = oneRepMaxProgress([...history].reverse());
    expect(points.map((p) => p.date)).toEqual([history[0].date, history[1].date]);
    expect(points[0].value).toBeCloseTo(116.67, 1);
  });

  it('marks only the first set that beats the previous best', () => {
    const current = [
      { reps: 5, weightKg: 100 }, // 116.7: below the previous best of 121
      { reps: 5, weightKg: 105 }, // 122.5: record
      { reps: 5, weightKg: 105 }, // same again: not a second record
      { reps: 3, weightKg: 120 }, // 132: record
    ];
    expect(newRecordIndexes(current, history)).toEqual([1, 3]);
    expect(newRecordIndexes(current, [])).toEqual([]); // first time: just the baseline
  });
});

describe('workoutsThisWeek', () => {
  it('counts from Monday of the current week', () => {
    const wednesday = new Date(2026, 10, 4, 18); // Wed 4 Nov 2026
    const dates = [
      new Date(2026, 10, 2, 9).toISOString(), // Monday: counts
      new Date(2026, 10, 4, 7).toISOString(), // today: counts
      new Date(2026, 10, 1, 20).toISOString(), // Sunday before: does not
    ];
    expect(workoutsThisWeek(dates, wednesday)).toBe(2);
  });
});

describe('formatting', () => {
  it('formats clocks, durations, weights and parses input', () => {
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatDuration('2026-11-06T10:00:00Z', '2026-11-06T11:05:00Z')).toBe('1 h 5 min');
    expect(formatDuration('2026-11-06T10:00:00Z', '2026-11-06T10:42:00Z')).toBe('42 min');
    expect(formatKg(62.5)).toBe('62.5');
    expect(formatKg(1250)).toBe('1,250');
    expect(parseNumber('62,5')).toBe(62.5);
    expect(parseNumber('abc')).toBe(0);
  });
});
