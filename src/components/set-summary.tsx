import { StyleSheet, View } from 'react-native';

import { Badge, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatKg } from '@/domain/format';
import type { WorkoutSet } from '@/domain/types';

/** Read-only list of sets ("1  60 kg × 8"), marking personal records. */
export function SetSummary({
  sets,
  recordIndexes = [],
}: {
  sets: Pick<WorkoutSet, 'reps' | 'weightKg'>[];
  recordIndexes?: number[];
}) {
  return (
    <View style={{ gap: Spacing.xs }}>
      {sets.map((s, i) => (
        <View key={i} style={styles.row}>
          <Txt tone="muted" style={styles.index}>
            {i + 1}
          </Txt>
          <Txt style={{ fontVariant: ['tabular-nums'] }}>
            {formatKg(s.weightKg)} kg × {s.reps}
          </Txt>
          {recordIndexes.includes(i) && <Badge label="PR" />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  index: { width: 18 },
});
