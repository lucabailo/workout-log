import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useState } from 'react';

import { useTheme } from '@/hooks/use-theme';

/** Trained days of the last weeks: one column per week, Monday at the top. */
export function ActivityGrid({ weeks }: { weeks: boolean[][] }) {
  const t = useTheme();
  const trained = weeks.flat().filter(Boolean).length;
  return (
    <View style={styles.grid} accessibilityLabel={`${trained} training days in the last ${weeks.length} weeks`}>
      {weeks.map((days, w) => (
        <View key={w} style={styles.week}>
          {days.map((on, d) => (
            <View key={d} style={[styles.day, { backgroundColor: on ? t.accent : t.surfaceAlt }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** A tiny trend line without axes, newest value on the right. */
export function Sparkline({ values, height = 40 }: { values: number[]; height?: number }) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => 4 + ((width - 8) * i) / (values.length - 1);
  const y = (v: number) => 4 + (height - 8) * (1 - (v - min) / span);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Path d={d} stroke={t.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={x(last)} cy={y(values[last])} r={4} fill={t.accent} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 4 },
  week: { flex: 1, gap: 4 },
  day: { height: 10, borderRadius: 2 },
});
