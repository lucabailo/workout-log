import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActivityGrid, Sparkline } from '@/components/activity';
import { Button, Card, ListRow, Loading, Screen, SectionLabel, Stat, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import {
  allSessionsByExercise,
  allTimeTotals,
  finishedWorkoutDates,
  getSettings,
  listMeasurements,
} from '@/db/repository';
import { formatHours, formatKg, formatTonnes } from '@/domain/format';
import { activityGrid, recordCount, weeklyStreak, workoutsThisWeek } from '@/domain/stats';
import type { BodyMeasurement } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';

/** P1: body card, all-time stats, activity, and links to the library and settings. */
export default function ProfileScreen() {
  const { data } = useDbQuery(async (db) => ({
    body: await listMeasurements(db),
    totals: await allTimeTotals(db),
    dates: await finishedWorkoutDates(db),
    records: recordCount((await allSessionsByExercise(db)).values()),
    settings: await getSettings(db),
  }));

  if (!data) return <Loading />;
  const { body, totals, dates, records, settings } = data;
  const streak = weeklyStreak(dates, settings.weeklyGoal);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button title="Settings" variant="ghost" size="sm" onPress={() => router.push('/profile/settings')} />
          ),
        }}
      />
      <BodyCard measurements={body} heightCm={settings.heightCm} />

      <SectionLabel>Your training · all time</SectionLabel>
      <View style={styles.stats}>
        <Stat value={String(totals.workouts)} label="Workouts" />
        <Stat value={formatHours(totals.seconds)} label="Time trained" />
        <Stat value={formatTonnes(totals.volumeKg)} label="Lifted" />
      </View>
      <View style={styles.stats}>
        <Stat value={`${workoutsThisWeek(dates)} / ${settings.weeklyGoal}`} label="This week" />
        <Stat value={`${streak} wk${streak === 1 ? '' : 's'}`} label="Streak" />
        <Stat value={String(records)} label="Records" />
      </View>

      <Pressable
        onPress={() => router.push('/profile/activity')}
        accessibilityRole="button"
        accessibilityHint="Opens the activity calendar"
        style={({ pressed }) => pressed && { opacity: 0.7 }}>
        <Card>
          <SectionLabel
            right={
              <Txt variant="small" tone="accent" style={{ fontWeight: '700' }}>
                Calendar ›
              </Txt>
            }>
            Activity · last 12 weeks{streak > 0 ? ` · 🔥 ${streak} wk` : ''}
          </SectionLabel>
          <ActivityGrid weeks={activityGrid(dates, 12)} />
        </Card>
      </Pressable>

      <Card style={{ paddingVertical: 4 }}>
        <ListRow
          first
          title="Exercises"
          detail="Library, records and progress per exercise"
          onPress={() => router.push('/profile/exercises')}
        />
        <ListRow
          title="Settings"
          detail="Rest timer, weekly goal, body data"
          onPress={() => router.push('/profile/settings')}
        />
      </Card>
    </Screen>
  );
}

function BodyCard({ measurements, heightCm }: { measurements: BodyMeasurement[]; heightCm: number | null }) {
  const clock = useNow(60_000);
  const latest = measurements[0];
  const log = () => router.push('/log-measurement');
  const header = (
    <SectionLabel
      right={
        <Pressable onPress={log} hitSlop={10} accessibilityRole="button">
          <Txt tone="accent" style={{ fontWeight: '700' }}>
            + Log
          </Txt>
        </Pressable>
      }>
      Body
    </SectionLabel>
  );

  if (!latest) {
    return (
      <Card>
        {header}
        <Txt tone="muted">Log your body weight to follow how it changes. Smart-scale values are optional.</Txt>
      </Card>
    );
  }

  const monthAgo = clock - 30 * 86400000;
  const older = measurements.find((m) => Date.parse(m.measuredAt) <= monthAgo) ?? measurements[measurements.length - 1];
  const change = latest.weightKg - older.weightKg;
  const recent = measurements
    .slice(0, 10)
    .reverse()
    .map((m) => m.weightKg);
  const composition = [
    heightCm ? `${heightCm} cm` : null,
    latest.bodyFatPct !== null ? `Body fat ${formatKg(latest.bodyFatPct)} %` : null,
    latest.muscleKg !== null ? `Muscle ${formatKg(latest.muscleKg)} kg` : null,
  ].filter(Boolean);

  return (
    <Pressable onPress={() => router.push('/profile/body')} style={({ pressed }) => pressed && { opacity: 0.8 }}>
      <Card>
        {header}
        <View style={styles.weight}>
          <Txt variant="title">{formatKg(latest.weightKg)} kg</Txt>
          {older !== latest && (
            <Txt variant="small" tone="muted">
              {change > 0 ? '+' : change < 0 ? '−' : '±'}
              {formatKg(Math.abs(change))} kg{' '}
              {Date.parse(older.measuredAt) <= monthAgo ? 'in 30 days' : 'since first entry'}
            </Txt>
          )}
        </View>
        <Sparkline values={recent} />
        {composition.length > 0 && (
          <Txt variant="small" tone="muted">
            {composition.join('  ·  ')}
          </Txt>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: Spacing.sm },
  weight: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, flexWrap: 'wrap' },
});
