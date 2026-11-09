import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';

import { ActiveBar } from '@/components/active-bar';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Web version of the tab bar. Native tabs only have a basic web fallback, so in the
 * browser the app uses a simple bottom bar built from Expo Router's headless tabs.
 */
export default function WebTabLayout() {
  const t = useTheme();
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <ActiveBar style={{ marginHorizontal: Spacing.md, marginBottom: Spacing.sm }} />
      <TabList asChild>
        <View style={StyleSheet.flatten([styles.bar, { backgroundColor: t.surface, borderTopColor: t.border }])}>
          <TabTrigger name="routines" href="/routines" asChild>
            <TabButton>Routines</TabButton>
          </TabTrigger>
          <TabTrigger name="workouts" href="/workouts" asChild>
            <TabButton>Workouts</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>Profile</TabButton>
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const t = useTheme();
  return (
    <Pressable {...(props as PressableProps)} style={StyleSheet.flatten([styles.button, isFocused && { backgroundColor: t.background }])}>
      <Text style={{ color: isFocused ? t.accent : t.textMuted, fontWeight: '700', fontSize: 15 }}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: { flex: 1, maxWidth: 200, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.pill },
});
