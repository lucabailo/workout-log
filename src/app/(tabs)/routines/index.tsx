import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, Loading, Screen, SectionLabel, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { getActiveWorkout, listPrograms, listRoutines, startWorkoutFromRoutine } from '@/db/repository';
import { formatRelativeDay } from '@/domain/format';
import { programSlot } from '@/domain/plan';
import { plannedSets } from '@/domain/routines';
import type { Program, RoutineSummary } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';

/** R1: programs first (with the routine that's next), then every routine, each startable with one tap. */
export default function RoutinesScreen() {
  const [creating, setCreating] = useState(false);
  const { data, db } = useDbQuery(async (db) => ({
    routines: await listRoutines(db),
    programs: await listPrograms(db),
    active: await getActiveWorkout(db),
  }));

  if (!data) return <Loading />;
  const { routines, programs, active } = data;

  async function start(routineId: number, programId?: number) {
    await startWorkoutFromRoutine(db, routineId, { programId });
    router.push('/active');
  }

  return (
    <Screen>
      <Button title="+ New routine or program" onPress={() => setCreating(true)} />
      {programs.length > 0 && <SectionLabel>{programs.length === 1 ? 'Program' : 'Programs'}</SectionLabel>}
      {programs.map((p) => (
        <ProgramCard
          key={p.id}
          program={p}
          routines={routines}
          canStart={!active}
          onStart={(routineId) => start(routineId, p.id)}
        />
      ))}
      {programs.length > 0 && routines.length > 0 && <SectionLabel>Routines</SectionLabel>}
      {routines.length === 0 ? (
        <EmptyState
          title="No routines yet"
          message="Write down your plan once (Push, Pull, Legs…) and start any day with one tap."
        />
      ) : (
        routines.map((r) => <RoutineCard key={r.id} routine={r} canStart={!active} onStart={() => start(r.id)} />)
      )}
      <CreateSheet
        visible={creating}
        onClose={() => setCreating(false)}
        hasRoutines={routines.length > 0}
        onPick={(what) => {
          setCreating(false);
          router.push(what === 'routine' ? '/routine-edit' : '/program-edit');
        }}
      />
    </Screen>
  );
}

function ProgramCard({
  program,
  routines,
  canStart,
  onStart,
}: {
  program: Program;
  routines: RoutineSummary[];
  canStart: boolean;
  onStart: (routineId: number) => void;
}) {
  const t = useTheme();
  const slot = programSlot(program.intro.length, program.rotation.length, program.position);
  const next = slot ? (slot.phase === 'intro' ? program.intro : program.rotation)[slot.index] : null;
  const routine = routines.find((r) => r.id === next?.routineId);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/program-edit', params: { id: program.id } })}
      style={({ pressed }) => pressed && { opacity: 0.8 }}>
      <Card style={{ borderColor: t.accent, borderWidth: 1.5 }}>
        <View style={styles.header}>
          <Txt variant="heading" style={{ flex: 1 }} numberOfLines={1}>
            {program.name}
          </Txt>
          {slot && slot.lap > 0 && (
            <View style={[styles.tag, { backgroundColor: t.surfaceAlt }]}>
              <Txt variant="small" tone="muted" style={{ fontWeight: '700' }}>
                Lap {slot.lap}
              </Txt>
            </View>
          )}
        </View>
        {program.intro.length > 0 && (
          <>
            <Txt variant="label" tone="muted">
              Start · once
            </Txt>
            <Strip
              items={program.intro.map((x, i) => ({
                name: x.name,
                state:
                  slot?.phase === 'rotation' || i < (slot?.index ?? 0) ? 'done' : i === slot?.index ? 'next' : 'todo',
              }))}
            />
            <Txt variant="label" tone="muted">
              Rotation
            </Txt>
          </>
        )}
        <Strip
          items={program.rotation.map((x, i) => ({
            name: x.name,
            state: slot?.phase !== 'rotation' ? 'todo' : i < slot.index ? 'done' : i === slot.index ? 'next' : 'todo',
          }))}
        />
        {next && routine && (
          <>
            <View style={{ gap: 2, marginTop: Spacing.xs }}>
              <Txt variant="label" tone="accent">
                Next up
              </Txt>
              <Txt variant="heading" style={{ fontSize: 17 }} numberOfLines={1}>
                {routine.name}
              </Txt>
            </View>
            <Txt variant="small" tone="muted" numberOfLines={2}>
              {routine.exercises.map((e) => `${e.name}${e.plan.mode === 'progression' ? ' ★' : ''}`).join(' · ')}
            </Txt>
            <Button title={`Start ${routine.name}`} onPress={() => onStart(routine.id)} disabled={!canStart} />
          </>
        )}
      </Card>
    </Pressable>
  );
}

