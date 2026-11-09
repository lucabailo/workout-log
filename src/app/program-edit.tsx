import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, Field, ListRow, Loading, Screen, SectionLabel, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { deleteProgram, getProgram, listRoutines, saveProgram } from '@/db/repository';
import { programSlot } from '@/domain/plan';
import type { RoutineSummary } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';

type Phase = 'intro' | 'rotation';

/** R5: a program's name, the routines done once at the start (optional) and the rotation. */
export default function ProgramEditScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : undefined;

  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [name, setName] = useState('');
  const [introOn, setIntroOn] = useState(false);
  const [intro, setIntro] = useState<number[]>([]);
  const [rotation, setRotation] = useState<number[]>([]);
  const [position, setPosition] = useState(0);
  const [picking, setPicking] = useState<Phase | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await listRoutines(db);
      const program = id === undefined ? null : await getProgram(db, id);
      if (cancelled) return;
      setRoutines(all);
      if (program) {
        setName(program.name);
        setIntro(program.intro.map((x) => x.routineId));
        setIntroOn(program.intro.length > 0);
        setRotation(program.rotation.map((x) => x.routineId));
        setPosition(program.position);
      } else if (id !== undefined) {
        setMissing(true);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  if (!loaded) return <Loading />;
  if (missing) {
    return (
      <Screen>
        <EmptyState title="Program not found" message="It may have been deleted." />
      </Screen>
    );
  }

  const routineName = (rid: number) => routines.find((r) => r.id === rid)?.name ?? '?';
  const lists = { intro, rotation };
  const setList = (phase: Phase, next: number[]) => {
    (phase === 'intro' ? setIntro : setRotation)(next);
    setDirty(true);
    setError(null);
  };
  const usedIntro = introOn ? intro : [];
  const slot = programSlot(usedIntro.length, rotation.length, position);
  const nextId = slot ? (slot.phase === 'intro' ? usedIntro : rotation)[slot.index] : undefined;

  async function save() {
    if (!name.trim()) return setError('Give the program a name.');
    if (rotation.length === 0) return setError('Add at least one routine to the rotation.');
    await saveProgram(db, { id, name, intro: usedIntro, rotation, position });
    router.back();
  }

  async function cancel() {
    if (!dirty || (await confirm('Discard changes?', 'Your changes to this program will be lost.', 'Discard', true))) {
      router.back();
    }
  }

  async function remove() {
    if (id === undefined) return;
    if (await confirm(`Delete ${name}?`, 'Its routines and your history are kept.', 'Delete', true)) {
      await deleteProgram(db, id);
      router.back();
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: id === undefined ? 'New program' : 'Edit program',
          headerLeft: () => <Button title="Cancel" variant="ghost" size="sm" onPress={cancel} />,
          headerRight: () => <Button title="Save" variant="ghost" size="sm" onPress={save} />,
        }}
      />
      <Screen>
        <Field
          label="Program name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setDirty(true);
            setError(null);
          }}
          placeholder="e.g. Dad’s split"
          autoFocus={id === undefined}
        />

        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt style={{ fontWeight: '600' }}>Start with one-time routines</Txt>
              <Txt variant="small" tone="muted">
                Done once, before the rotation begins
              </Txt>
            </View>
            <Switch
              value={introOn}
              onValueChange={(v) => {
                setIntroOn(v);
                setDirty(true);
              }}
              trackColor={{ true: t.accent, false: t.border }}
              accessibilityLabel="Start with one-time routines"
            />
          </View>
        </Card>

        {introOn && (
          <>
            <SectionLabel>Start with · once</SectionLabel>
            <RoutineList
              ids={intro}
              nameOf={routineName}
              onChange={(next) => setList('intro', next)}
              onAdd={() => setPicking('intro')}
            />
            <Txt variant="small" tone="muted">
              {intro.length > 0
                ? `${intro.map(routineName).join(', ')}: one time each, in order, then the rotation starts.`
                : 'Add the routines you do only the first time, e.g. A, B, C.'}
            </Txt>
          </>
        )}

        <SectionLabel>{introOn ? 'Then repeat in order' : 'Rotation'}</SectionLabel>
        <RoutineList
          ids={rotation}
          nameOf={routineName}
          onChange={(next) => setList('rotation', next)}
          onAdd={() => setPicking('rotation')}
        />
        <Txt variant="small" tone="muted">
          {rotation.length > 0
            ? `${[...rotation.map(routineName), routineName(rotation[0])].join(' → ')}… The app always tells you which one is next. Exercises with ★ move one step every time you do that routine.`
            : 'Add the routines in the order you do them.'}
        </Txt>

        {id !== undefined && nextId !== undefined && slot && (
          <>
            <SectionLabel>Progress</SectionLabel>
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={{ fontWeight: '600' }}>
                    Next up: {routineName(nextId)}
                    {slot.lap > 0 ? ` · lap ${slot.lap}` : ' · start'}
                  </Txt>
                  <Txt variant="small" tone="muted">
                    Wrong? Move it back or forward.
                  </Txt>
                </View>
                <Step
                  label="Previous routine"
                  text="‹"
                  onPress={() => {
                    setPosition(Math.max(0, position - 1));
                    setDirty(true);
                  }}
                />
                <Step
                  label="Next routine"
                  text="›"
                  onPress={() => {
                    setPosition(position + 1);
                    setDirty(true);
                  }}
                />
              </View>
            </Card>
          </>
        )}

        {error && <Txt tone="danger">{error}</Txt>}
        <Button title="Save program" onPress={save} />
        {id !== undefined && <Button title="Delete program" variant="danger" onPress={remove} />}
        {id !== undefined && (
          <Txt variant="small" tone="muted" style={{ textAlign: 'center' }}>
            Deleting a program keeps its routines and your history.
          </Txt>
        )}
      </Screen>

      <RoutinePicker
        visible={picking !== null}
        routines={routines}
        onClose={() => setPicking(null)}
        onPick={(rid) => {
          if (picking) setList(picking, [...lists[picking], rid]);
          setPicking(null);
        }}
      />
    </>
  );
}

