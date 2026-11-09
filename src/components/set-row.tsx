import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge, Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { formatKg, parseNumber } from '@/domain/format';
import type { LoadType, WorkoutSet } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

interface Props {
  set: WorkoutSet;
  previous?: Pick<WorkoutSet, 'reps' | 'weightKg'>;
  isRecord: boolean;
  onChange: (changes: { reps?: number; weightKg?: number }) => void;
  onToggle: () => void;
  onDelete: () => void;
  /** A drop after the first part of a drop set: no tick of its own (the first part ticks the chain). */
  drop?: boolean;
}

/** One editable row of the active workout: set number, last time, weight, reps, done. */
export function SetRow({ set, previous, isRecord, onChange, onToggle, onDelete, drop = false }: Props) {
  const t = useTheme();
  const [weight, setWeight] = useState(set.weightKg ? String(set.weightKg) : '');
  const [reps, setReps] = useState(set.reps ? String(set.reps) : '');

  const done = set.completed;
  const inputStyle = [styles.input, { backgroundColor: done ? 'transparent' : t.surfaceAlt, color: t.text }];

  return (
    <View style={[styles.row, done && { backgroundColor: t.successSoft }]}>
      <Pressable onLongPress={onDelete} style={styles.indexCell} accessibilityHint="Long press to delete this set">
        <Txt variant="small" tone="muted" style={{ fontWeight: '700' }}>
          {drop ? '↳' : set.setIndex}
        </Txt>
      </Pressable>
      <View style={styles.prevCell}>
        {drop ? (
          <Txt variant="small" tone="muted">
            drop {set.dropIndex}
          </Txt>
        ) : isRecord && done ? (
          <Badge label="PR" />
        ) : (
          <Txt variant="small" tone="muted" numberOfLines={1}>
            {previous ? `${formatKg(previous.weightKg)}×${previous.reps}` : '—'}
          </Txt>
        )}
      </View>
      <TextInput
        style={inputStyle}
        value={weight}
        onChangeText={(text) => {
          setWeight(text);
          onChange({ weightKg: parseNumber(text) });
        }}
        keyboardType="decimal-pad"
        placeholder={previous ? formatKg(previous.weightKg) : 'kg'}
        placeholderTextColor={t.textMuted}
        accessibilityLabel={`Set ${set.setIndex}${drop ? ` drop ${set.dropIndex}` : ''} weight in kilograms`}
        selectTextOnFocus
      />
      <TextInput
        style={inputStyle}
        value={reps}
        onChangeText={(text) => {
          setReps(text);
          onChange({ reps: Math.round(parseNumber(text)) });
        }}
        keyboardType="number-pad"
        placeholder={set.kind === 'max' ? 'max' : previous ? String(previous.reps) : 'reps'}
        placeholderTextColor={t.textMuted}
        accessibilityLabel={`Set ${set.setIndex}${drop ? ` drop ${set.dropIndex}` : ''} repetitions`}
        selectTextOnFocus
      />
      {drop ? (
        <View style={{ width: 40 }} />
      ) : (
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`Set ${set.setIndex} done`}
          style={[styles.check, { backgroundColor: done ? t.success : t.surfaceAlt }]}>
          <Text style={{ color: done ? '#fff' : t.textMuted, fontWeight: '800', fontSize: 16 }}>✓</Text>
        </Pressable>
      )}
    </View>
  );
}

/** What the weight column means: total, per hand, or extra weight on top of the body. */
export function weightLabel(loadType: LoadType): string {
  return loadType === 'bodyweight' ? '+kg' : loadType === 'dumbbell' ? 'kg/hand' : 'kg';
}

export function SetHeader({ loadType = 'barbell' }: { loadType?: LoadType }) {
  return (
    <View style={styles.row}>
      {['Set', 'Previous', weightLabel(loadType), 'Reps', ''].map((label, i) => (
        <Txt
          key={i}
          variant="label"
          tone="muted"
          style={[
            i === 0 ? styles.indexCell : i === 1 ? styles.prevCell : i === 4 ? { width: 40 } : styles.headerInput,
          ]}>
          {label}
        </Txt>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
  },
  indexCell: { width: 28, alignItems: 'center' },
  prevCell: { flex: 1.2 },
  headerInput: { flex: 1, textAlign: 'center' },
  input: {
    flex: 1,
    minWidth: 0, // lets the field shrink instead of overflowing (web gives inputs a default width)
    width: 0,
    borderRadius: Radius.sm,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  check: { width: 40, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
});
