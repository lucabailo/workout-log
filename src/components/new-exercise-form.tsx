import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { createExercise, DuplicateExerciseError } from '@/db/repository';
import { LOAD_TYPES, MUSCLE_GROUPS, type LoadType, type MuscleGroup } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

/** Inline form to add a custom exercise to the library. */
export function NewExerciseForm({ onCreated, onCancel }: { onCreated: (id: number) => void; onCancel: () => void }) {
  const db = useSQLiteContext();
  const t = useTheme();
  const [name, setName] = useState('');
  const [group, setGroup] = useState<MuscleGroup>('Chest');
  const [loadType, setLoadType] = useState<LoadType>('barbell');
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      const id = await createExercise(db, name, group, loadType);
      onCreated(id);
    } catch (e) {
      setError(e instanceof DuplicateExerciseError ? e.message : e instanceof Error ? e.message : 'Could not save');
    }
  }

  return (
    <Card>
      <Txt variant="heading">New exercise</Txt>
      <TextInput
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        placeholder="Name, e.g. Bulgarian Split Squat"
        placeholderTextColor={t.textMuted}
        style={[styles.input, { backgroundColor: t.surfaceAlt, color: t.text }]}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <Txt variant="label" tone="muted">
        Muscle group
      </Txt>
      <Chips options={MUSCLE_GROUPS} value={group} onChange={setGroup} />
      <Txt variant="label" tone="muted">
        Load type
      </Txt>
      <Chips options={LOAD_TYPES} value={loadType} onChange={setLoadType} format={(l) => l[0].toUpperCase() + l.slice(1)} />
      <Txt variant="small" tone="muted">
        {loadType === 'bodyweight'
          ? 'You log the extra weight (+kg), or 0 for bodyweight only.'
          : loadType === 'dumbbell'
            ? 'You log the weight of one dumbbell.'
            : 'You log the total weight.'}
      </Txt>
      {error && <Txt tone="danger">{error}</Txt>}
      <View style={styles.actions}>
        <Button title="Cancel" variant="secondary" size="sm" onPress={onCancel} />
        <Button title="Save" size="sm" onPress={save} disabled={!name.trim()} />
      </View>
    </Card>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
  format = (v) => v,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  const t = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const selected = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.chip, { backgroundColor: selected ? t.accent : t.surfaceAlt }]}>
            <Txt variant="small" style={{ color: selected ? t.accentText : t.text, fontWeight: '600' }}>
              {format(o)}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderRadius: Radius.md, padding: Spacing.md, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
