import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { setBackgroundColorAsync } from 'expo-system-ui';
import { useEffect } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import { systemBarStyles } from '@/theme/themes';

/**
 * Status bar, Android system buttons and window background in the colours of the theme (CLAUDE.md,
 * choice 24). The window background shows behind screen changes and the keyboard, so it is the
 * `sfondo` of the theme too.
 */
export function SystemBars() {
  const theme = useTheme();
  const styles = systemBarStyles(theme);
  const background = theme.colors.background;

  useEffect(() => {
    setBackgroundColorAsync(background);
  }, [background]);

  return (
    <>
      <StatusBar style={styles.statusBar} />
      <NavigationBar style={styles.navigationBar} />
    </>
  );
}
