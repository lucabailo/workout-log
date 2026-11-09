import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { formatClock } from '@/domain/format';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';

/**
 * Countdown shown after a set is ticked off. It stores the end time rather than counting
 * ticks, so it stays correct if the app is briefly in the background.
 */
export function RestTimer({
  endsAt,
  onChange,
  vibrate = true,
}: {
  endsAt: number;
  onChange: (endsAt: number | null) => void;
  vibrate?: boolean;
}) {
  const t = useTheme();
  const now = useNow(250);
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

  useEffect(() => {
    if (remaining === 0) {
      if (vibrate && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChange(null);
    }
  }, [remaining, onChange, vibrate]);

  return (
    <View style={[styles.bar, { backgroundColor: t.accent }]} accessibilityLiveRegion="polite">
      <View style={{ flex: 1 }}>
        <Txt variant="label" style={{ color: t.accentText, opacity: 0.8 }}>
          Rest
        </Txt>
        <Txt variant="number" style={{ color: t.accentText }}>
          {formatClock(remaining)}
        </Txt>
      </View>
      <TimerButton label="−15" hint="15 seconds less" onPress={() => onChange(endsAt - 15000)} />
      <TimerButton label="+15" hint="15 seconds more" onPress={() => onChange(endsAt + 15000)} />
      <TimerButton label="Skip" hint="Skip rest" strong onPress={() => onChange(null)} />
    </View>
  );
}

function TimerButton({ label, hint, onPress, strong }: { label: string; hint: string; onPress: () => void; strong?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint}
      style={({ pressed }) => [
        styles.timerButton,
        { backgroundColor: strong ? t.accentText : 'rgba(255,255,255,0.2)', opacity: pressed ? 0.7 : 1 },
      ]}>
      <Text style={{ color: strong ? t.accent : t.accentText, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  timerButton: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  bar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.xl,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    paddingLeft: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
