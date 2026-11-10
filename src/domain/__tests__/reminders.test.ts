import { finishedCycles, forgottenWorkoutAt, inactivityReminderAt, nextHour, weeklyGoalReminder } from '../reminders';

const now = new Date(2026, 10, 10, 12, 0); // Tuesday 10 Nov 2026, 12:00

describe('nextHour', () => {
  it('is today if still ahead, else tomorrow', () => {
    expect(nextHour(18, now)).toEqual(new Date(2026, 10, 10, 18));
    expect(nextHour(9, now)).toEqual(new Date(2026, 10, 11, 9));
  });
});

describe('forgottenWorkoutAt', () => {
  it('is two hours after the start', () => {
    expect(forgottenWorkoutAt(new Date(2026, 10, 10, 11, 30).toISOString(), now)).toEqual(
      new Date(2026, 10, 10, 13, 30),
    );
  });
  it('is null when that moment is gone', () => {
    expect(forgottenWorkoutAt(new Date(2026, 10, 10, 9, 0).toISOString(), now)).toBeNull();
  });
});

describe('weeklyGoalReminder', () => {
  const monday = new Date(2026, 10, 9, 10).toISOString();
  it('is this Sunday afternoon while the goal is not reached', () => {
    expect(weeklyGoalReminder([monday], 3, now)).toEqual({ at: new Date(2026, 10, 15, 17), done: 1, goal: 3 });
  });
  it('moves to next Sunday once the goal is reached', () => {
    expect(weeklyGoalReminder([monday, monday, monday], 3, now)).toEqual({
      at: new Date(2026, 10, 22, 17),
      done: 0,
      goal: 3,
    });
  });
  it('moves to next Sunday on Sunday evening', () => {
    const sundayNight = new Date(2026, 10, 15, 20);
    expect(weeklyGoalReminder([], 3, sundayNight).at).toEqual(new Date(2026, 10, 22, 17));
  });
});

describe('inactivityReminderAt', () => {
  it('is four days after the last workout at 6 pm', () => {
    expect(inactivityReminderAt(new Date(2026, 10, 9, 19).toISOString(), now)).toEqual(new Date(2026, 10, 13, 18));
  });
  it('is null without workouts or when already past', () => {
    expect(inactivityReminderAt(null, now)).toBeNull();
    expect(inactivityReminderAt(new Date(2026, 10, 1).toISOString(), now)).toBeNull();
  });
});

describe('finishedCycles', () => {
  const ex = [
    { name: 'Overhead Press', steps: 4 },
    { name: 'Leg Press', steps: 2 },
  ];
  it('lists progressions that just completed all their steps', () => {
    expect(finishedCycles(ex, 4).map((e) => e.name)).toEqual(['Overhead Press', 'Leg Press']);
    expect(finishedCycles(ex, 2).map((e) => e.name)).toEqual(['Leg Press']);
    expect(finishedCycles(ex, 3)).toEqual([]);
    expect(finishedCycles(ex, 0)).toEqual([]);
  });
});
