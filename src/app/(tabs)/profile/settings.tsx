import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Alert, Platform, Switch, StyleSheet, View } from 'react-native';

import { Card, DateField, Field, Loading, Screen, Segmented, SectionLabel, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getSettings, saveSettings } from '@/db/repository';
import { formatDate, formatRest, parseDate, parseNumber } from '@/domain/format';
import type { Settings } from '@/domain/types';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { ensureNotificationPermission } from '@/lib/notifications';
import { refreshReminders } from '@/lib/reminders';

const RESTS = [60, 90, 120, 180] as const;
const GOALS = [2, 3, 4, 5, 6] as const;
const WEIGH_IN_HOURS = [7, 8, 9, 20, 21] as const;

/** S1: training defaults and body data. Every change is saved immediately. */
export default function SettingsScreen() {
  const { data } = useDbQuery(getSettings);
  if (!data) return <Loading />;
  // Remount the form when the stored values change, so fields show them.
  return <SettingsForm key={JSON.stringify(data)} initial={data} />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const db = useSQLiteContext();
  const t = useTheme();
  const [s, setS] = useState(initial);
  const [height, setHeight] = useState(initial.heightCm ? String(initial.heightCm) : '');
  const [birth, setBirth] = useState(initial.birthDate ? formatDate(initial.birthDate) : '');
  const birthInvalid = birth.trim() !== '' && parseDate(birth) === null;

  const update = (changes: Partial<Settings>) => {
    setS({ ...s, ...changes });
    // Reminders depend on several settings (the weekly goal too), so re-plan them after any change.
    saveSettings(db, changes).then(() => refreshReminders(db));
  };

  /** Turning a reminder on asks for notification permission first. */
  async function allow(on: boolean) {
    if (on && !(await ensureNotificationPermission()) && Platform.OS !== 'web') {
      Alert.alert('Notifications are off', 'Allow notifications for Workout Log in the phone settings.');
    }
  }

  return (
    <Screen>
      <SectionLabel>Training</SectionLabel>
      <Card>
        <Txt style={{ fontWeight: '600' }}>Default rest time</Txt>
        <Txt variant="small" tone="muted">
          Used for empty workouts and new exercises in a routine.
        </Txt>
        <Segmented
          options={RESTS}
          value={s.defaultRestSeconds as (typeof RESTS)[number]}
          onChange={(v) => update({ defaultRestSeconds: v })}
          format={formatRest}
        />
        <View style={[styles.divider, { backgroundColor: t.border }]} />
        <Txt style={{ fontWeight: '600' }}>Weekly goal</Txt>
        <Txt variant="small" tone="muted">
          Workouts per week. Used for &quot;This week&quot; and the streak.
        </Txt>
        <Segmented
          options={GOALS}
          value={s.weeklyGoal as (typeof GOALS)[number]}
          onChange={(v) => update({ weeklyGoal: v })}
        />
        <View style={[styles.divider, { backgroundColor: t.border }]} />
        <View style={styles.switchRow}>
          <Txt style={{ fontWeight: '600', flex: 1 }}>Vibrate when rest ends</Txt>
          <Switch
            value={s.vibrateOnRestEnd}
            onValueChange={(v) => update({ vibrateOnRestEnd: v })}
            trackColor={{ true: t.accent, false: t.surfaceAlt }}
          />
        </View>
        <View style={[styles.divider, { backgroundColor: t.border }]} />
        <View style={styles.switchRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontWeight: '600' }}>Notify when rest ends</Txt>
            <Txt variant="small" tone="muted">
              When the phone is locked or you are in another app.
            </Txt>
          </View>
          <Switch
            value={s.notifyOnRestEnd}
            onValueChange={async (v) => {
              await allow(v);
              update({ notifyOnRestEnd: v });
            }}
            trackColor={{ true: t.accent, false: t.surfaceAlt }}
          />
        </View>
      </Card>

      <SectionLabel>Reminders</SectionLabel>
      <Card>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt style={{ fontWeight: '600' }}>Weekly weigh-in</Txt>
            <Txt variant="small" tone="muted">
              A notification a week after your last weigh-in.
            </Txt>
          </View>
          <Switch
            value={s.weighInReminder}
            onValueChange={async (v) => {
              await allow(v);
              update({ weighInReminder: v });
            }}
            trackColor={{ true: t.accent, false: t.surfaceAlt }}
            accessibilityLabel="Weekly weigh-in reminder"
          />
        </View>
        {s.weighInReminder && (
          <Segmented
            options={WEIGH_IN_HOURS}
            value={
              (WEIGH_IN_HOURS as readonly number[]).includes(s.weighInHour)
                ? (s.weighInHour as (typeof WEIGH_IN_HOURS)[number])
                : 8
            }
            onChange={(v) => update({ weighInHour: v })}
            format={(h) => `${h}:00`}
          />
        )}
        <ReminderRow
          title="Workout left open"
          detail="If a workout is still open 2 hours after you started it."
          value={s.forgottenWorkoutReminder}
          onChange={async (v) => {
            await allow(v);
            update({ forgottenWorkoutReminder: v });
          }}
        />
        <ReminderRow
          title="Weekly goal"
          detail="Sunday at 17:00, if you haven’t reached your weekly goal yet."
          value={s.weeklyGoalReminder}
          onChange={async (v) => {
            await allow(v);
            update({ weeklyGoalReminder: v });
          }}
        />
        <ReminderRow
          title="Days without training"
          detail="After 4 days without a workout, with the next routine of your program."
          value={s.inactivityReminder}
          onChange={async (v) => {
            await allow(v);
            update({ inactivityReminder: v });
          }}
        />
        <ReminderRow
          title="Progression complete"
          detail="When a ★ progression in % finishes all its steps: time to update your 1RM."
          value={s.cycleReminder}
          onChange={async (v) => {
            await allow(v);
            update({ cycleReminder: v });
          }}
        />
      </Card>

      <SectionLabel>Body</SectionLabel>
      <Card>
        <View style={styles.row}>
          <Field
            label="Height"
            unit="cm"
            value={height}
            onChangeText={setHeight}
            onEndEditing={() => update({ heightCm: parseNumber(height) || null })}
            keyboardType="number-pad"
            placeholder="—"
          />
          <DateField
            label="Date of birth"
            value={birth}
            onChangeText={setBirth}
            onEndEditing={() => !birthInvalid && update({ birthDate: parseDate(birth) })}
          />
        </View>
        {birthInvalid && (
          <Txt tone="danger" variant="small">
            Use DD/MM/YYYY.
          </Txt>
        )}
      </Card>

      <Txt variant="small" tone="muted" style={{ textAlign: 'center' }}>
        Workout Log 1.1 · all data stays on this phone
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', gap: Spacing.md },
});

/** One reminder: title, when it fires, and its switch. */
function ReminderRow({
  title,
  detail,
  value,
  onChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <>
      <View style={[styles.divider, { backgroundColor: t.border }]} />
      <View style={styles.switchRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt style={{ fontWeight: '600' }}>{title}</Txt>
          <Txt variant="small" tone="muted">
            {detail}
          </Txt>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ true: t.accent, false: t.surfaceAlt }}
          accessibilityLabel={`${title} reminder`}
        />
      </View>
    </>
  );
}
