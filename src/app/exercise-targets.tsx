import { router, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Mini } from '@/components/mini-field';
import { Button, Card, EmptyState, Screen, SectionLabel, Segmented, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { exerciseOneRepMax, setOneRepMax } from '@/db/repository';
import { formatKg, formatReps, parseNumber, parseReps, parseRest } from '@/domain/format';
import {
  DEFAULT_DROPS,
  dropWeights,
  formatScheme,
  formatTarget,
  parseScheme,
  type LoadUnit,
  type PlanMode,
  type SetKind,
  type SetTarget,
} from '@/domain/plan';
import { useTheme } from '@/hooks/use-theme';
import { deliverTargets, pendingTargets, type ExerciseDraft } from '@/lib/targets-editor';

const MODE_LABELS: Record<PlanMode, string> = { same: 'Same each set', perSet: 'Per set', progression: 'Progression' };
const KIND_LABELS: Record<SetKind, string> = { normal: 'Normal', drop: 'Drop set', max: 'Max reps' };
const KIND_HINTS: Record<SetKind, string> = {
  normal: 'Straight sets: same weight, rest after each set.',
  drop: 'Keep going with less weight. One set is a chain of mini-sets; rest only at the end.',
  max: 'As many reps as you can, e.g. pull-ups 3 × MAX. No rep target.',
};
const NEXT_KIND: Record<SetKind, SetKind> = { normal: 'drop', drop: 'max', max: 'normal' };

interface PerSetRow {
  kind: SetKind;
  reps: string;
}
interface StepRow {
  scheme: string;
  load: string;
}

/** R4a–c: everything about one exercise of a routine: set types, reps per set, progression. */
export default function ExerciseTargetsScreen() {
  const draft = pendingTargets();
  if (!draft) {
    return (
      <Screen>
        <EmptyState title="Nothing to edit" message="Open this from a routine." />
      </Screen>
    );
  }
  return <Editor draft={draft} />;
}

function Editor({ draft }: { draft: ExerciseDraft }) {
  const db = useSQLiteContext();
  const t = useTheme();
  const p = draft.plan;
  const [mode, setMode] = useState<PlanMode>(p.mode);
  const [sets, setSets] = useState(draft.sets);
  const [reps, setReps] = useState(draft.reps);
  const [kg, setKg] = useState(draft.kg);
  const [rest, setRest] = useState(draft.rest);
  const [kind, setKind] = useState<SetKind>(p.kind);
  const [drops, setDrops] = useState(p.drops || DEFAULT_DROPS);
  const [perSet, setPerSet] = useState<PerSetRow[]>(() =>
    p.perSet.length > 0
      ? p.perSet.map((s) => ({ kind: s.kind, reps: s.kind === 'max' ? '' : formatReps(s.repsMin, s.repsMax) }))
      : Array.from({ length: Math.max(1, Math.round(parseNumber(draft.sets)) || 3) }, () => ({
          kind: 'normal' as SetKind,
          reps: draft.reps,
        })),
  );
  const [unit, setUnit] = useState<LoadUnit>(p.progression?.unit ?? 'pct');
  const [steps, setSteps] = useState<StepRow[]>(() =>
    p.progression?.steps.length
      ? p.progression.steps.map((s) => ({
          scheme: formatScheme(s.sets),
          load: s.load === null ? '' : formatKg(s.load),
        }))
      : [
          { scheme: '4 × 12', load: '70' },
          { scheme: '4 × 9', load: '75' },
          { scheme: '4 × 6', load: '80' },
          { scheme: '4 × 3', load: '85' },
        ],
  );
  const [reserveRep, setReserveRep] = useState(p.progression?.reserveRep ?? false);
  const [note, setNote] = useState(p.note ?? '');
  const [oneRm, setOneRm] = useState<number | null>(null);
  const [oneRmText, setOneRmText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    exerciseOneRepMax(db, draft.exerciseId).then((v) => {
      if (!cancelled) setOneRm(v);
    });
    return () => {
      cancelled = true;
    };
  }, [db, draft.exerciseId]);

  const kgLabel = draft.loadType === 'bodyweight' ? '+Kg' : draft.loadType === 'dumbbell' ? 'Kg/hand' : 'Kg';
  const usedOneRm = oneRmText.trim() ? parseNumber(oneRmText) : oneRm;

  async function done() {
    const restSeconds = draft.superset ? 0 : parseRest(rest);
    if (restSeconds === null) return setError('Rest like 1:30 or 90.');
    const base = { ...draft, rest, kg, plan: { ...draft.plan, mode, note: note.trim() || null } };
    let next: ExerciseDraft;
    if (mode === 'same') {
      const n = Math.round(parseNumber(sets));
      const r = kind === 'max' ? { min: 1, max: 1 } : parseReps(reps);
      if (n < 1 || !r) return setError('Sets ≥ 1 and reps like 8 or 6–8.');
      next = { ...base, sets: String(n), reps: kind === 'max' ? '1' : reps, plan: { ...base.plan, kind, drops } };
    } else if (mode === 'perSet') {
      const targets: SetTarget[] = [];
      for (const [i, row] of perSet.entries()) {
        if (row.kind === 'max') {
          targets.push({ kind: 'max', repsMin: 0, repsMax: 0, drops: 0 });
          continue;
        }
        const r = parseReps(row.reps);
        if (!r) return setError(`Set ${i + 1}: reps like 8 or 6–8.`);
        targets.push({ kind: row.kind, repsMin: r.min, repsMax: r.max, drops: row.kind === 'drop' ? drops : 0 });
      }
      if (targets.length === 0) return setError('Add at least one set.');
      const first = targets.find((s) => s.kind !== 'max');
      next = {
        ...base,
        sets: String(targets.length),
        reps: first ? formatReps(first.repsMin, first.repsMax) : '1',
        plan: { ...base.plan, perSet: targets, drops },
      };
    } else {
      const parsed = [];
      for (const [i, s] of steps.entries()) {
        const targets = parseScheme(s.scheme);
        if (!targets) return setError(`Step ${i + 1}: write sets like 4 × 12, 12-9-6-6, 3 × 6+6+6 or 3 × MAX.`);
        parsed.push({ sets: targets, load: s.load.trim() ? parseNumber(s.load) : null });
      }
      if (parsed.length === 0) return setError('Add at least one step.');
      const first = parsed[0].sets.find((s) => s.kind !== 'max');
      next = {
        ...base,
        sets: String(parsed[0].sets.length),
        reps: first ? formatReps(first.repsMin, first.repsMax) : '1',
        plan: { ...base.plan, progression: { unit, steps: parsed, reserveRep } },
      };
      if (unit === 'pct' && oneRmText.trim()) await setOneRepMax(db, draft.exerciseId, parseNumber(oneRmText));
    }
    deliverTargets(next);
    router.back();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: draft.name,
          headerLeft: () => <Button title="Cancel" variant="ghost" size="sm" onPress={() => router.back()} />,
          headerRight: () => <Button title="Done" variant="ghost" size="sm" onPress={done} />,
        }}
      />
      <Screen>
        <Segmented
          options={['same', 'perSet', 'progression'] as const}
          value={mode}
          onChange={setMode}
          format={(m) => MODE_LABELS[m]}
        />

        {mode === 'same' && (
          <>
            <View style={styles.row}>
              <Mini label="Sets" value={sets} onChange={setSets} keyboard="number-pad" />
              <Mini
                label={kind === 'drop' ? 'Reps/drop' : 'Reps'}
                value={kind === 'max' ? 'MAX' : reps}
                onChange={setReps}
                keyboard="numbers-and-punctuation"
                editable={kind !== 'max'}
              />
              <Mini label={kgLabel} value={kg} onChange={setKg} placeholder="—" keyboard="decimal-pad" />
              <RestMini value={rest} onChange={setRest} superset={draft.superset} />
            </View>
            <SectionLabel>Set type</SectionLabel>
            {(['normal', 'drop', 'max'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                accessibilityRole="radio"
                accessibilityState={{ selected: kind === k }}>
                <Card style={kind === k ? { borderColor: t.accent, borderWidth: 1.5 } : undefined}>
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.radio,
                        { borderColor: kind === k ? t.accent : t.border, borderWidth: kind === k ? 6 : 2 },
                      ]}
                    />
                    <Txt variant="heading" style={{ fontSize: 17 }}>
                      {KIND_LABELS[k]}
                    </Txt>
                  </View>
                  <Txt variant="small" tone="muted">
                    {KIND_HINTS[k]}
                  </Txt>
                  {k === 'drop' && kind === 'drop' && (
                    <DropControls drops={drops} onChange={setDrops} reps={reps} kg={kg} />
                  )}
                </Card>
              </Pressable>
            ))}
          </>
        )}

        {mode === 'perSet' && (
          <>
            <Card>
              <View style={styles.row}>
                <Txt variant="label" tone="muted" style={{ width: 28, textAlign: 'center' }}>
                  Set
                </Txt>
                <Txt variant="label" tone="muted" style={{ flex: 1 }}>
                  Type · tap to change
                </Txt>
                <Txt variant="label" tone="muted" style={{ width: 72, textAlign: 'center' }}>
                  Reps
                </Txt>
                <View style={{ width: 24 }} />
              </View>
              {perSet.map((row, i) => (
                <View key={i} style={styles.row}>
                  <Txt tone="muted" style={{ width: 28, textAlign: 'center', fontWeight: '700' }}>
                    {i + 1}
                  </Txt>
                  <View style={{ flex: 1, alignItems: 'flex-start' }}>
                    <Chip
                      label={`${KIND_LABELS[row.kind]} ▾`}
                      on={row.kind !== 'normal'}
                      onPress={() => setPerSet(perSet.map((r, j) => (j === i ? { ...r, kind: NEXT_KIND[r.kind] } : r)))}
                    />
                  </View>
                  <View style={{ width: 72 }}>
                    <Mini
                      label={`Set ${i + 1} reps`}
                      hideLabel
                      value={row.kind === 'max' ? 'MAX' : row.reps}
                      editable={row.kind !== 'max'}
                      onChange={(v) => setPerSet(perSet.map((r, j) => (j === i ? { ...r, reps: v } : r)))}
                      keyboard="numbers-and-punctuation"
                    />
                  </View>
                  <Remove label={`Remove set ${i + 1}`} onPress={() => setPerSet(perSet.filter((_, j) => j !== i))} />
                </View>
              ))}
              <Pressable
                onPress={() =>
                  setPerSet([...perSet, { ...(perSet[perSet.length - 1] ?? { kind: 'normal', reps: '8' }) }])
                }
                style={styles.center}>
                <Txt tone="accent" style={{ fontWeight: '700' }}>
                  + Add set
                </Txt>
              </Pressable>
            </Card>
            {perSet.some((r) => r.kind === 'drop') && (
              <Card>
                <DropControls
                  drops={drops}
                  onChange={setDrops}
                  reps={perSet.find((r) => r.kind === 'drop')?.reps ?? reps}
                  kg={kg}
                />
              </Card>
            )}
            <View style={styles.row}>
              <Mini label={kgLabel} value={kg} onChange={setKg} placeholder="—" keyboard="decimal-pad" />
              <RestMini value={rest} onChange={setRest} superset={draft.superset} />
            </View>
            <Txt variant="small" tone="muted">
              Different reps on every set, like 12-9-6-6 or 15-12-9-6. Kg can stay empty: it starts from what you lifted
              last time.
            </Txt>
          </>
        )}

        {mode === 'progression' && (
          <>
            <Txt variant="small" tone="muted">
              Changes every time you do this routine, then starts again: 1 → 2 → … → 1.
            </Txt>
            <View style={styles.row}>
              <Txt style={{ flex: 1, fontWeight: '600' }}>Load as</Txt>
              <View style={{ width: 180 }}>
                <Segmented
                  options={['kg', 'pct'] as const}
                  value={unit}
                  onChange={setUnit}
                  format={(u) => (u === 'kg' ? 'kg' : '% of 1RM')}
                />
              </View>
            </View>
            {unit === 'pct' && (
              <Card style={{ gap: 4 }}>
                <View style={styles.row}>
                  <Txt style={{ flex: 1, fontWeight: '600' }}>Your 1RM</Txt>
                  <View style={{ width: 96 }}>
                    <Mini
                      label="One-rep max in kg"
                      hideLabel
                      value={oneRmText}
                      placeholder={oneRm ? formatKg(oneRm) : 'kg'}
                      onChange={setOneRmText}
                      keyboard="decimal-pad"
                    />
                  </View>
                </View>
                <Txt variant="small" tone="muted">
                  {oneRm
                    ? 'Estimated from your best set. Type a number to use your own.'
                    : 'Not known yet: type it, or the first workouts use last time’s weight.'}
                </Txt>
              </Card>
            )}
            <SectionLabel>Steps</SectionLabel>
            <Card>
              <View style={styles.row}>
                <Txt variant="label" tone="muted" style={{ width: 22, textAlign: 'center' }}>
                  #
                </Txt>
                <Txt variant="label" tone="muted" style={{ flex: 1 }}>
                  Sets × reps
                </Txt>
                <Txt variant="label" tone="muted" style={{ width: 70, textAlign: 'center' }}>
                  {unit === 'pct' ? '%' : kgLabel}
                </Txt>
                <View style={{ width: 24 }} />
              </View>
              {steps.map((s, i) => {
                const pctKg =
                  unit === 'pct' && usedOneRm && s.load.trim() ? (usedOneRm * parseNumber(s.load)) / 100 : null;
                const valid = parseScheme(s.scheme) !== null;
                return (
                  <View key={i} style={{ gap: 2 }}>
                    <View style={styles.row}>
                      <Txt tone="muted" style={{ width: 22, textAlign: 'center', fontWeight: '700' }}>
                        {i + 1}
                      </Txt>
                      <TextInput
                        value={s.scheme}
                        onChangeText={(v) => setSteps(steps.map((x, j) => (j === i ? { ...x, scheme: v } : x)))}
                        placeholder="4 × 12"
                        placeholderTextColor={t.textMuted}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        accessibilityLabel={`Step ${i + 1} sets and reps`}
                        style={[
                          styles.scheme,
                          {
                            backgroundColor: t.surfaceAlt,
                            color: t.text,
                            borderColor: valid ? 'transparent' : t.danger,
                          },
                        ]}
                      />
                      <View style={{ width: 70 }}>
                        <Mini
                          label={`Step ${i + 1} load`}
                          hideLabel
                          value={s.load}
                          placeholder="—"
                          onChange={(v) => setSteps(steps.map((x, j) => (j === i ? { ...x, load: v } : x)))}
                          keyboard="decimal-pad"
                        />
                      </View>
                      <Remove
                        label={`Remove step ${i + 1}`}
                        onPress={() => setSteps(steps.filter((_, j) => j !== i))}
                      />
                    </View>
                    {pctKg !== null && (
                      <Txt variant="small" tone="muted" style={{ textAlign: 'right', marginRight: 32 }}>
                        ≈ {formatKg(Math.round(pctKg / 2.5) * 2.5)} kg
                      </Txt>
                    )}
                  </View>
                );
              })}
              <Pressable
                onPress={() => setSteps([...steps, { ...(steps[steps.length - 1] ?? { scheme: '4 × 8', load: '' }) }])}
                style={styles.center}>
                <Txt tone="accent" style={{ fontWeight: '700' }}>
                  + Add step
                </Txt>
              </Pressable>
            </Card>
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '600' }}>Leave 1 rep in reserve</Txt>
                  <Txt variant="small" tone="muted">
                    Stop one rep before failure
                  </Txt>
                </View>
                <Switch
                  value={reserveRep}
                  onValueChange={setReserveRep}
                  trackColor={{ true: t.accent, false: t.border }}
                />
              </View>
              <View style={styles.row}>
                <Txt style={{ flex: 1, fontWeight: '600' }}>Rest</Txt>
                <View style={{ width: 80 }}>
                  <RestMini value={rest} onChange={setRest} superset={draft.superset} hideLabel />
                </View>
              </View>
            </Card>
            <Txt variant="small" tone="muted">
              Each step: 4 × 12, different reps per set like 12-6-12-6-12, drop sets 3 × 6+6+6, or 3 × MAX.
            </Txt>
          </>
        )}

        <SectionLabel>Note</SectionLabel>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. +3–4 forced reps on the last set"
          placeholderTextColor={t.textMuted}
          multiline
          style={[styles.note, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
        />
        {error && <Txt tone="danger">{error}</Txt>}
        <Button title="Done" onPress={done} />
      </Screen>
    </>
  );
}

