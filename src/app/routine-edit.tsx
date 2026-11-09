import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Mini } from '@/components/mini-field';
import { Button, Card, EmptyState, Field, Loading, Screen, SectionLabel, Txt } from '@/components/ui';
import { DEFAULT_REST_SECONDS, Radius, Spacing } from '@/constants/theme';
import { deleteRoutine, getRoutine, getSettings, listExercises, saveRoutine } from '@/db/repository';
import { formatKg, formatReps, formatRest, parseNumber, parseReps, parseRest } from '@/domain/format';
import { defaultPlan, describePlan, isSimplePlan } from '@/domain/plan';
import { supersetLabels } from '@/domain/routines';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { pickExercise } from '@/lib/exercise-picker';
import { editTargets, type ExerciseDraft as Row } from '@/lib/targets-editor';

let nextKey = 1;

/** Create (no id) or edit a routine: name, and per exercise sets, reps, target kg and rest. */
export default function RoutineEditScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : undefined;

  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [defaultRest, setDefaultRest] = useState(DEFAULT_REST_SECONDS);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load once. (Not on every focus: coming back from the exercise picker must keep the draft.)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await getSettings(db);
      const routine = id === undefined ? null : await getRoutine(db, id);
      if (cancelled) return;
      setDefaultRest(settings.defaultRestSeconds);
      if (routine) {
        setName(routine.name);
        setNotes(routine.notes ?? '');
        setRows(
          routine.exercises.map((e) => ({
            key: nextKey++,
            exerciseId: e.exerciseId,
            name: e.name,
            loadType: e.loadType,
            sets: String(e.sets),
            reps: formatReps(e.repsMin, e.repsMax),
            kg: e.targetKg === null ? '' : formatKg(e.targetKg).replace(',', ''),
            rest: formatRest(e.restSeconds).replace(' s', ''),
            superset: e.supersetWithNext,
            plan: e.plan,
          })),
        );
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  if (!loaded) return <Loading />;
  if (id !== undefined && !name && rows.length === 0) {
    return (
      <Screen>
        <EmptyState title="Routine not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const labels = supersetLabels(rows.map((r) => ({ exerciseId: r.exerciseId, supersetWithNext: r.superset })));
  const change = (next: Row[]) => {
    setRows(next);
    setDirty(true);
    setError(null);
  };
  const update = (key: number, patch: Partial<Row>) =>
    change(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(index + by, 0, row);
    change(next);
  };

  function addExercise() {
    pickExercise(
      rows.map((r) => r.exerciseId),
      async (exerciseId) => {
        const exercise = (await listExercises(db)).find((e) => e.id === exerciseId);
        if (!exercise) return;
        setRows((current) => [
          ...current,
          {
            key: nextKey++,
            exerciseId,
            name: exercise.name,
            loadType: exercise.loadType,
            sets: '3',
            reps: '8–10',
            kg: '',
            rest: formatRest(defaultRest).replace(' s', ''),
            superset: false,
            plan: defaultPlan(),
          },
        ]);
        setDirty(true);
      },
    );
  }

  async function save() {
    if (!name.trim()) return setError('Give the routine a name.');
    if (rows.length === 0) return setError('Add at least one exercise.');
    const exercises = [];
    for (const r of rows) {
      const sets = Math.round(parseNumber(r.sets));
      const reps = parseReps(r.reps);
      const rest = r.superset ? 0 : parseRest(r.rest);
      if (sets < 1 || !reps || rest === null) {
        return setError(`Check the numbers for ${r.name}: sets ≥ 1, reps like 8 or 6–8, rest like 2:00.`);
      }
      exercises.push({
        exerciseId: r.exerciseId,
        sets,
        repsMin: reps.min,
        repsMax: reps.max,
        targetKg: r.kg.trim() ? parseNumber(r.kg) : null,
        // the rest after a superset exercise is skipped, so it is stored as 0
        restSeconds: r.superset ? 0 : rest,
        supersetWithNext: r.superset,
        plan: r.plan,
      });
    }
    await saveRoutine(db, { id, name, notes, exercises });
    router.back();
  }

  async function cancel() {
    if (!dirty || (await confirm('Discard changes?', 'Your changes to this routine will be lost.', 'Discard', true))) {
      router.back();
    }
  }

  async function remove() {
    if (id === undefined) return;
    if (await confirm(`Delete ${name}?`, 'Workouts you already did with it are kept.', 'Delete', true)) {
      await deleteRoutine(db, id);
      router.dismissTo('/routines');
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: id === undefined ? 'New routine' : 'Edit routine',
          headerLeft: () => <Button title="Cancel" variant="ghost" size="sm" onPress={cancel} />,
          headerRight: () => <Button title="Save" variant="ghost" size="sm" onPress={save} />,
        }}
      />
      <Screen>
        <Field
          label="Routine name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setDirty(true);
            setError(null);
          }}
          placeholder="e.g. Push day"
          autoFocus={id === undefined}
        />

        <SectionLabel>Exercises</SectionLabel>
        {rows.length === 0 && (
          <Txt tone="muted" style={{ textAlign: 'center' }}>
            Add the exercises of this day, in the order you do them.
          </Txt>
        )}
        {rows.map((r, i) => {
          const label = labels.get(r.exerciseId);
          const linkedToPrevious = i > 0 && rows[i - 1].superset;
          return (
            <View key={r.key} style={{ gap: Spacing.xs }}>
              <Card style={label ? { borderColor: t.accent, borderWidth: 1.5 } : undefined}>
                <View style={styles.header}>
                  <Txt variant="heading" style={{ flex: 1, fontSize: 17 }} numberOfLines={1}>
                    {label && (
                      <Txt variant="heading" tone="accent" style={{ fontSize: 17 }}>
                        {label}{' '}
                      </Txt>
                    )}
                    {r.name}
                  </Txt>
                  <IconButton label="↑" hint={`Move ${r.name} up`} disabled={i === 0} onPress={() => move(i, -1)} />
                  <IconButton
                    label="↓"
                    hint={`Move ${r.name} down`}
                    disabled={i === rows.length - 1}
                    onPress={() => move(i, 1)}
                  />
                  <IconButton
                    label="✕"
                    hint={`Remove ${r.name}`}
                    onPress={() => change(rows.filter((x) => x.key !== r.key))}
                  />
                </View>
                {isSimplePlan(r.plan) ? (
                  <View style={styles.targets}>
                    <Mini
                      label="Sets"
                      value={r.sets}
                      onChange={(sets) => update(r.key, { sets })}
                      keyboard="number-pad"
                    />
                    <Mini
                      label="Reps"
                      value={r.reps}
                      onChange={(reps) => update(r.key, { reps })}
                      keyboard="numbers-and-punctuation"
                    />
                    <Mini
                      label={r.loadType === 'bodyweight' ? '+Kg' : r.loadType === 'dumbbell' ? 'Kg/hand' : 'Kg'}
                      value={r.kg}
                      placeholder="—"
                      onChange={(kg) => update(r.key, { kg })}
                      keyboard="decimal-pad"
                    />
                    <Mini
                      label="Rest"
                      value={r.superset ? '—' : r.rest}
                      onChange={(rest) => update(r.key, { rest })}
                      keyboard="numbers-and-punctuation"
                      editable={!r.superset}
                    />
                  </View>
                ) : (
                  <PlanSummary row={r} />
                )}
                {r.plan.note && (
                  <Txt variant="small" tone="muted">
                    Note: {r.plan.note}
                  </Txt>
                )}
                <Pressable
                  onPress={() => editTargets(r, (next) => update(r.key, next))}
                  accessibilityRole="button"
                  hitSlop={6}>
                  <Txt variant="small" tone="accent" style={{ fontWeight: '700' }}>
                    {isSimplePlan(r.plan) ? 'Set types, reps per set, progression ›' : 'Edit targets ›'}
                  </Txt>
                </Pressable>
                {r.superset && (
                  <Txt variant="small" tone="muted">
                    No rest: go straight to {rows[i + 1]?.name ?? 'the next exercise'}.
                  </Txt>
                )}
                {!r.superset && linkedToPrevious && (
                  <Txt variant="small" tone="muted">
                    Rest after this one ends the superset round.
                  </Txt>
                )}
              </Card>
              {i < rows.length - 1 && (
                <Pressable
                  onPress={() => update(r.key, { superset: !r.superset })}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: r.superset }}
                  accessibilityLabel={`Superset ${r.name} with ${rows[i + 1].name}`}
                  hitSlop={6}
                  style={styles.link}>
                  <Txt variant="small" tone={r.superset ? 'accent' : 'muted'} style={{ fontWeight: '700' }}>
                    {r.superset ? '⇅ Superset · tap to unlink' : '⇅ Superset with next'}
                  </Txt>
                </Pressable>
              )}
            </View>
          );
        })}
        <Button title="+ Add exercise" variant="secondary" onPress={addExercise} />

        <TextInput
          style={[styles.notes, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
          placeholder="Notes (optional), e.g. pause on the chest for bench"
          placeholderTextColor={t.textMuted}
          value={notes}
          onChangeText={(v) => {
            setNotes(v);
            setDirty(true);
          }}
          multiline
        />

        {error && <Txt tone="danger">{error}</Txt>}
        <Button title="Save routine" onPress={save} />
        {id !== undefined && <Button title="Delete routine" variant="danger" onPress={remove} />}
        <Txt variant="small" tone="muted" style={{ textAlign: 'center' }}>
          Kg is optional: leave it empty to start from what you lifted last time.
        </Txt>
      </Screen>
    </>
  );
}

