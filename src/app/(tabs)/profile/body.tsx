import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/line-chart';
import { Button, Card, EmptyState, ListRow, Loading, Screen, Segmented, SectionLabel, Stat, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { listMeasurements } from '@/db/repository';
import { formatDay, formatKg } from '@/domain/format';
import type { BodyMeasurement } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';

const METRICS = {
  Weight: { get: (m: BodyMeasurement) => m.weightKg, unit: 'kg', title: 'Body weight' },
  'Body fat': { get: (m: BodyMeasurement) => m.bodyFatPct, unit: '%', title: 'Body fat' },
  Muscle: { get: (m: BodyMeasurement) => m.muscleKg, unit: 'kg', title: 'Muscle mass' },
  Water: { get: (m: BodyMeasurement) => m.waterPct, unit: '%', title: 'Body water' },
} as const;
type Metric = keyof typeof METRICS;

/** P2: body measurements over time, one metric at a time. */
export default function BodyScreen() {
  const [metric, setMetric] = useState<Metric>('Weight');
  const { data } = useDbQuery(listMeasurements);
  const clock = useNow(60_000);

  if (!data) return <Loading />;
  const header = (
    <Stack.Screen
      options={{ headerRight: () => <Button title="+ Log" variant="ghost" size="sm" onPress={() => router.push('/log-measurement')} /> }}
    />
  );
  if (data.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          title="No measurements yet"
          message="Log your weight now and then to see the trend."
          action={<Button title="Log measurement" onPress={() => router.push('/log-measurement')} />}
        />
      </Screen>
    );
  }

  const m = METRICS[metric];
  const points = data
    .filter((x) => m.get(x) !== null)
    .map((x) => ({ date: x.measuredAt, value: m.get(x)! }))
    .reverse();
  const now = points[points.length - 1]?.value;
  const first = points[0]?.value;
  const monthAgo = clock - 30 * 86400000;
  const base30 = [...points].reverse().find((p) => Date.parse(p.date) <= monthAgo)?.value ?? first;
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatKg(Math.abs(v))}`;

  return (
    <Screen>
      {header}
      <Segmented options={Object.keys(METRICS) as Metric[]} value={metric} onChange={setMetric} />
      <Card>
        <Txt variant="heading">{m.title}</Txt>
        <LineChart points={points} unit={m.unit} emptyText={`Log ${m.title.toLowerCase()} at least twice to see a trend.`} />
      </Card>
      {now !== undefined && (
        <View style={styles.stats}>
          <Stat value={formatKg(now)} label={`Now (${m.unit})`} />
          <Stat value={signed(now - base30)} label="30 days" />
          <Stat value={signed(now - first)} label="Since start" />
        </View>
      )}
      <SectionLabel>Measurements</SectionLabel>
      <Card style={{ paddingVertical: 4 }}>
        {data.map((x, i) => (
          <ListRow
            key={x.id}
            first={i === 0}
            title={formatDay(x.measuredAt)}
            detail={describe(x)}
            value={`${formatKg(x.weightKg)} kg`}
            onPress={() => router.push({ pathname: '/log-measurement', params: { id: x.id } })}
          />
        ))}
      </Card>
    </Screen>
  );
}

function describe(m: BodyMeasurement): string {
  const parts = [
    m.bodyFatPct !== null ? `Body fat ${formatKg(m.bodyFatPct)} %` : null,
    m.muscleKg !== null ? `Muscle ${formatKg(m.muscleKg)} kg` : null,
    m.waterPct !== null ? `Water ${formatKg(m.waterPct)} %` : null,
    m.visceralFat !== null ? `Visceral ${formatKg(m.visceralFat)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Weight only';
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: Spacing.sm },
});
