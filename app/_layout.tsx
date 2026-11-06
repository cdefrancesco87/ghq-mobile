import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { FONT_FILES } from '@/theme/fonts';

// The splash screen stays until the fonts of the themes are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts(FONT_FILES);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // If a font cannot be loaded the app still starts, with the system font.
  if (!loaded && !error) {
    return null;
  }
  return <Stack />;
}
