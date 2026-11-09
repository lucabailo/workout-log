import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { bodyValuesFrom, EMPTY_BODY, SmartScaleFields, toMeasurement } from '@/components/body-form';
import { Button, DateField, Field, Loading, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteMeasurement, getMeasurement, saveMeasurement } from '@/db/repository';
import { formatDate, parseDate, todayIso } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';

/** P3: add a body measurement, or edit one (with `id`). Only the weight is required. */
export default function LogMeasurementScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ? Number(params.id) : undefined;
  const [loaded, setLoaded] = useState(id === undefined);
  const [values, setValues] = useState(EMPTY_BODY);
  const [date, setDate] = useState(formatDate(todayIso()));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id === undefined) return;
    let cancelled = false;
    getMeasurement(db, id).then((m) => {
      if (cancelled) return;
      if (m) {
        setValues(bodyValuesFrom(m));
        setDate(formatDate(m.measuredAt));
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  if (!loaded) return <Loading />;

  async function save() {
    const day = parseDate(date);
    if (!day) return setError('Enter the date as DD/MM/YYYY (not in the future).');
    const m = toMeasurement(values, day);
    if (!m) return setError('Enter your body weight.');
    await saveMeasurement(db, m, id);
    router.back();
  }

  async function remove() {
    if (id !== undefined && (await confirm('Delete measurement?', '', 'Delete', true))) {
      await deleteMeasurement(db, id);
      router.back();
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: id === undefined ? 'Log measurement' : 'Edit measurement',
          headerRight: () => <Button title="Save" variant="ghost" size="sm" onPress={save} />,
        }}
      />
      <Screen>
        <View style={styles.row}>
          <DateField label="Date" value={date} onChangeText={setDate} />
          <Field
            label="Body weight"
            unit="kg"
            value={values.weight}
            onChangeText={(weight) => {
              setValues({ ...values, weight });
              setError(null);
            }}
            keyboardType="decimal-pad"
            placeholder="78.4"
            autoFocus={id === undefined}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: t.border }]} />
        <SmartScaleFields values={values} onChange={setValues} />
        {error && <Txt tone="danger">{error}</Txt>}
        <Button title="Save" onPress={save} />
        {id !== undefined && <Button title="Delete measurement" variant="danger" onPress={remove} />}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.md },
  divider: { height: StyleSheet.hairlineWidth },
});
