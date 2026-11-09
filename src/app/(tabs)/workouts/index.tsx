import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Loading, Screen, SectionLabel, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  getActiveWorkout,
  getRoutineName,
  listRoutines,
  listWorkoutSummaries,
  startWorkout,
  startWorkoutFromRoutine,
} from '@/db/repository';
import { formatClock, formatDay, formatDuration, formatKg } from '@/domain/format';
import type { RoutineSummary } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';

/** 01 / 02 / 03: start a routine or an empty workout, resume the one in progress, and the history. */
export default function WorkoutsScreen() {
  const { data, db } = useDbQuery(async (db) => {
    const active = await getActiveWorkout(db);
    return {
      active,
      activeName: active ? await getRoutineName(db, active.routineId) : null,
      routines: await listRoutines(db),
      workouts: await listWorkoutSummaries(db),
    };
  });

  if (!data) return <Loading />;
  const { active, activeName, routines, workouts } = data;

  async function startEmpty() {
    await startWorkout(db);
    router.push('/active');
  }

  async function startRoutine(id: number) {
    await startWorkoutFromRoutine(db, id);
    router.push('/active');
  }

  return (
    <Screen>
      {active ? (
        <ActiveBanner startedAt={active.startedAt} name={activeName} />
      ) : routines.length > 0 ? (
        <>
          <SectionLabel>Start a routine</SectionLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick} style={styles.quickScroll}>
            {routines.map((r) => (
              <QuickStart key={r.id} routine={r} onPress={() => startRoutine(r.id)} single={routines.length === 1} />
            ))}
          </ScrollView>
          <Button title="+ Start empty workout" variant="secondary" onPress={startEmpty} />
        </>
      ) : (
        <>
          <Card>
            <Txt variant="heading">Set up your plan</Txt>
            <Txt tone="muted">Add your routines once (Push, Pull, Legs…), then start any workout with one tap.</Txt>
            <Button title="Create a routine" onPress={() => router.push('/routine-edit')} />
          </Card>
          <Button title="+ Start empty workout" variant="secondary" onPress={startEmpty} />
        </>
      )}

      {workouts.length === 0 ? (
        <EmptyState title="No workouts yet" message="Finished workouts will show up here." />
      ) : (
        <View style={{ gap: Spacing.md }}>
          <SectionLabel>History</SectionLabel>
          {workouts.map((w) => (
            <Pressable
              key={w.id}
              onPress={() => router.push(`/workouts/${w.id}`)}
              style={({ pressed }) => pressed && { opacity: 0.7 }}>
              <Card>
                <View style={styles.row}>
                  <Txt variant="heading" style={{ flex: 1 }} numberOfLines={1}>
                    {w.routineName ?? formatDay(w.startedAt)}
                  </Txt>
                  <Txt tone="muted" variant="small">
                    {w.routineName ? `${formatDay(w.startedAt)} · ` : ''}
                    {formatDuration(w.startedAt, w.finishedAt)}
                  </Txt>
                </View>
                <Txt tone="muted" numberOfLines={2}>
                  {w.exerciseNames.join(' · ')}
                </Txt>
                <Txt variant="small" tone="muted">
                  {w.setCount} sets · {formatKg(w.volumeKg)} kg lifted
                </Txt>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

function QuickStart({ routine, onPress, single }: { routine: RoutineSummary; onPress: () => void; single: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Start ${routine.name}`}
      style={({ pressed }) => [single ? { flex: 1 } : styles.quickItem, pressed && { opacity: 0.7 }]}>
      <Card style={{ gap: 2, padding: Spacing.md }}>
        <Txt variant="heading" style={{ fontSize: 17 }} numberOfLines={1}>
          {routine.name}
        </Txt>
        <Txt variant="small" tone="muted">
          {routine.exercises.length} exercises
        </Txt>
        <Txt variant="small" tone="accent" style={{ fontWeight: '700', marginTop: 4 }}>
          Start ›
        </Txt>
      </Card>
    </Pressable>
  );
}

/** Shown while a workout is in progress, with a live timer. */
function ActiveBanner({ startedAt, name }: { startedAt: string; name: string | null }) {
  const now = useNow();
  return (
    <Card>
      <Txt variant="label" tone="accent">
        {name ? `${name} · in progress` : 'Workout in progress'}
      </Txt>
      <Txt variant="number">{formatClock((now - Date.parse(startedAt)) / 1000)}</Txt>
      <Button title="Resume" onPress={() => router.push('/active')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm },
  quickScroll: { marginHorizontal: -Spacing.lg, flexGrow: 0 },
  quick: { gap: Spacing.sm, paddingHorizontal: Spacing.lg, flexGrow: 1 },
  quickItem: { width: 128 },
});
