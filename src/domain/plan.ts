/**
 * Advanced targets for one exercise of a routine: reps that change set by set, drop sets,
 * max-rep sets, and progressions that change every time the routine is done.
 * Everything here is pure, so it is tested without a database.
 */

/** normal: straight set · drop: one set made of several mini-sets with less weight · max: as many reps as possible. */
export const SET_KINDS = ['normal', 'drop', 'max'] as const;
export type SetKind = (typeof SET_KINDS)[number];

export interface SetTarget {
  kind: SetKind;
  repsMin: number; // 0 for max sets
  repsMax: number;
  /** Extra mini-sets after the first one (drop sets only): 2 means 6+6+6. */
  drops: number;
}

export const PLAN_MODES = ['same', 'perSet', 'progression'] as const;
export type PlanMode = (typeof PLAN_MODES)[number];

export type LoadUnit = 'kg' | 'pct';

export interface ProgressionStep {
  sets: SetTarget[];
  /** Kg, or % of the one-rep max, depending on the progression's unit. Null = no target. */
  load: number | null;
}

export interface Progression {
  unit: LoadUnit;
  steps: ProgressionStep[];
  /** Stop one rep before failure ("buffer 1 rep"). Shown as a reminder. */
  reserveRep: boolean;
}

export interface ExercisePlan {
  mode: PlanMode;
  /** "same" mode: every set is of this kind. */
  kind: SetKind;
  /** "same" mode with drop sets: extra mini-sets per set. */
  drops: number;
  /** "perSet" mode: one target per set. */
  perSet: SetTarget[];
  progression: Progression | null;
  note: string | null;
}

export const DEFAULT_DROPS = 2;

export function defaultPlan(): ExercisePlan {
  return { mode: 'same', kind: 'normal', drops: DEFAULT_DROPS, perSet: [], progression: null, note: null };
}

/** True when the plan is just "N sets × reps", which the editor shows inline. */
export function isSimplePlan(plan: ExercisePlan): boolean {
  return plan.mode === 'same' && plan.kind === 'normal';
}

// ---------------------------------------------------------------------------
// Text form: "4 × 8–10", "12-9-6-6", "3 × 6+6+6", "3 × MAX"
// ---------------------------------------------------------------------------

function parseOne(token: string): SetTarget | null {
  const t = token.trim().toUpperCase();
  if (t === 'MAX') return { kind: 'max', repsMin: 0, repsMax: 0, drops: 0 };
  if (t.includes('+')) {
    const parts = t.split('+').map((p) => Number(p.trim()));
    if (parts.length < 2 || parts.some((n) => !Number.isInteger(n) || n < 1)) return null;
    return { kind: 'drop', repsMin: parts[0], repsMax: parts[0], drops: parts.length - 1 };
  }
  const range = t.match(/^(\d+)\s*[–-]\s*(\d+)$/);
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])];
    if (a < 1 || b < a) return null;
    return { kind: 'normal', repsMin: a, repsMax: b, drops: 0 };
  }
  if (!/^\d+$/.test(t) || Number(t) < 1) return null;
  return { kind: 'normal', repsMin: Number(t), repsMax: Number(t), drops: 0 };
}

/**
 * Reads what the user typed for one session or exercise.
 * "4x12" or "4 × 8-10" = 4 equal sets (a range is allowed after the ×);
 * "12-9-6-6" = one set per number; "3x6+6+6" = drop sets; "3xMAX" = max-rep sets.
 * Returns null when it can't be read.
 */
export function parseScheme(text: string): SetTarget[] | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  const times = t.match(/^(\d+)\s*[x×*]\s*(.+)$/i);
  if (times) {
    const count = Number(times[1]);
    const one = parseOne(times[2]);
    if (!one || count < 1 || count > 20) return null;
    return Array.from({ length: count }, () => ({ ...one }));
  }
  const sets = t.split(/\s*[-–,]\s*/).map(parseOne);
  if (sets.length > 20 || sets.some((s) => s === null || s.kind === 'normal' && s.repsMin !== s.repsMax)) return null;
  return sets as SetTarget[];
}

/** Reps of one set as text: "8", "8–10", "6+6+6", "MAX". */
export function formatTarget(s: SetTarget): string {
  if (s.kind === 'max') return 'MAX';
  if (s.kind === 'drop') return Array(s.drops + 1).fill(s.repsMin).join('+');
  return s.repsMin === s.repsMax ? String(s.repsMin) : `${s.repsMin}–${s.repsMax}`;
}

/** The inverse of parseScheme: "4 × 12" when all sets match, else "12-9-6-6". */
export function formatScheme(sets: SetTarget[]): string {
  if (sets.length === 0) return '';
  const parts = sets.map(formatTarget);
  if (parts.every((p) => p === parts[0])) return `${sets.length} × ${parts[0]}`;
  return parts.join('-');
}

// ---------------------------------------------------------------------------
// What to do today
// ---------------------------------------------------------------------------

/** The routine-level fields the plan builds on. */
export interface PlanBase {
  sets: number;
  repsMin: number;
  repsMax: number;
  targetKg: number | null;
  plan: ExercisePlan;
}

