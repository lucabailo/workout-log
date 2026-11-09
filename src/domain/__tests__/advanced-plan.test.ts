import {
  defaultPlan,
  describePlan,
  dropWeights,
  formatScheme,
  parseScheme,
  programSlot,
  readPlan,
  targetsFor,
  writePlan,
  type ExercisePlan,
  type PlanBase,
} from '../plan';

const n = (reps: number) => ({ kind: 'normal' as const, repsMin: reps, repsMax: reps, drops: 0 });

describe('parseScheme', () => {
  it('reads equal sets, with a range after the ×', () => {
    expect(parseScheme('4x12')).toEqual([n(12), n(12), n(12), n(12)]);
    expect(parseScheme('3 × 8-10')).toEqual(Array(3).fill({ kind: 'normal', repsMin: 8, repsMax: 10, drops: 0 }));
  });

  it('reads one number per set', () => {
    expect(parseScheme('12-9-6-6')).toEqual([n(12), n(9), n(6), n(6)]);
    expect(parseScheme('12 - 6 - 12')).toEqual([n(12), n(6), n(12)]);
  });

  it('reads drop sets and max sets', () => {
    expect(parseScheme('3x6+6+6')).toEqual(Array(3).fill({ kind: 'drop', repsMin: 6, repsMax: 6, drops: 2 }));
    expect(parseScheme('3xMAX')).toEqual(Array(3).fill({ kind: 'max', repsMin: 0, repsMax: 0, drops: 0 }));
    expect(parseScheme('12-9-MAX')?.[2].kind).toBe('max');
  });

  it('rejects what it cannot read', () => {
    for (const bad of ['', 'abc', '0x10', '4x', '4x10-8', '12--9', '30x5']) expect(parseScheme(bad)).toBeNull();
  });

  it('formats back to the short form', () => {
    for (const text of ['4 × 12', '3 × 8–10', '12-9-6-6', '3 × 6+6+6', '3 × MAX', '12-6-12-6-12']) {
      expect(formatScheme(parseScheme(text)!)).toBe(text);
    }
  });
});

const base = (plan: Partial<ExercisePlan>, extra: Partial<PlanBase> = {}): PlanBase => ({
  sets: 3,
  repsMin: 8,
  repsMax: 10,
  targetKg: 50,
  plan: { ...defaultPlan(), ...plan },
  ...extra,
});

describe('targetsFor', () => {
  it('repeats the same set for a simple plan', () => {
    const t = targetsFor(base({}), 0, null);
    expect(t.sets).toHaveLength(3);
    expect(t.sets[0]).toEqual({ kind: 'normal', repsMin: 8, repsMax: 10, drops: 0 });
    expect(t.kg).toBe(50);
    expect(t.step).toBeNull();
  });

  it('makes drop and max sets in "same" mode', () => {
    expect(targetsFor(base({ kind: 'drop', drops: 2 }), 0, null).sets[0]).toEqual({ kind: 'drop', repsMin: 8, repsMax: 10, drops: 2 });
    expect(targetsFor(base({ kind: 'max' }), 0, null).sets[0].kind).toBe('max');
  });

  it('uses the per-set list', () => {
    expect(targetsFor(base({ mode: 'perSet', perSet: [n(12), n(9), n(6), n(6)] }), 5, null).sets.map((s) => s.repsMin)).toEqual([
      12, 9, 6, 6,
    ]);
  });

  const progression = (unit: 'kg' | 'pct') =>
    base({
      mode: 'progression',
      progression: {
        unit,
        reserveRep: true,
        steps: [
          { sets: [n(12), n(12)], load: 70 },
          { sets: [n(9), n(9)], load: 75 },
          { sets: [n(6), n(6)], load: 80 },
          { sets: [n(3), n(3)], load: 85 },
        ],
      },
    });

  it('moves one step each time the routine is done, then loops', () => {
    expect([0, 1, 2, 3, 4, 9].map((d) => targetsFor(progression('kg'), d, null).sets[0].repsMin)).toEqual([12, 9, 6, 3, 12, 9]);
    const t = targetsFor(progression('kg'), 1, null);
    expect(t.step).toBe(1);
    expect(t.stepCount).toBe(4);
    expect(t.kg).toBe(75);
  });

  it('turns % of the 1RM into kg, rounded to 2.5', () => {
    const t = targetsFor(progression('pct'), 1, 60);
    expect(t.pct).toBe(75);
    expect(t.kg).toBe(45);
    expect(targetsFor(progression('pct'), 0, 61).kg).toBe(42.5);
    expect(targetsFor(progression('pct'), 0, null).kg).toBeNull();
  });

  it('describes the plan in one line', () => {
    expect(describePlan(base({}))).toBe('3 × 8–10');
    expect(describePlan(base({ kind: 'drop', drops: 2 }, { repsMin: 6, repsMax: 6 }))).toBe('3 × 6+6+6 · drop set');
    expect(describePlan(progression('pct'))).toBe('★ 4 steps: 2 × 12 → 2 × 9 → …');
  });
});

describe('plan storage', () => {
  it('stores nothing for a simple plan and reads old rows as simple', () => {
    expect(writePlan(defaultPlan())).toBeNull();
    expect(readPlan(null)).toEqual(defaultPlan());
    expect(readPlan('not json')).toEqual(defaultPlan());
    const p = { ...defaultPlan(), mode: 'perSet' as const, perSet: [n(5)] };
    expect(readPlan(writePlan(p))).toEqual(p);
  });
});

describe('dropWeights', () => {
  it('suggests about 25% less for each drop', () => {
    expect(dropWeights(10, 2)).toEqual([10, 7.5, 5.5]);
    expect(dropWeights(8, 2)).toEqual([8, 6, 4.5]);
    expect(dropWeights(100, 2)).toEqual([100, 75, 57.5]);
  });
});

describe('programSlot', () => {
  it('does the intro once, then repeats the rotation', () => {
    // A, B, C once, then D…I
    expect(programSlot(3, 6, 0)).toEqual({ phase: 'intro', index: 0, lap: 0 });
    expect(programSlot(3, 6, 2)).toEqual({ phase: 'intro', index: 2, lap: 0 });
    expect(programSlot(3, 6, 3)).toEqual({ phase: 'rotation', index: 0, lap: 1 });
    expect(programSlot(3, 6, 8)).toEqual({ phase: 'rotation', index: 5, lap: 1 });
    expect(programSlot(3, 6, 9)).toEqual({ phase: 'rotation', index: 0, lap: 2 });
  });

  it('starts straight with the rotation when there is no intro', () => {
    expect(programSlot(0, 3, 4)).toEqual({ phase: 'rotation', index: 1, lap: 2 });
    expect(programSlot(0, 0, 0)).toBeNull();
  });
});
