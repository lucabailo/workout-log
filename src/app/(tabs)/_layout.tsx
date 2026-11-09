import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/hooks/use-theme';

export default function TabLayout() {
  const t = useTheme();
  return (
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
  );
}
