import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function ProfileStack() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerTintColor: t.accent, headerTitleStyle: { color: t.text } }}>
      <Stack.Screen name="index" options={{ title: 'Profile', headerLargeTitle: true }} />
      <Stack.Screen name="body" options={{ title: 'Body' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      <Stack.Screen name="exercises/index" options={{ title: 'Exercises' }} />
      <Stack.Screen name="exercises/[id]" options={{ title: '' }} />
    </Stack>
  );
}