function RoutineList({
  ids,
  nameOf,
  onChange,
  onAdd,
}: {
  ids: number[];
  nameOf: (id: number) => string;
  onChange: (next: number[]) => void;
  onAdd: () => void;
}) {
  const t = useTheme();
  const move = (i: number, by: -1 | 1) => {
    const next = [...ids];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x);
    onChange(next);
  };
  return (
    <Card style={{ paddingVertical: 4, gap: 0 }}>
      {ids.map((rid, i) => (
        <View
          key={`${rid}-${i}`}
          style={[styles.listItem, i > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
          <View style={[styles.order, { backgroundColor: t.surfaceAlt }]}>
            <Txt variant="small" tone="muted" style={{ fontWeight: '700' }}>
              {i + 1}
            </Txt>
          </View>
          <Txt style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>
            {nameOf(rid)}
          </Txt>
          <Step label={`Move ${nameOf(rid)} up`} text="↑" disabled={i === 0} onPress={() => move(i, -1)} small />
          <Step
            label={`Move ${nameOf(rid)} down`}
            text="↓"
            disabled={i === ids.length - 1}
            onPress={() => move(i, 1)}
            small
          />
          <Step
            label={`Remove ${nameOf(rid)}`}
            text="✕"
            onPress={() => onChange(ids.filter((_, j) => j !== i))}
            small
          />
        </View>
      ))}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        style={[
          styles.listItem,
          ids.length > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth },
        ]}>
        <Txt tone="accent" style={{ fontWeight: '700' }}>
          + Add routine
        </Txt>
      </Pressable>
    </Card>
  );
}

function Step({
  label,
  text,
  onPress,
  disabled,
  small,
}: {
  label: string;
  text: string;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        small ? styles.small : [styles.step, { backgroundColor: t.surfaceAlt }],
        { opacity: disabled ? 0.25 : pressed ? 0.5 : 1 },
      ]}>
      <Txt tone={small ? 'muted' : 'accent'} style={{ fontWeight: '800', fontSize: small ? 15 : 18 }}>
        {text}
      </Txt>
    </Pressable>
  );
}

function RoutinePicker({
  visible,
  routines,
  onClose,
  onPick,
}: {
  visible: boolean;
  routines: RoutineSummary[];
  onClose: () => void;
  onPick: (id: number) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: insets.bottom + Spacing.lg }]}>
        <Txt variant="heading">Add a routine</Txt>
        {routines.length === 0 ? (
          <Txt tone="muted">Create some routines first, then put them in the program.</Txt>
        ) : (
          <ScrollView style={{ maxHeight: 360 }}>
            {routines.map((r, i) => (
              <ListRow
                key={r.id}
                first={i === 0}
                title={r.name}
                detail={r.exercises.map((e) => e.name).join(' · ')}
                onPress={() => onPick(r.id)}
              />
            ))}
          </ScrollView>
        )}
        <Button title="Cancel" variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 12 },
  order: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  small: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  step: { width: 40, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
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
});
