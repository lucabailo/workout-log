import { dayKey, monthGrid, nextWeighInReminder } from '../stats';

describe('monthGrid', () => {
  it('starts on Monday and pads with null', () => {
    // November 2026 starts on a Sunday and has 30 days.
    const weeks = monthGrid(2026, 10);
    expect(weeks).toHaveLength(6);
    expect(weeks[0].slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(weeks[0][6]?.getDate()).toBe(1);
    expect(weeks[5][0]?.getDate()).toBe(30);
    expect(weeks[5].slice(1).every((d) => d === null)).toBe(true);
  });

  it('fits a month starting on Monday in whole weeks', () => {
    // February 2027 starts on a Monday and has 28 days.
    const weeks = monthGrid(2027, 1);
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((d) => d !== null)).toBe(true);
  });
});

describe('dayKey', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('nextWeighInReminder', () => {
  const now = new Date(2026, 10, 10, 12, 0); // Tue 10 Nov, 12:00

  it('is a week after the last weigh-in, at the chosen hour', () => {
    expect(nextWeighInReminder('2026-11-08', 8, now)).toEqual(new Date(2026, 10, 15, 8, 0));
  });

  it('is the next chosen hour when the week is already over', () => {
    expect(nextWeighInReminder('2026-10-20', 8, now)).toEqual(new Date(2026, 10, 11, 8, 0));
    expect(nextWeighInReminder('2026-10-20', 20, now)).toEqual(new Date(2026, 10, 10, 20, 0));
  });

  it('is the next chosen hour when nothing was logged yet', () => {
    expect(nextWeighInReminder(null, 8, now)).toEqual(new Date(2026, 10, 11, 8, 0));
  });
});
