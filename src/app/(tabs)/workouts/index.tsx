import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Loading, Screen, SectionLabel, Txt } from '@/components/ui';
import { UnfinishedPrompt } from '@/components/unfinished-prompt';
import { Spacing } from '@/constants/theme';
import {
  activeWorkoutStatus,
  deleteWorkout,
  finishWorkout,
  listPrograms,
  listRoutines,
  listWorkoutSummaries,
  startWorkout,
  startWorkoutFromRoutine,
} from '@/db/repository';
import { formatClock, formatDay, formatDuration, formatKg } from '@/domain/format';
import { looksForgotten } from '@/domain/routines';
import { programSlot } from '@/domain/plan';
import type { RoutineSummary } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { confirm } from '@/lib/confirm';

/** Set once per app launch: the open-workout check runs only the first time this tab loads. */
let launchChecked = false;

/** 01 / 02 / 03: start a routine or an empty workout, resume the one in progress, and the history. */
export default function WorkoutsScreen() {
  const { data, db, reload } = useDbQuery(async (db) => ({
    active: await activeWorkoutStatus(db),
    routines: await listRoutines(db),
    programs: await listPrograms(db),
    workouts: await listWorkoutSummaries(db),
  }));
  const now = useNow(60_000);
  const [isLaunch] = useState(() => !launchChecked);
  const [promptDone, setPromptDone] = useState(false);

  // On launch, a workout that is still open and recent is reopened directly (02b).
  useEffect(() => {
    if (launchChecked || !data) return;
    launchChecked = true;
    if (data.active && !looksForgotten(data.active.startedAt, Date.now())) router.push('/active');
  }, [data]);

  if (!data) return <Loading />;
  const { active, routines, programs, workouts } = data;
  // Each program's next routine comes first in the quick start.
  const programNext = programs.flatMap((program) => {
    const slot = programSlot(program.intro.length, program.rotation.length, program.position);
    const next = slot ? (slot.phase === 'intro' ? program.intro : program.rotation)[slot.index] : null;
    const routine = routines.find((r) => r.id === next?.routineId);
    return routine ? [{ program, routine }] : [];
  });
  const showPrompt = isLaunch && !promptDone && !!active && looksForgotten(active.startedAt, now);

  async function finishForgotten() {
    if (!active) return;
    setPromptDone(true);
    if (await finishWorkout(db, active.workoutId, undefined, { endAtLastSet: true })) {
      router.push({ pathname: '/summary', params: { id: active.workoutId } });
    }
    await reload();
  }

  async function discardForgotten() {
    if (!active) return;
    if (await confirm('Discard workout?', 'Everything logged in this workout will be lost.', 'Discard', true)) {
      setPromptDone(true);
      await deleteWorkout(db, active.workoutId);
      await reload();
    }
  }

  async function startEmpty() {
    await startWorkout(db);
    router.push('/active');
  }

  async function startRoutine(id: number, programId?: number) {
    await startWorkoutFromRoutine(db, id, { programId });
    router.push('/active');
  }

  return (
    <Screen>
      {showPrompt && (
        <UnfinishedPrompt
          status={active}
          hoursAgo={Math.floor((now - Date.parse(active.startedAt)) / 3_600_000)}
          onResume={() => {
            setPromptDone(true);
            router.push('/active');
          }}
          onFinish={finishForgotten}
          onDiscard={discardForgotten}
        />
      )}
      {active ? (
        <ActiveBanner startedAt={active.startedAt} name={active.routineName} />
      ) : routines.length > 0 ? (
        <>
          <SectionLabel>Start a routine</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quick}
            style={styles.quickScroll}>
            {programNext.map(({ program, routine }) => (
              <QuickStart
                key={`p${program.id}`}
                routine={routine}
                label={`Next · ${program.name}`}
                onPress={() => startRoutine(routine.id, program.id)}
                single={false}
              />
            ))}
            {routines.map((r) => (
              <QuickStart
                key={r.id}
                routine={r}
                onPress={() => startRoutine(r.id)}
                single={routines.length === 1 && programNext.length === 0}
              />
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

function QuickStart({
  routine,
  onPress,
  single,
  label,
}: {
  routine: RoutineSummary;
  onPress: () => void;
  single: boolean;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Start ${routine.name}`}
      style={({ pressed }) => [single ? { flex: 1 } : styles.quickItem, pressed && { opacity: 0.7 }]}>
      <Card style={{ gap: 2, padding: Spacing.md }}>
        {label && (
          <Txt variant="small" tone="accent" style={{ fontWeight: '700' }} numberOfLines={1}>
            {label}
          </Txt>
        )}
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
