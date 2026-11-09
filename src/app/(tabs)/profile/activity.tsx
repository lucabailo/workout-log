import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, ListRow, Loading, Screen, SectionLabel, Stat, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getSettings, listWorkoutSummaries } from '@/db/repository';
import { formatDuration, formatKg } from '@/domain/format';
import { dayKey, monthGrid, weeklyStreak, workoutsThisWeek } from '@/domain/stats';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** P4: month calendar of training days. Tap a day to see what was done. */
export default function ActivityScreen() {
  const t = useTheme();
  const now = useNow(60_000);
  const today = new Date(now);
  const [month, setMonth] = useState(() => ({ year: today.getFullYear(), month: today.getMonth() }));
  const [selected, setSelected] = useState(() => dayKey(today));

  const { data } = useDbQuery(async (db) => ({
    workouts: await listWorkoutSummaries(db),
    settings: await getSettings(db),
  }));
  if (!data) return <Loading />;
  const { workouts, settings } = data;

  const byDay = new Map<string, typeof workouts>();
  for (const w of workouts) {
    const k = dayKey(w.startedAt);
    byDay.set(k, [...(byDay.get(k) ?? []), w]);
  }
  const dates = workouts.map((w) => w.startedAt);
  const streak = weeklyStreak(dates, settings.weeklyGoal, today);
  const inMonth = workouts.filter((w) => {
    const d = new Date(w.startedAt);
    return d.getFullYear() === month.year && d.getMonth() === month.month;
  }).length;
  const isCurrentMonth = month.year === today.getFullYear() && month.month === today.getMonth();
  const title = new Date(month.year, month.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const todayKey = dayKey(today);
  const dayWorkouts = byDay.get(selected) ?? [];

  const shift = (by: -1 | 1) =>
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + by, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <Screen>
      <View style={styles.stats}>
        <Stat value={`${streak} wk${streak === 1 ? '' : 's'}`} label="Streak" />
        <Stat value={String(inMonth)} label={isCurrentMonth ? 'This month' : 'In month'} />
        <Stat value={`${workoutsThisWeek(dates, today)} / ${settings.weeklyGoal}`} label="This week" />
      </View>

      <Card>
        <View style={styles.monthHeader}>
          <Button title="‹" variant="ghost" size="sm" onPress={() => shift(-1)} />
          <Txt variant="heading" style={{ flex: 1, textAlign: 'center' }}>
            {title}
          </Txt>
          <Button title="›" variant="ghost" size="sm" onPress={() => shift(1)} disabled={isCurrentMonth} />
        </View>
        <View style={styles.week}>
          {WEEKDAYS.map((d, i) => (
            <Txt key={i} variant="small" tone="muted" style={styles.weekday}>
              {d}
            </Txt>
          ))}
        </View>
        {monthGrid(month.year, month.month).map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />;
              const k = dayKey(day);
              const trained = byDay.has(k);
              const isSelected = k === selected;
              const isToday = k === todayKey;
              return (
                <Pressable
                  key={i}
                  onPress={() => setSelected(k)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}${
                    trained ? ', trained' : ''
                  }`}
                  style={styles.cell}>
                  <View
                    style={[
                      styles.dayDot,
                      trained && { backgroundColor: t.accent },
                      isToday && { borderWidth: 2, borderColor: trained ? t.text : t.accent },
                      isSelected && !trained && { backgroundColor: t.surfaceAlt },
                      isSelected && trained && { opacity: 0.8 },
                    ]}>
                    <Txt
                      style={{
                        color: trained ? t.accentText : t.text,
                        fontWeight: trained || isSelected ? '700' : '400',
                        fontVariant: ['tabular-nums'],
                      }}>
                      {day.getDate()}
                    </Txt>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      <SectionLabel>
        {new Date(`${selected}T12:00:00`).toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
      </SectionLabel>
      {dayWorkouts.length === 0 ? (
        <Txt tone="muted" style={{ textAlign: 'center' }}>
          {selected === todayKey ? 'No workout yet today.' : 'Rest day.'}
        </Txt>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {dayWorkouts.map((w, i) => (
            <ListRow
              key={w.id}
              first={i === 0}
              title={w.routineName ?? 'Workout'}
              detail={`${formatDuration(w.startedAt, w.finishedAt)} · ${w.setCount} sets · ${formatKg(w.volumeKg)} kg`}
              onPress={() => router.push(`/workouts/${w.id}`)}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: Spacing.sm },
  monthHeader: { flexDirection: 'row', alignItems: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontWeight: '700' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  dayDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
