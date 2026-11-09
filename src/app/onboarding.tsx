import { router, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EMPTY_BODY, SmartScaleFields, toMeasurement } from '@/components/body-form';
import { Button, DateField, Field, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { saveMeasurement, saveSettings } from '@/db/repository';
import { parseDate, parseNumber, todayIso } from '@/domain/format';
import { useTheme } from '@/hooks/use-theme';

/** Shown once on first launch: the body data the app starts from. Everything is optional. */
export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [body, setBody] = useState(EMPTY_BODY);
  const [height, setHeight] = useState('');
  const [birth, setBirth] = useState('');
  const birthDate = birth.trim() ? parseDate(birth) : null;
  const birthInvalid = birth !== '' && birthDate === null;

  async function finish(save: boolean) {
    if (save) {
      const m = toMeasurement(body, todayIso());
      if (m) await saveMeasurement(db, m);
      await saveSettings(db, { heightCm: parseNumber(height) || null, birthDate });
    }
    await saveSettings(db, { onboarded: true });
    router.replace('/workouts');
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <Screen style={{ paddingTop: 64 }}>
        <View style={styles.top}>
          <Txt tone="muted" variant="small">
            Almost done
          </Txt>
          <Pressable onPress={() => finish(false)} hitSlop={12} accessibilityRole="button">
            <Txt tone="accent" style={{ fontWeight: '700' }}>
              Skip
            </Txt>
          </Pressable>
        </View>
        <View style={{ gap: Spacing.xs }}>
          <Txt variant="title">About you</Txt>
          <Txt tone="muted">Your starting point. Used for bodyweight exercises and to track how your body changes.</Txt>
        </View>
        <View style={styles.row}>
          <Field label="Body weight" unit="kg" value={body.weight} onChangeText={(weight) => setBody({ ...body, weight })} keyboardType="decimal-pad" placeholder="78" />
          <Field label="Height" unit="cm" value={height} onChangeText={setHeight} keyboardType="number-pad" placeholder="182" />
        </View>
        <DateField label="Date of birth" value={birth} onChangeText={setBirth} />
        {birthInvalid && (
          <Txt tone={birth.length < 10 ? 'muted' : 'danger'} variant="small">
            {birth.length < 10 ? 'Day, month and year, e.g. 14/03/1999' : 'That date doesn\'t look right.'}
          </Txt>
        )}
        <View style={[styles.divider, { backgroundColor: t.border }]} />
        <SmartScaleFields values={body} onChange={setBody} />
        <Button title="Start logging" onPress={() => finish(true)} disabled={birthInvalid} />
        <Txt variant="small" tone="muted" style={{ textAlign: 'center' }}>
          You can change this anytime in your profile.
        </Txt>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', gap: Spacing.md },
  divider: { height: StyleSheet.hairlineWidth },
});