/** Chip and one line for exercises with per-set reps, drop/max sets or a progression. */
function PlanSummary({ row }: { row: Row }) {
  const t = useTheme();
  const p = row.plan;
  const tag =
    p.mode === 'progression'
      ? '★ Progression'
      : p.mode === 'perSet'
        ? 'Per set'
        : p.kind === 'drop'
          ? 'Drop set'
          : 'Max reps';
  const reps = parseReps(row.reps);
  const text = describePlan({
    sets: Math.round(parseNumber(row.sets)) || 1,
    repsMin: reps?.min ?? 1,
    repsMax: reps?.max ?? 1,
    targetKg: row.kg.trim() ? parseNumber(row.kg) : null,
    plan: p,
  }).replace(/^★ /, '');
  const restText = row.superset ? 'no rest (superset)' : `rest ${row.rest}`;
  const kgText = p.mode !== 'progression' && row.kg.trim() ? ` · ${row.kg} kg` : '';
  return (
    <View style={{ gap: 6 }}>
      <View
        style={[
          styles.tag,
          p.mode === 'progression' ? { borderColor: t.accent, borderWidth: 1.5 } : { backgroundColor: t.surfaceAlt },
        ]}>
        <Txt variant="small" tone={p.mode === 'progression' ? 'accent' : 'default'} style={{ fontWeight: '700' }}>
          {tag}
        </Txt>
      </View>
      <Txt variant="small" tone="muted">
        {text}
        {kgText} · {restText}
      </Txt>
    </View>
  );
}

function IconButton({
  label,
  hint,
  onPress,
  disabled,
}: {
  label: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={hint}
      style={({ pressed }) => [styles.icon, { opacity: disabled ? 0.25 : pressed ? 0.5 : 1 }]}>
      <Txt tone="muted" style={{ fontWeight: '700' }}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  targets: { flexDirection: 'row', gap: Spacing.sm },
  icon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  link: { alignSelf: 'center', paddingVertical: 2 },
  tag: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  notes: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 72,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
