import { StyleSheet, View } from 'react-native';

import { Field, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { MeasurementInput } from '@/db/repository';
import { formatKg, parseNumber } from '@/domain/format';
import type { BodyMeasurement } from '@/domain/types';

/** What the user typed, kept as text so half-typed numbers ("78,") are not lost. */
export interface BodyValues {
  weight: string;
  bodyFat: string;
  muscle: string;
  water: string;
  visceral: string;
}

export const EMPTY_BODY: BodyValues = { weight: '', bodyFat: '', muscle: '', water: '', visceral: '' };

const text = (n: number | null) => (n === null ? '' : formatKg(n).replace(',', ''));

export function bodyValuesFrom(m: BodyMeasurement): BodyValues {
  return { weight: text(m.weightKg), bodyFat: text(m.bodyFatPct), muscle: text(m.muscleKg), water: text(m.waterPct), visceral: text(m.visceralFat) };
}

const optional = (s: string) => (s.trim() ? parseNumber(s) || null : null);

/** The measurement to save, or null when no body weight was entered. */
export function toMeasurement(v: BodyValues, measuredAt: string): MeasurementInput | null {
  const weightKg = parseNumber(v.weight);
  if (!(weightKg > 0)) return null;
  return {
    measuredAt,
    weightKg,
    bodyFatPct: optional(v.bodyFat),
    muscleKg: optional(v.muscle),
    waterPct: optional(v.water),
    visceralFat: optional(v.visceral),
  };
}

/** The optional values a smart scale measures, two per row. */
export function SmartScaleFields({ values, onChange }: { values: BodyValues; onChange: (v: BodyValues) => void }) {
  const set = (key: keyof BodyValues) => (s: string) => onChange({ ...values, [key]: s });
  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.header}>
        <Txt variant="heading" style={{ fontSize: 17 }}>
          From a smart scale
        </Txt>
        <Txt variant="small" tone="muted">
          Optional
        </Txt>
      </View>
      <Txt variant="small" tone="muted">
        Fill in only what your scale measures.
      </Txt>
      <View style={styles.row}>
        <Field label="Body fat" unit="%" value={values.bodyFat} onChangeText={set('bodyFat')} keyboardType="decimal-pad" placeholder="—" />
        <Field label="Muscle mass" unit="kg" value={values.muscle} onChangeText={set('muscle')} keyboardType="decimal-pad" placeholder="—" />
      </View>
      <View style={styles.row}>
        <Field label="Body water" unit="%" value={values.water} onChangeText={set('water')} keyboardType="decimal-pad" placeholder="—" />
        <Field label="Visceral fat" unit="level" value={values.visceral} onChangeText={set('visceral')} keyboardType="decimal-pad" placeholder="—" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  row: { flexDirection: 'row', gap: Spacing.md },
});
