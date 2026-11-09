import { Stack, router } from 'expo-router';
import { useCallback, useState } from 'react';
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
} from '@/db/repository';
import { formatClock, formatKg, formatReps, formatRest } from '@/domain/format';
import { newRecordIndexes, volume } from '@/domain/stats';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { confirm } from '@/lib/confirm';

export default function ActiveWorkoutScreen() {
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

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
    return {
      workout,
      settings: await getSettings(db),
      routineName: await getRoutineName(db, workout.routineId),
      blocks: blocks.map((b, i) => ({ ...b, ...extras[i], target: plan.get(b.exercise.id) ?? null })),
    };
  });

  const elapsed = useElapsed(data?.workout.startedAt);
  const stopRest = useCallback((endsAt: number | null) => setRestEndsAt(endsAt), []);

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

  const { workout, blocks, settings, routineName } = data;
  const completed = blocks.flatMap((b) => b.sets.filter((s) => s.completed));
  const totalSets = blocks.reduce((n, b) => n + b.sets.length, 0);

  async function toggle(setId: number, wasDone: boolean, restSeconds: number) {
    await updateSet(db, setId, { completed: !wasDone });
    if (!wasDone) setRestEndsAt(restDeadline(restSeconds));
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
        await deleteWorkout(db, workout.id);
        router.back();
      }
      return;
    }
    const unticked = blocks.reduce((n, b) => n + b.sets.filter((s) => !s.completed).length, 0);
    const message =
      unticked > 0
        ? `${unticked} set${unticked === 1 ? ' is' : 's are'} not ticked off and will be dropped.`
        : 'Great work!';
    if (await confirm('Finish workout?', message, 'Finish')) {
      await finishWorkout(db, workout.id);
      router.replace({ pathname: '/summary', params: { id: workout.id } });
    }
  }

  async function discard() {
    if (await confirm('Discard workout?', 'Everything logged in this workout will be lost.', 'Discard', true)) {
      await deleteWorkout(db, workout.id);
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
            {completed.length} of {totalSets} sets · {formatKg(volume(completed))} kg
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
          return (
            <Card key={b.exercise.id}>
              <View style={styles.blockHeader}>
                <Txt variant="heading" style={{ flex: 1 }}>
                  {b.exercise.name}
                </Txt>
                <Button
                  title="Remove"
                  variant="ghost"
                  size="sm"
                  onPress={async () => {
                    if (await confirm(`Remove ${b.exercise.name}?`, 'Its sets in this workout will be deleted.', 'Remove', true)) {
                      await removeExerciseFromWorkout(db, workout.id, b.exercise.id);
                      await reload();
                    }
                  }}
                />
              </View>
              {b.target && (
                <Txt variant="small" tone="muted" style={{ fontWeight: '600' }}>
                  Target {b.target.sets} × {formatReps(b.target.repsMin, b.target.repsMax)}
                  {b.target.targetKg !== null ? ` · ${formatKg(b.target.targetKg)} kg` : ''} · rest {formatRest(rest)}
                </Txt>
              )}
              <SetHeader loadType={b.exercise.loadType} />
              {b.sets.map((s, i) => (
                <SetRow
                  // Remount when the stored values change, so the fields show them.
                  key={`${s.id}:${s.weightKg}:${s.reps}`}
                  set={s}
                  previous={b.previous[i]}
                  isRecord={s.completed && records.includes(doneSets.indexOf(s))}
                  onChange={(changes) => updateSet(db, s.id, changes)}
                  onToggle={() => toggle(s.id, s.completed, rest)}
                  onDelete={async () => {
                    if (await confirm(`Delete set ${s.setIndex}?`, '', 'Delete', true)) {
                      await deleteSet(db, s.id);
                      await reload();
                    }
                  }}
                />
              ))}
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

/** When the rest period that starts now should end. */
function restDeadline(seconds: number) {
  return Date.now() + seconds * 1000;
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', justifyContent: 'space-between' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
