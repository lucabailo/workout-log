import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { SetSummary } from '@/components/set-summary';
import { Button, Card, EmptyState, Loading, Screen, Stat, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteWorkout, exerciseSessions, getWorkout, getWorkoutBlocks } from '@/db/repository';
import { formatDay, formatDuration, formatKg } from '@/domain/format';
import { newRecordIndexes, volume } from '@/domain/stats';
import { useDbQuery } from '@/hooks/use-db-query';
import { confirm } from '@/lib/confirm';

export default function WorkoutDetailScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);

  const { data, db } = useDbQuery(async (db) => {
    const workout = await getWorkout(db, id);
    if (!workout) return null;
    const blocks = await getWorkoutBlocks(db, id);
    // For each exercise, which sets were personal records at the time of this workout.
    const records = await Promise.all(
      blocks.map(async (b) => {
        const earlier = (await exerciseSessions(db, b.exercise.id)).filter((s) => s.date < workout.startedAt);
        return newRecordIndexes(b.sets, earlier);
      }),
    );
    return { workout, blocks, records };
  });

  if (data === undefined) return <Loading />;
  if (data === null) {
    return (
      <Screen>
        <EmptyState title="Workout not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const { workout, blocks, records } = data;
  const allSets = blocks.flatMap((b) => b.sets);
  const prCount = records.reduce((n, r) => n + r.length, 0);

  async function remove() {
    if (await confirm('Delete workout?', 'This workout and all its sets will be removed.', 'Delete', true)) {
      await deleteWorkout(db, id);
      router.back();
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: formatDay(workout.startedAt) }} />

      <View style={styles.stats}>
        <Stat
          value={workout.finishedAt ? formatDuration(workout.startedAt, workout.finishedAt) : '—'}
          label="Duration"
        />
        <Stat value={String(allSets.filter((s) => s.dropIndex === 0).length)} label="Sets" />
        <Stat value={`${formatKg(volume(allSets))}`} label="kg lifted" />
      </View>

      {prCount > 0 && (
        <Txt tone="record" variant="heading">
          🏆 {prCount} personal record{prCount === 1 ? '' : 's'}
        </Txt>
      )}

      {workout.notes && (
        <Card>
          <Txt variant="label" tone="muted">
            Notes
          </Txt>
          <Txt>{workout.notes}</Txt>
        </Card>
      )}

      {blocks.map((b, i) => (
        <Pressable key={b.exercise.id} onPress={() => router.push(`/profile/exercises/${b.exercise.id}`)}>
          <Card>
            <Txt variant="heading">{b.exercise.name}</Txt>
            <SetSummary sets={b.sets} recordIndexes={records[i]} />
          </Card>
        </Pressable>
      ))}

      <Button title="Delete workout" variant="danger" onPress={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: Spacing.sm },
});
