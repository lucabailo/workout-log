import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RestTimer } from '@/components/rest-timer';
import { SetHeader, SetRow } from '@/components/set-row';
import { Button, Card, EmptyState, Loading, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  addSet,
  deleteSet,
  deleteWorkout,
  exerciseSessions,
  finishWorkout,
  getActiveWorkout,
  getRoutineName,
  getSettings,
  getWorkoutBlocks,
  previousSets,
  removeExerciseFromWorkout,
  updateSet,
  workoutPlan,
  workoutTargets,
} from '@/db/repository';
import { formatClock, formatKg, formatRest } from '@/domain/format';
import { formatScheme, type TodayTargets } from '@/domain/plan';
import { supersetLabels } from '@/domain/routines';
import { newRecordIndexes, volume } from '@/domain/stats';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { refreshReminders } from '@/lib/reminders';
import { cancelRestEnd, scheduleRestEnd } from '@/lib/rest-notification';

export default function ActiveWorkoutScreen() {
  const t = useTheme();
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [nextUp, setNextUp] = useState<string | null>(null);

  const { data, db, reload } = useDbQuery(async (db) => {
    const workout = await getActiveWorkout(db);
    if (!workout) return null;
    const blocks = await getWorkoutBlocks(db, workout.id);
    const extras = await Promise.all(
      blocks.map(async (b) => ({
        previous: await previousSets(db, b.exercise.id, workout.id),
        history: await exerciseSessions(db, b.exercise.id),
      })),
    );
    const plan = await workoutPlan(db, workout.id);
    const today = await workoutTargets(db, workout.id);
    return {
      workout,
      settings: await getSettings(db),
      routineName: await getRoutineName(db, workout.routineId),
      blocks: blocks.map((b, i) => ({
        ...b,
        ...extras[i],
        target: plan.get(b.exercise.id) ?? null,
        today: today.get(b.exercise.id) ?? null,
      })),
      labels: supersetLabels([...plan.values()]),
    };
  });

  const elapsed = useElapsed(data?.workout.startedAt);
  const stopRest = useCallback((endsAt: number | null) => setRestEndsAt(endsAt), []);
  const notify = data?.settings.notifyOnRestEnd ?? false;

  // A workout just started (or reopened): plan the "still training?" reminder, drop the inactivity one.
  const workoutId = data?.workout.id;
  useEffect(() => {
    if (workoutId !== undefined) refreshReminders(db).catch(() => {});
  }, [db, workoutId]);

  // Mirror the on-screen timer with a notification for when the phone is locked or in another app.
  useEffect(() => {
    if (restEndsAt !== null && notify) scheduleRestEnd(restEndsAt, nextUp);
    else cancelRestEnd();
  }, [restEndsAt, nextUp, notify]);

  if (data === undefined) return <Loading />;
  if (data === null) {
    return (
      <Screen>
        <EmptyState
          title="No workout in progress"
          message="Start one from the Workouts tab."
          action={<Button title="Back" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const { workout, blocks, settings, routineName, labels } = data;
  const completed = blocks.flatMap((b) => b.sets.filter((s) => s.completed));
  const totalSets = blocks.reduce((n, b) => n + b.sets.filter((s) => s.dropIndex === 0).length, 0);
  const doneMain = completed.filter((s) => s.dropIndex === 0).length;

  /** restSeconds is null inside a superset: go straight to the next exercise. */
  async function toggle(setId: number, wasDone: boolean, restSeconds: number | null) {
    await updateSet(db, setId, { completed: !wasDone });
    if (!wasDone && restSeconds !== null) {
      setNextUp(nextSetAfter(blocks, setId));
      setRestEndsAt(restDeadline(restSeconds));
    }
    await reload();
  }

  async function finish() {
    if (completed.length === 0) {
      const discard = await confirm(
        'Nothing to save',
        'No set is ticked off yet. Discard this workout?',
        'Discard',
        true,
      );
      if (discard) {
        await cancelRestEnd();
        await deleteWorkout(db, workout.id);
        await refreshReminders(db);
        router.back();
      }
      return;
    }
    const unticked = blocks.reduce((n, b) => n + b.sets.filter((s) => !s.completed && s.dropIndex === 0).length, 0);
    const message =
      unticked > 0
        ? `${unticked} set${unticked === 1 ? ' is' : 's are'} not ticked off and will be dropped.`
        : 'Great work!';
    if (await confirm('Finish workout?', message, 'Finish')) {
      await cancelRestEnd();
      await finishWorkout(db, workout.id);
      await refreshReminders(db);
      router.replace({ pathname: '/summary', params: { id: workout.id } });
    }
  }

  async function discard() {
    if (await confirm('Discard workout?', 'Everything logged in this workout will be lost.', 'Discard', true)) {
      await cancelRestEnd();
      await deleteWorkout(db, workout.id);
      await refreshReminders(db);
      router.back();
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: routineName ? `${routineName} · ${formatClock(elapsed)}` : formatClock(elapsed),
          headerLeft: () => <Button title="Close" variant="ghost" size="sm" onPress={() => router.back()} />,
          headerRight: () => <Button title="Finish" size="sm" onPress={finish} />,
        }}
      />
      <Screen>
        <View style={styles.summary}>
          <Txt tone="muted">
            {doneMain} of {totalSets} sets · {formatKg(volume(completed))} kg
          </Txt>
        </View>

        {blocks.length === 0 && (
          <EmptyState title="Empty workout" message="Add your first exercise to start logging sets." />
        )}

        {blocks.map((b) => {
          const records = newRecordIndexes(
            b.sets.filter((s) => s.completed),
            b.history,
          );
          const doneSets = b.sets.filter((s) => s.completed);
          const rest = b.target?.restSeconds ?? settings.defaultRestSeconds;
          const inSuperset = b.target?.supersetWithNext ?? false;
          const label = labels.get(b.exercise.id);
          const nextName = inSuperset
            ? blocks.find((x) => labels.get(x.exercise.id) === nextLabel(label))?.exercise.name
            : undefined;
          return (
            <Card key={b.exercise.id} style={label ? { borderColor: t.accent, borderWidth: 1.5 } : undefined}>
              <View style={styles.blockHeader}>
                <Txt variant="heading" style={{ flex: 1 }}>
                  {label && (
                    <Txt variant="heading" tone="accent">
                      {label}{' '}
                    </Txt>
                  )}
                  {b.exercise.name}
                </Txt>
                <Button
                  title="Remove"
                  variant="ghost"
                  size="sm"
                  onPress={async () => {
                    if (
                      await confirm(
                        `Remove ${b.exercise.name}?`,
                        'Its sets in this workout will be deleted.',
                        'Remove',
                        true,
                      )
                    ) {
                      await removeExerciseFromWorkout(db, workout.id, b.exercise.id);
                      await reload();
                    }
                  }}
                />
              </View>
              {b.target && b.today && (
                <Txt variant="small" tone={b.today.step !== null ? 'accent' : 'muted'} style={{ fontWeight: '600' }}>
                  {targetLine(b.today, b.target.plan.progression?.reserveRep ?? false)} ·{' '}
                  {inSuperset ? `no rest, then ${nextName ?? 'next exercise'}` : `rest ${formatRest(rest)}`}
                </Txt>
              )}
              {b.target?.plan.note && (
                <Txt variant="small" tone="muted">
                  Note: {b.target.plan.note}
                </Txt>
              )}
              <SetHeader loadType={b.exercise.loadType} />
              {b.sets.map((s) => {
                const isDrop = s.dropIndex > 0;
                const main = b.sets.filter((x) => x.dropIndex === 0).indexOf(s);
                return (
                  <SetRow
                    // Remount when the stored values change, so the fields show them.
                    key={`${s.id}:${s.weightKg}:${s.reps}`}
                    set={s}
                    drop={isDrop}
                    previous={isDrop ? undefined : b.previous[main]}
                    isRecord={s.completed && records.includes(doneSets.indexOf(s))}
                    onChange={(changes) => updateSet(db, s.id, changes)}
                    onToggle={() => toggle(s.id, s.completed, inSuperset ? null : rest)}
                    onDelete={async () => {
                      const what = isDrop ? `drop ${s.dropIndex} of set ${s.setIndex}` : `set ${s.setIndex}`;
                      if (await confirm(`Delete ${what}?`, '', 'Delete', true)) {
                        await deleteSet(db, s.id);
                        await reload();
                      }
                    }}
                  />
                );
              })}
              <Button
                title="+ Add set"
                variant="secondary"
                size="sm"
                onPress={async () => {
                  await addSet(db, workout.id, b.exercise.id);
                  await reload();
                }}
              />
            </Card>
          );
        })}

        <Button title="+ Add exercise" variant="secondary" onPress={() => router.push('/pick-exercise')} />

        <Button title="Finish workout" onPress={finish} />
        <Button title="Discard workout" variant="danger" onPress={discard} />
      </Screen>

      {restEndsAt !== null && <RestTimer endsAt={restEndsAt} onChange={stopRest} vibrate={settings.vibrateOnRestEnd} />}
    </View>
  );
}

/** Seconds since `startedAt`, updated every second. */
function useElapsed(startedAt: string | undefined) {
  const now = useNow();
  return startedAt ? (now - Date.parse(startedAt)) / 1000 : 0;
}

/** "Target 4 × 8–10 · 60 kg" or, in a progression, "★ Step 2 of 4 · 4 × 9 @ 75% = 45 kg". */
function targetLine(today: TodayTargets, reserveRep: boolean) {
  const scheme = formatScheme(today.sets);
  const kg = today.kg !== null && today.kg > 0 ? `${formatKg(today.kg)} kg` : null;
  if (today.step !== null) {
    const load = today.pct !== null ? ` @ ${formatKg(today.pct)}%${kg ? ` = ${kg}` : ''}` : kg ? ` · ${kg}` : '';
    return `★ Step ${today.step + 1} of ${today.stepCount} · ${scheme}${load}${reserveRep ? ' · 1 rep in reserve' : ''}`;
  }
  return `Target ${scheme}${kg ? ` · ${kg}` : ''}`;
}

/** "A1" → "A2": the exercise that follows in the same superset. */
function nextLabel(label: string | undefined) {
  return label ? `${label[0]}${Number(label.slice(1)) + 1}` : undefined;
}

/** "Bench Press · set 3": the first set still to do, not counting the one just ticked. */
function nextSetAfter(
  blocks: {
    exercise: { name: string };
    sets: { id: number; completed: boolean; dropIndex: number; setIndex: number }[];
  }[],
  justTicked: number,
): string | null {
  for (const b of blocks) {
    const s = b.sets.find((x) => x.dropIndex === 0 && !x.completed && x.id !== justTicked);
    if (s) return `${b.exercise.name} · set ${s.setIndex}`;
  }
  return null;
}

/** When the rest period that starts now should end. */
function restDeadline(seconds: number) {
  return Date.now() + seconds * 1000;
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
