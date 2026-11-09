import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Loading, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getActiveWorkout, listRoutines, startWorkoutFromRoutine } from '@/db/repository';
import { formatRelativeDay } from '@/domain/format';
import { plannedSets } from '@/domain/routines';
import type { RoutineSummary } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';

/** R1: the user's plan, one card per routine, each startable with one tap. */
export default function RoutinesScreen() {
  const { data, db } = useDbQuery(async (db) => ({
    routines: await listRoutines(db),
    active: await getActiveWorkout(db),
  }));

  if (!data) return <Loading />;
  const { routines, active } = data;

  async function start(routineId: number) {
    await startWorkoutFromRoutine(db, routineId);
    router.push('/active');
  }

  return (
    <Screen>
      <Button title="+ New routine" onPress={() => router.push('/routine-edit')} />
      {active && (
        <Card>
          <Txt variant="small" tone="muted">
            A workout is in progress, so routines can&apos;t be started right now.
          </Txt>
          <Button title="Resume workout" variant="secondary" size="sm" onPress={() => router.push('/active')} />
        </Card>
      )}
      {routines.length === 0 ? (
        <EmptyState
          title="No routines yet"
          message="Write down your plan once (Push, Pull, Legs…) and start any day with one tap."
        />
      ) : (
        routines.map((r) => (
          <RoutineCard key={r.id} routine={r} canStart={!active} onStart={() => start(r.id)} />
        ))
      )}
    </Screen>
  );
}

function RoutineCard({ routine, canStart, onStart }: { routine: RoutineSummary; canStart: boolean; onStart: () => void }) {
  return (
    <Pressable onPress={() => router.push(`/routines/${routine.id}`)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <Card>
        <View style={styles.header}>
          <Txt variant="heading" style={{ flex: 1 }} numberOfLines={1}>
            {routine.name}
          </Txt>
          <StartPill onPress={onStart} disabled={!canStart} label={`Start ${routine.name}`} />
        </View>
        <Txt numberOfLines={2}>{routine.exercises.map((e) => e.name).join(' · ')}</Txt>
        <Txt variant="small" tone="muted">
          {routine.exercises.length} exercise{routine.exercises.length === 1 ? '' : 's'} · {plannedSets(routine.exercises)} sets
          {routine.lastDone ? ` · last done ${formatRelativeDay(routine.lastDone)}` : ''}
        </Txt>
      </Card>
    </Pressable>
  );
}

function StartPill({ onPress, disabled, label }: { onPress: () => void; disabled: boolean; label: string }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.pill, { backgroundColor: t.accent, opacity: disabled ? 0.35 : pressed ? 0.75 : 1 }]}>
      <Txt style={{ color: t.accentText, fontWeight: '700', fontSize: 14 }}>Start</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pill: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
});
