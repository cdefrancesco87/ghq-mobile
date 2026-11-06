import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import type { SettingValue } from '../db/repositories/settings';
import { THEMES, resolveTheme, type ThemeTokens } from './themes';

// The theme of the app, given to every screen with the React Context (stack-tecnologico.md,
// point 8): changing it redraws the interface without touching the data.

const ThemeContext = createContext<ThemeTokens | null>(null);

export interface ThemeProviderProps {
  /** The `theme` setting. */
  readonly theme: SettingValue<'theme'>;
  /** Light or dark mode of the phone; read from the system when missing. */
  readonly colorScheme?: string | null;
  readonly children: ReactNode;
}

export function ThemeProvider({ theme, colorScheme, children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const tokens =
    THEMES[resolveTheme(theme, colorScheme === undefined ? systemScheme : colorScheme)];
  return <ThemeContext value={tokens}>{children}</ThemeContext>;
}

/** The tokens of the theme in use. */
export function useTheme(): ThemeTokens {
  const tokens = useContext(ThemeContext);
  if (tokens === null) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return tokens;
}
