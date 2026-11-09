import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function RoutinesStack() {
  const t = useTheme();
  return (
    <Stack screenOptions={{ headerTintColor: t.accent, headerTitleStyle: { color: t.text } }}>
      <Stack.Screen name="index" options={{ title: 'Routines', headerLargeTitle: true }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
