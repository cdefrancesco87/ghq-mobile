import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import type { SettingValue } from '../db/repositories/settings';
import { withColorblindColors } from './colorblind';
import { THEMES, resolveTheme, type ThemeTokens } from './themes';

// The theme of the app, given to every screen with the React Context (stack-tecnologico.md,
// point 8): changing it redraws the interface without touching the data.

const ThemeContext = createContext<ThemeTokens | null>(null);
/** «Colori per daltonici», passed down to the themes nested inside (the previews of the themes). */
const ColorblindContext = createContext(false);

export interface ThemeProviderProps {
  /** The `theme` setting. */
  readonly theme: SettingValue<'theme'>;
  /** Light or dark mode of the phone; read from the system when missing. */
  readonly colorScheme?: string | null;
  /** The `colorblind` setting; the one of the theme around this one when missing. */
  readonly colorblind?: boolean;
  readonly children: ReactNode;
}

export function ThemeProvider({ theme, colorScheme, colorblind, children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const outerColorblind = useContext(ColorblindContext);
  const blind = colorblind ?? outerColorblind;
  const base = THEMES[resolveTheme(theme, colorScheme === undefined ? systemScheme : colorScheme)];
  const tokens = useMemo(
    () => (blind ? { ...base, colors: withColorblindColors(base.colors) } : base),
    [base, blind],
  );
  return (
    <ColorblindContext value={blind}>
      <ThemeContext value={tokens}>{children}</ThemeContext>
    </ColorblindContext>
  );
}

/** The tokens of the theme in use. */
export function useTheme(): ThemeTokens {
  const tokens = useContext(ThemeContext);
  if (tokens === null) {
    throw new Error('useTheme must be used inside a ThemeProvider');
  }
  return tokens;
}
