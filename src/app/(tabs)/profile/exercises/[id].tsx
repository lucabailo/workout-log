import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/line-chart';
import { OneRepMaxCard } from '@/components/one-rep-max-card';
import { SetSummary } from '@/components/set-summary';
import { Card, EmptyState, Loading, Screen, Stat, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { exerciseSessions, getExercise, typedOneRepMax } from '@/db/repository';
import { formatDay, formatKg } from '@/domain/format';
import { oneRepMaxProgress, personalRecords, volume } from '@/domain/stats';
import { useDbQuery } from '@/hooks/use-db-query';

export default function ExerciseDetailScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data, reload } = useDbQuery(async (db) => {
    const exercise = await getExercise(db, id);
    return exercise
      ? { exercise, sessions: await exerciseSessions(db, id), typed: await typedOneRepMax(db, id) }
      : null;
  });

  if (data === undefined) return <Loading />;
  if (data === null) {
    return (
      <Screen>
        <EmptyState title="Exercise not found" message="It may have been removed." />
      </Screen>
    );
  }

  const { exercise, sessions, typed } = data;
  const pr = personalRecords(sessions);
  const progress = oneRepMaxProgress(sessions);

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise.name }} />
      <Txt tone="muted">
        {exercise.muscleGroup}
        {exercise.isCustom ? ' · custom exercise' : ''}
      </Txt>

      <OneRepMaxCard
        key={String(typed)}
        exerciseId={exercise.id}
        typed={typed}
        estimated={pr.bestOneRepMaxKg}
        onSaved={reload}
      />

      {sessions.length === 0 ? (
        <EmptyState
          title="No history yet"
          message="Add this exercise to a workout. Records and progress will appear here."
        />
      ) : (
        <>
          <View style={styles.stats}>
            <Stat value={formatKg(pr.heaviestKg)} label="Heaviest kg" />
            <Stat value={formatKg(pr.bestOneRepMaxKg)} label="Best est. 1RM" />
            <Stat value={formatKg(pr.bestSessionVolumeKg)} label="Best volume" />
          </View>

          <Card>
            <Txt variant="heading">Estimated 1RM</Txt>
            <Txt variant="small" tone="muted">
              Best set of each workout, using the Epley formula.
            </Txt>
            <LineChart points={progress} />
          </Card>

          <Txt variant="label" tone="muted">
            History · {pr.sessions} workout{pr.sessions === 1 ? '' : 's'}
          </Txt>
          {sessions.map((s) => (
            <Pressable key={s.workoutId} onPress={() => router.push(`/workouts/${s.workoutId}`)}>
              <Card>
                <View style={styles.row}>
                  <Txt variant="heading">{formatDay(s.date)}</Txt>
                  <Txt variant="small" tone="muted">
                    {formatKg(volume(s.sets))} kg
                  </Txt>
                </View>
                <SetSummary sets={s.sets} />
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
