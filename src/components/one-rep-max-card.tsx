import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Field, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { setOneRepMax } from '@/db/repository';
import { formatKg, parseNumber } from '@/domain/format';

/**
 * The one-rep max used by progressions in % (e.g. 4 × 9 @ 75%). Estimated from the history
 * unless the user types their own, e.g. after a progression cycle or a test day.
 */
export function OneRepMaxCard({
  exerciseId,
  typed,
  estimated,
  onSaved,
}: {
  exerciseId: number;
  typed: number | null;
  estimated: number;
  onSaved: () => void;
}) {
  const db = useSQLiteContext();
  const [text, setText] = useState(typed ? formatKg(typed).replace(',', '') : '');
  const value = parseNumber(text);
  const changed = text.trim() ? value !== typed : typed !== null;

  async function save() {
    await setOneRepMax(db, exerciseId, text.trim() ? value : null);
    onSaved();
  }

  return (
    <Card>
      <Txt variant="heading">1RM for % loads</Txt>
      <Txt variant="small" tone="muted">
        {typed
          ? `You set ${formatKg(typed)} kg. Clear it to go back to the estimate${estimated > 0 ? ` (${formatKg(estimated)} kg)` : ''}.`
          : estimated > 0
            ? `Using the estimate from your best set: ${formatKg(estimated)} kg. Type your own if you know it.`
            : 'Not known yet. Type it, or it will be estimated from your sets.'}
      </Txt>
      <View style={styles.row}>
        <Field
          label="One-rep max"
          unit="kg"
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          placeholder={estimated > 0 ? formatKg(estimated) : '—'}
        />
        <Button title="Save" size="sm" onPress={save} disabled={!changed || (text.trim() !== '' && !(value > 0))} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
});
