import type { i18n as I18n } from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { UndoToastProvider } from '@/features/shared/UndoToast';
import { useThemeStore } from '@/stores/theme';
import { ThemeProvider } from '@/theme/ThemeProvider';

export interface AppProvidersProps {
  readonly i18n: I18n;
  readonly children: ReactNode;
}

/** Language, theme and undo notice for every screen; the theme is the `theme` setting. */
export function AppProviders({ i18n, children }: AppProvidersProps) {
  const theme = useThemeStore((state) => state.theme);
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <UndoToastProvider>{children}</UndoToastProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
