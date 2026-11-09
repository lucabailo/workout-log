import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { Txt } from '@/components/ui';
import { formatKg, formatShortDate } from '@/domain/format';
import type { ProgressPoint } from '@/domain/stats';
import { useTheme } from '@/hooks/use-theme';

const HEIGHT = 180;
const PAD = { top: 16, right: 12, bottom: 24, left: 40 };

/** A small dependency-free line chart (1RM trend of an exercise, body weight over time…). */
export function LineChart({
  points,
  unit = 'kg',
  emptyText = 'Log this exercise in at least two workouts to see a trend.',
}: {
  points: ProgressPoint[];
  unit?: string;
  emptyText?: string;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (points.length < 2) {
    return (
      <View style={styles.placeholder}>
        <Txt tone="muted" variant="small">
          {emptyText}
        </Txt>
      </View>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;
  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (innerW * i) / (points.length - 1);
  const y = (v: number) => PAD.top + innerH * (1 - (v - lo) / (hi - lo));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15];

  return (
    <View onLayout={onLayout} accessibilityLabel={`Trend from ${formatKg(points[0].value)} to ${formatKg(points[points.length - 1].value)} ${unit}`}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {ticks.map((v) => (
            <Line key={v} x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={t.border} strokeWidth={1} />
          ))}
          {ticks.map((v) => (
            <SvgText key={`l${v}`} x={PAD.left - 6} y={y(v) + 4} fontSize={11} fill={t.textMuted} textAnchor="end">
              {formatKg(v)}
            </SvgText>
          ))}
          <Path d={path} stroke={t.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <Circle key={p.date + i} cx={x(i)} cy={y(p.value)} r={3.5} fill={t.surface} stroke={t.accent} strokeWidth={2} />
          ))}
          <SvgText x={PAD.left} y={HEIGHT - 6} fontSize={11} fill={t.textMuted}>
            {formatShortDate(points[0].date)}
          </SvgText>
          <SvgText x={width - PAD.right} y={HEIGHT - 6} fontSize={11} fill={t.textMuted} textAnchor="end">
            {formatShortDate(points[points.length - 1].date)}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { height: 80, alignItems: 'center', justifyContent: 'center' },
});
