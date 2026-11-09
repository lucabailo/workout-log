import { dayKey, monthGrid } from '../stats';

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
