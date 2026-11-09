import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { DATABASE_NAME } from '@/db/db';
import { migrate } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export default function RootLayout() {
  const scheme = useColorScheme();
  const t = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    // Opens the on-device database and runs pending migrations before any screen renders.
    <KeyboardProvider>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
        <ThemeProvider
          value={{
            ...base,
            colors: {
              ...base.colors,
              primary: t.accent,
              background: t.background,
              card: t.surface,
              text: t.text,
              border: t.border,
            },
          }}>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerTintColor: t.accent,
              headerTitleStyle: { color: t.text },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="active" options={{ presentation: 'fullScreenModal', title: 'Workout' }} />
            <Stack.Screen
              name="summary"
              options={{
                presentation: 'fullScreenModal',
                title: 'Workout complete',
                gestureEnabled: false,
              }}
            />
            <Stack.Screen name="pick-exercise" options={{ presentation: 'modal', title: 'Add exercise' }} />
            <Stack.Screen name="routine-edit" options={{ presentation: 'fullScreenModal', title: 'Routine' }} />
            <Stack.Screen name="exercise-targets" options={{ presentation: 'modal', title: 'Targets' }} />
            <Stack.Screen name="program-edit" options={{ presentation: 'fullScreenModal', title: 'Program' }} />
            <Stack.Screen name="log-measurement" options={{ presentation: 'modal', title: 'Log measurement' }} />
          </Stack>
        </ThemeProvider>
      </SQLiteProvider>
    </KeyboardProvider>
  );
}
