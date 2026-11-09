import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { activeWorkoutStatus } from '@/db/repository';
import { formatClock } from '@/domain/format';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

/**
 * Mini bar shown above the tab bar on every tab while a workout is open:
 * routine name, live timer and the next set to do. Tap to go back to the workout.
 */
export function ActiveBar({ style }: { style?: StyleProp<ViewStyle> }) {
  const { data } = useDbQuery(activeWorkoutStatus);
  if (!data) return null;
  return <Bar status={data} style={style} />;
}

function Bar({
  status,
  style,
}: {
  status: NonNullable<Awaited<ReturnType<typeof activeWorkoutStatus>>>;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const now = useNow();
  const elapsed = formatClock((now - Date.parse(status.startedAt)) / 1000);
  const detail = status.next
    ? `${status.next.exercise} · set ${status.next.setIndex} of ${status.next.setCount}`
    : status.totalSets > 0
      ? 'All sets done · tap to finish'
      : 'Add your first exercise';

  return (
    <Pressable
      onPress={() => router.push('/active')}
      accessibilityRole="button"
      accessibilityLabel={`Workout in progress, ${elapsed}. ${detail}. Resume`}
      style={({ pressed }) => [styles.bar, { backgroundColor: t.accent, opacity: pressed ? 0.85 : 1 }, style]}>
      <View style={[styles.dot, { backgroundColor: t.accentText }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: t.accentText }]} numberOfLines={1}>
          {status.routineName ?? 'Workout'} · {elapsed}
        </Text>
        <Text style={[styles.detail, { color: t.accentText }]} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Text style={[styles.resume, { color: t.accentText }]}>Resume ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4, opacity: 0.85 },
  title: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  detail: { fontSize: 12, opacity: 0.85 },
  resume: { fontSize: 14, fontWeight: '700' },
});
