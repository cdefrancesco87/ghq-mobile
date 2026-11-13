import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text } from 'react-native';

// Defines the tasks of the notification actions and of the daily backup when the bundle loads,
// even in the background.
import { useAutoBackupTask } from '@/features/backup/backgroundBackup';
import '@/features/notifications/backgroundTask';
import { useReminderActions } from '@/features/notifications/useReminderActions';
import { AppProviders } from '@/features/shell/AppProviders';
import { useBootstrap } from '@/features/shell/useBootstrap';
import { FONT_FILES } from '@/theme/fonts';

// The splash screen stays until the fonts of the themes and the data are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(FONT_FILES);
  const bootstrap = useBootstrap();
  useReminderActions();
  useAutoBackupTask();
  // If a font cannot be loaded the app still starts, with the system font.
  const fontsReady = loaded || error !== null;
  const dataReady = bootstrap.i18n !== null || bootstrap.status === 'error';

  useEffect(() => {
    if (fontsReady && dataReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady, dataReady]);

  if (bootstrap.status === 'error') {
    // The database did not open or a migration failed: better to say so than to start half empty.
    return <Text>{String(bootstrap.error)}</Text>;
  }
  if (!fontsReady || bootstrap.i18n === null) {
    return null;
  }
  return (
    <AppProviders i18n={bootstrap.i18n}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* The first launch arrives on Today with a fade (design-sezioni.md 1.7). */}
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="editor"
          options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9] }}
        />
        {/* The creation of a boss is one screen at full height (design-sezioni.md 5.2). */}
        <Stack.Screen name="goal-editor" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </AppProviders>
  );
}