/** Small cells for the routines of a program: done ✓, next highlighted, the rest grey. */
function Strip({ items }: { items: { name: string; state: 'done' | 'next' | 'todo' }[] }) {
  const t = useTheme();
  return (
    <View style={styles.strip}>
      {items.map((x, i) => (
        <View
          key={i}
          style={[
            styles.cell,
            {
              backgroundColor: x.state === 'done' ? t.successSoft : x.state === 'next' ? t.accent : t.surfaceAlt,
            },
          ]}>
          <Txt
            variant="small"
            numberOfLines={1}
            style={{
              fontWeight: '700',
              color: x.state === 'done' ? t.success : x.state === 'next' ? t.accentText : t.textMuted,
            }}>
            {x.state === 'done' ? '✓ ' : ''}
            {x.name}
          </Txt>
        </View>
      ))}
    </View>
  );
}

function CreateSheet({
  visible,
  onClose,
  onPick,
  hasRoutines,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (what: 'routine' | 'program') => void;
  hasRoutines: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + Spacing.lg }]}>
        <Txt variant="heading">Create</Txt>
        <Option
          icon="≡"
          title="Routine"
          detail="One workout day, e.g. Push day. Start it whenever you want."
          onPress={() => onPick('routine')}
        />
        <Option
          icon="↻"
          title="Program"
          detail={
            hasRoutines
              ? 'Routines done in rotation, e.g. D → E → F… The app tells you which one is next.'
              : 'Routines done in rotation. Create the routines first, then put them in a program.'
          }
          disabled={!hasRoutines}
          onPress={() => onPick('program')}
        />
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}

function Option({
  icon,
  title,
  detail,
  onPress,
  disabled,
}: {
  icon: string;
  title: string;
  detail: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.option,
        { backgroundColor: t.surfaceAlt, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
      ]}>
      <View style={[styles.icon, { backgroundColor: t.accent }]}>
        <Txt style={{ color: t.accentText, fontSize: 20, fontWeight: '800' }}>{icon}</Txt>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: '700' }}>{title}</Txt>
        <Txt variant="small" tone="muted">
          {detail}
        </Txt>
      </View>
      <Txt tone="muted" style={{ fontSize: 20 }}>
        ›
      </Txt>
    </Pressable>
  );
}

function RoutineCard({
  routine,
  canStart,
  onStart,
}: {
  routine: RoutineSummary;
  canStart: boolean;
  onStart: () => void;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/routines/${routine.id}`)}
      style={({ pressed }) => pressed && { opacity: 0.7 }}>
      <Card>
        <View style={styles.header}>
          <Txt variant="heading" style={{ flex: 1 }} numberOfLines={1}>
            {routine.name}
          </Txt>
          <StartPill onPress={onStart} disabled={!canStart} label={`Start ${routine.name}`} />
        </View>
        <Txt numberOfLines={2}>
          {routine.exercises.map((e) => `${e.name}${e.plan.mode === 'progression' ? ' ★' : ''}`).join(' · ')}
        </Txt>
        <Txt variant="small" tone="muted">
          {routine.exercises.length} exercise{routine.exercises.length === 1 ? '' : 's'} ·{' '}
          {plannedSets(routine.exercises)} sets
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
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: t.accent, opacity: disabled ? 0.35 : pressed ? 0.75 : 1 },
      ]}>
      <Txt style={{ color: t.accentText, fontWeight: '700', fontSize: 14 }}>Start</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pill: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  cell: {
    flexGrow: 1,
    flexBasis: 44,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
  },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