export interface TodayTargets {
  sets: SetTarget[];
  /** Weight to pre-fill; null = use last time's weight. */
  kg: number | null;
  /** Progression only: which step (0-based) and how many there are. */
  step: number | null;
  stepCount: number;
  /** Progression in % only: the percentage used. */
  pct: number | null;
}

/** Rounds to the nearest 2.5 kg, the smallest jump most gyms have. */
export function roundToPlate(kg: number): number {
  return Math.round(kg / 2.5) * 2.5;
}

/**
 * The sets to do the next time this exercise's routine is done.
 * `timesDone` = finished workouts of the routine so far; progressions loop over their steps.
 * `oneRepMax` turns % loads into kg (null when unknown: then there is no kg target).
 */
export function targetsFor(e: PlanBase, timesDone: number, oneRepMax: number | null): TodayTargets {
  const p = e.plan;
  const none = { step: null, stepCount: 0, pct: null };
  if (p.mode === 'progression' && p.progression && p.progression.steps.length > 0) {
    const steps = p.progression.steps;
    const step = ((timesDone % steps.length) + steps.length) % steps.length;
    const { sets, load } = steps[step];
    if (p.progression.unit === 'pct') {
      const kg = load !== null && oneRepMax ? roundToPlate((oneRepMax * load) / 100) : null;
      return { sets, kg, step, stepCount: steps.length, pct: load };
    }
    return { sets, kg: load, step, stepCount: steps.length, pct: null };
  }
  if (p.mode === 'perSet' && p.perSet.length > 0) return { sets: p.perSet, kg: e.targetKg, ...none };
  const one: SetTarget =
    p.kind === 'max'
      ? { kind: 'max', repsMin: 0, repsMax: 0, drops: 0 }
      : { kind: p.kind, repsMin: e.repsMin, repsMax: e.repsMax, drops: p.kind === 'drop' ? p.drops : 0 };
  return { sets: Array.from({ length: Math.max(1, e.sets) }, () => ({ ...one })), kg: e.targetKg, ...none };
}

/** One line for the routine card and detail: "3 × 6+6+6 · drop set", "12-9-6-6", "★ 4 steps: 4 × 12 → 4 × 9 → …". */
export function describePlan(e: PlanBase): string {
  const p = e.plan;
  if (p.mode === 'progression' && p.progression && p.progression.steps.length > 0) {
    const steps = p.progression.steps.map((s) => formatScheme(s.sets));
    const shown = steps.length > 3 ? [...steps.slice(0, 2), '…'] : steps;
    return `★ ${steps.length} steps: ${shown.join(' → ')}`;
  }
  const { sets } = targetsFor(e, 0, null);
  const text = formatScheme(sets);
  if (sets.some((s) => s.kind === 'drop')) return `${text} · drop set`;
  return text;
}

/** Sets planned for the next session, for counts like "5 exercises · 17 sets". */
export function plannedSetCount(e: PlanBase, timesDone = 0): number {
  return targetsFor(e, timesDone, null).sets.length;
}

/**
 * Suggested weight of each mini-set of a drop set: about 25% lighter each time, rounded to
 * what the gym has (2.5 kg plates for heavy weights, 1 kg or 0.5 kg steps for dumbbells).
 */
export function dropWeights(firstKg: number, drops: number): number[] {
  const out = [firstKg];
  for (let i = 0; i < drops; i++) {
    const raw = out[out.length - 1] * 0.75;
    const step = raw >= 20 ? 2.5 : raw >= 10 ? 1 : 0.5;
    out.push(Math.max(0, Math.round(raw / step) * step));
  }
  return out;
}

/** Reads the stored JSON, falling back to a simple plan for routines saved before plans existed. */
export function readPlan(json: string | null): ExercisePlan {
  if (!json) return defaultPlan();
  try {
    return { ...defaultPlan(), ...(JSON.parse(json) as Partial<ExercisePlan>) };
  } catch {
    return defaultPlan();
  }
}

export function writePlan(plan: ExercisePlan): string | null {
  const simple = isSimplePlan(plan) && !plan.note;
  return simple ? null : JSON.stringify(plan);
}

// ---------------------------------------------------------------------------
// Programs: routines in rotation, optionally after some done once
// ---------------------------------------------------------------------------

export interface ProgramSlot {
  phase: 'intro' | 'rotation';
  /** Index inside that phase's list. */
  index: number;
  /** Which time round the rotation (1-based); 0 during the intro. */
  lap: number;
}

/**
 * Which routine comes next after `position` program workouts.
 * The intro routines are done once each, then the rotation repeats forever.
 */
export function programSlot(introCount: number, rotationCount: number, position: number): ProgramSlot | null {
  const pos = Math.max(0, position);
  if (pos < introCount) return { phase: 'intro', index: pos, lap: 0 };
  if (rotationCount === 0) return null;
  const r = pos - introCount;
  return { phase: 'rotation', index: r % rotationCount, lap: Math.floor(r / rotationCount) + 1 };
}
