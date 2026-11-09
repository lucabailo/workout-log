import { router, Stack, useLocalSearchParams } from 'expo-router';

import { Button, Card, EmptyState, ListRow, Loading, Screen, SectionLabel, Txt } from '@/components/ui';
import { getActiveWorkout, getRoutine, startWorkoutFromRoutine } from '@/db/repository';
import { formatDay, formatKg, formatReps, formatRest } from '@/domain/format';
import { plannedSets, supersetLabels } from '@/domain/routines';
import { useDbQuery } from '@/hooks/use-db-query';

/** R2: read-only view of one routine, with the button to start it. */
export default function RoutineDetailScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data, db } = useDbQuery(async (db) => ({
    routine: await getRoutine(db, id),
    active: await getActiveWorkout(db),
  }));

  if (!data) return <Loading />;
  const { routine, active } = data;
  if (!routine) {
    return (
      <Screen>
        <EmptyState title="Routine not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const labels = supersetLabels(routine.exercises);

  async function start() {
    await startWorkoutFromRoutine(db, id);
    router.push('/active');
  }

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: routine.name,
          headerRight: () => (
            <Button
              title="Edit"
              variant="ghost"
              size="sm"
              onPress={() => router.push({ pathname: '/routine-edit', params: { id } })}
            />
          ),
        }}
      />
      {active ? (
        <Button title="Resume workout in progress" variant="secondary" onPress={() => router.push('/active')} />
      ) : (
        <Button title="Start workout" onPress={start} />
      )}
      <Txt variant="small" tone="muted">
        {routine.exercises.length} exercises · {plannedSets(routine.exercises)} sets
        {routine.lastDone ? ` · last done ${formatDay(routine.lastDone)}` : ' · not done yet'}
      </Txt>
      <Card style={{ paddingVertical: 4 }}>
        {routine.exercises.map((e, i) => (
          <ListRow
            key={e.exerciseId}
            first={i === 0}
            title={labels.has(e.exerciseId) ? `${labels.get(e.exerciseId)}  ${e.name}` : e.name}
            detail={`${e.sets} sets × ${formatReps(e.repsMin, e.repsMax)} reps · ${
              e.supersetWithNext ? 'superset, no rest' : `rest ${formatRest(e.restSeconds)}`
            }`}
            value={e.targetKg === null ? '—' : `${e.loadType === 'bodyweight' ? '+' : ''}${formatKg(e.targetKg)} kg`}
            onPress={() => router.push(`/profile/exercises/${e.exerciseId}`)}
          />
        ))}
      </Card>
      {routine.notes && (
        <Card>
          <SectionLabel>Notes</SectionLabel>
          <Txt>{routine.notes}</Txt>
        </Card>
      )}
    </Screen>
  );
}
