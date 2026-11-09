import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import type { ExerciseListItem } from '@/db/repository';
import { formatShortDate } from '@/domain/format';
import { MUSCLE_GROUPS } from '@/domain/types';
import { useTheme } from '@/hooks/use-theme';

export function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Search exercises"
      placeholderTextColor={t.textMuted}
      clearButtonMode="while-editing"
      autoCorrect={false}
      style={[styles.search, { backgroundColor: t.surfaceAlt, color: t.text }]}
    />
  );
}

/** Exercises grouped by muscle group, filtered by a search text. */
export function ExerciseList({
  exercises,
  search,
  onSelect,
  disabledIds = [],
}: {
  exercises: ExerciseListItem[];
  search: string;
  onSelect: (exercise: ExerciseListItem) => void;
  disabledIds?: number[];
}) {
  const t = useTheme();
  const q = search.trim().toLowerCase();
  const visible = exercises.filter((e) => !q || e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q));

  if (visible.length === 0) {
    return (
      <Txt tone="muted" style={{ textAlign: 'center', paddingVertical: Spacing.xl }}>
        No exercise matches “{search}”.
      </Txt>
    );
  }

  return (
    <View style={{ gap: Spacing.lg }}>
      {MUSCLE_GROUPS.map((group) => {
        const items = visible.filter((e) => e.muscleGroup === group);
        if (items.length === 0) return null;
        return (
          <View key={group} style={{ gap: Spacing.xs }}>
            <Txt variant="label" tone="muted">
              {group}
            </Txt>
            <View style={[styles.group, { backgroundColor: t.surface, borderColor: t.border }]}>
              {items.map((e, i) => {
                const disabled = disabledIds.includes(e.id);
                return (
                  <Pressable
                    key={e.id}
                    disabled={disabled}
                    onPress={() => onSelect(e)}
                    style={({ pressed }) => [
                      styles.item,
                      i > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth },
                      pressed && { backgroundColor: t.surfaceAlt },
                      disabled && { opacity: 0.4 },
                    ]}>
                    <View style={{ flex: 1 }}>
                      <Txt style={{ fontWeight: '600' }}>{e.name}</Txt>
                      <Txt variant="small" tone="muted">
                        {e.sessions === 0
                          ? 'Not done yet'
                          : `${e.sessions} workout${e.sessions === 1 ? '' : 's'} · last ${formatShortDate(e.lastDone!)}`}
                        {e.isCustom ? ' · custom' : ''}
                      </Txt>
                    </View>
                    <Txt tone="muted">{disabled ? 'Added' : '›'}</Txt>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 16 },
  group: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
});
