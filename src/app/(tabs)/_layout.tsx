import { NativeTabs } from 'expo-router/native-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveBar } from '@/components/active-bar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Height of the system tab bar, without the bottom safe area. */
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 49 : 80;

export default function TabLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <NativeTabs backgroundColor={t.surface} indicatorColor={t.surfaceAlt} tintColor={t.accent}>
        <NativeTabs.Trigger name="routines">
          <NativeTabs.Trigger.Label>Routines</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="list.bullet.clipboard" md="list_alt" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="workouts">
          <NativeTabs.Trigger.Label>Workouts</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="dumbbell" md="fitness_center" />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="person" md="person" />
        </NativeTabs.Trigger>
      </NativeTabs>
      {/* Floats above the tab bar on every tab while a workout is open. */}
      <ActiveBar style={[styles.floating, { bottom: insets.bottom + TAB_BAR_HEIGHT + Spacing.sm }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  floating: { position: 'absolute', left: Spacing.md, right: Spacing.md },
});