function RestMini({
  value,
  onChange,
  superset,
  hideLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  superset: boolean;
  hideLabel?: boolean;
}) {
  return (
    <Mini
      label="Rest"
      hideLabel={hideLabel}
      value={superset ? '—' : value}
      onChange={onChange}
      editable={!superset}
      keyboard="numbers-and-punctuation"
    />
  );
}

/** How many drops, with a preview of the suggested weights. */
function DropControls({
  drops,
  onChange,
  reps,
  kg,
}: {
  drops: number;
  onChange: (n: number) => void;
  reps: string;
  kg: string;
}) {
  const t = useTheme();
  const r = parseReps(reps)?.min ?? 6;
  const first = parseNumber(kg);
  const weights = first > 0 ? dropWeights(first, drops) : null;
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={styles.row}>
        <Txt style={{ flex: 1, fontWeight: '600' }}>Drops per set</Txt>
        <View style={[styles.stepper, { backgroundColor: t.surfaceAlt }]}>
          <Pressable
            onPress={() => onChange(Math.max(1, drops - 1))}
            hitSlop={6}
            style={styles.stepBtn}
            accessibilityLabel="Fewer drops">
            <Txt tone="accent" style={{ fontWeight: '800', fontSize: 18 }}>
              −
            </Txt>
          </Pressable>
          <Txt style={{ fontWeight: '800', minWidth: 20, textAlign: 'center' }}>{drops}</Txt>
          <Pressable
            onPress={() => onChange(Math.min(5, drops + 1))}
            hitSlop={6}
            style={styles.stepBtn}
            accessibilityLabel="More drops">
            <Txt tone="accent" style={{ fontWeight: '800', fontSize: 18 }}>
              +
            </Txt>
          </Pressable>
        </View>
      </View>
      <Txt variant="small" tone="muted">
        {formatTarget({ kind: 'drop', repsMin: r, repsMax: r, drops })} reps
        {weights ? ` · ${weights.map((w) => `${formatKg(w)} kg`).join(' → ')}` : ''}
      </Txt>
      <Txt variant="small" tone="muted">
        Each drop is suggested about 25% lighter. You can change the weights while you train.
      </Txt>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.chip, { backgroundColor: on ? t.accent : t.surfaceAlt }]}>
      <Txt variant="small" style={{ fontWeight: '700', color: on ? t.accentText : t.text }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function Remove({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: 24, alignItems: 'center' }}>
      <Txt tone="muted" style={{ fontWeight: '700' }}>
        ✕
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  center: { alignItems: 'center', paddingVertical: Spacing.xs },
  radio: { width: 20, height: 20, borderRadius: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.sm, paddingHorizontal: 4 },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  scheme: {
    flex: 1,
    minWidth: 0,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    paddingVertical: 9,
    paddingHorizontal: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  note: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 60,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
