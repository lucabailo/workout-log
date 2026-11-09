import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, EmptyState, Loading, Screen, Stat, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import {
  exerciseSessions,
  getRoutineName,
  getWorkout,
  getWorkoutBlocks,
  previousRoutineVolume,
  setWorkoutNotes,
  updateRoutineTargets,
  workoutPlan,
} from '@/db/repository';
import { formatDay, formatDuration, formatKg } from '@/domain/format';
import { suggestedTargetUpdates } from '@/domain/routines';
import { estimatedOneRepMax, newRecordIndexes, volume } from '@/domain/stats';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';

/** 04b: shown right after "Finish". Stats, new records, and an offer to raise the routine's targets. */
export default function SummaryScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const t = useTheme();
  const [notes, setNotes] = useState('');
  const [targetsDone, setTargetsDone] = useState<'updated' | 'kept' | null>(null);

  const { data, db } = useDbQuery(async (db) => {
    const workout = await getWorkout(db, id);
    if (!workout?.finishedAt) return null;
    const blocks = await getWorkoutBlocks(db, id);
    const records = await Promise.all(
      blocks.map(async (b) => {
        const earlier = (await exerciseSessions(db, b.exercise.id)).filter((s) => s.date < workout.startedAt);
        return newRecordIndexes(b.sets, earlier).map((i) => ({ name: b.exercise.name, set: b.sets[i] }));
      }),
    );
    const plan = await workoutPlan(db, id);
    const updates = suggestedTargetUpdates([...plan.values()], new Map(blocks.map((b) => [b.exercise.id, b.sets])));
    const previous = workout.routineId ? await previousRoutineVolume(db, workout.routineId, workout.startedAt) : null;
    return {
      workout,
      blocks,
      records: records.flat(),
      updates,
      previous,
      routineName: await getRoutineName(db, workout.routineId),
    };
  });

  if (data === undefined) return <Loading />;
  if (data === null) {
    return (
      <Screen>
        <EmptyState
          title="Nothing saved"
          message="The workout had no completed sets."
          action={<Button title="Close" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const { workout, blocks, records, updates, previous, routineName } = data;
  const sets = blocks.flatMap((b) => b.sets);
  const total = volume(sets);
  const diff = previous === null ? null : total - previous;

  async function done() {
    if (notes.trim()) await setWorkoutNotes(db, id, notes);
    router.back();
    router.push(`/workouts/${id}`);
  }

  async function applyTargets() {
    if (!workout.routineId) return;
    await updateRoutineTargets(
      db,
      workout.routineId,
      updates.map((u) => ({ exerciseId: u.exerciseId, targetKg: u.toKg })),
    );
    setTargetsDone('updated');
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => null,
          headerRight: () => <Button title="Done" variant="ghost" size="sm" onPress={done} />,
        }}
      />
      <Screen>
        <View style={styles.hero}>
          <View style={[styles.check, { backgroundColor: t.accent }]}>
            <Txt style={{ color: t.accentText, fontSize: 30, fontWeight: '800' }}>✓</Txt>
          </View>
          <Txt variant="title">Nice work!</Txt>
          <Txt tone="muted">
            {routineName ? `${routineName} · ` : ''}
            {formatDay(workout.startedAt)}
          </Txt>
        </View>

        <View style={styles.stats}>
          <Stat value={formatDuration(workout.startedAt, workout.finishedAt!)} label="Duration" />
          <Stat value={String(sets.filter((s) => s.dropIndex === 0).length)} label="Sets" />
          <Stat value={formatKg(total)} label="kg lifted" />
        </View>
        {diff !== null && diff !== 0 && (
          <Txt variant="small" tone="muted" style={{ textAlign: 'center' }}>
            {diff > 0 ? '+' : '−'}
            {formatKg(Math.abs(diff))} kg compared to your last {routineName}
          </Txt>
        )}

        {records.length > 0 && (
          <Card>
            <Txt variant="heading" tone="record">
              🏆 {records.length} new personal record{records.length === 1 ? '' : 's'}
            </Txt>
            {records.map((r, i) => (
              <Txt key={i}>
                {r.name} · {formatKg(r.set.weightKg)} kg × {r.set.reps}
                <Txt tone="muted"> (est. 1RM {formatKg(estimatedOneRepMax(r.set))} kg)</Txt>
              </Txt>
            ))}
          </Card>
        )}

        {updates.length > 0 && targetsDone === null && (
          <Card>
            <Txt variant="heading">Update {routineName} with today&apos;s weights?</Txt>
            {updates.map((u) => (
              <Txt key={u.exerciseId} tone="muted">
                {u.name} {formatKg(u.fromKg)} → {formatKg(u.toKg)} kg
              </Txt>
            ))}
            <View style={styles.actions}>
              <Button
                title="Keep as is"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => setTargetsDone('kept')}
              />
              <Button title="Update" style={{ flex: 1 }} onPress={applyTargets} />
            </View>
          </Card>
        )}
        {targetsDone === 'updated' && (
          <Txt tone="success" style={{ textAlign: 'center', fontWeight: '600' }}>
            ✓ {routineName} updated
          </Txt>
        )}

        <TextInput
          style={[styles.notes, { backgroundColor: t.surface, borderColor: t.border, color: t.text }]}
          placeholder="How did it go? (optional)"
          placeholderTextColor={t.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <Button title="Done" onPress={done} />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.xs, paddingTop: Spacing.md },
  check: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  stats: { flexDirection: 'row', gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  notes: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    padding: Spacing.md,
    minHeight: 72,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
