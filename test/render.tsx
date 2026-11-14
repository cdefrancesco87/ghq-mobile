import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createI18n, type Language } from '@/i18n';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { THEMES, type ThemeKey, type ThemeTokens } from '@/theme/themes';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Renders a component with the theme and the language it reads, as under `AppProviders`. */
export async function renderThemed(
  ui: ReactElement,
  {
    theme = 'minimal-chiaro',
    language = 'it',
    colorblind = false,
  }: { theme?: ThemeKey; language?: Language; colorblind?: boolean } = {},
): Promise<ThemeTokens> {
  const i18n = await createI18n(language);
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider
          theme={theme === 'minimal-chiaro' || theme === 'minimal-scuro' ? 'minimal' : theme}
          colorScheme={theme === 'minimal-scuro' ? 'dark' : 'light'}
          colorblind={colorblind}
        >
          {ui}
        </ThemeProvider>
      </I18nextProvider>
    </SafeAreaProvider>,
  );
  return THEMES[theme];
}
