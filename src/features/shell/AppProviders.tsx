import type { i18n as I18n } from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { CelebrationProvider } from '@/features/shared/Celebration';
import { MomentQueueProvider } from '@/features/shared/MomentQueue';
import { UndoToastProvider } from '@/features/shared/UndoToast';
import { useThemeStore } from '@/stores/theme';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { SystemBars } from './SystemBars';

export interface AppProvidersProps {
  readonly i18n: I18n;
  readonly children: ReactNode;
}

/**
 * Language, theme with its system bars, undo notice and game feedback for every screen; the theme
 * is the `theme` setting.
 */
export function AppProviders({ i18n, children }: AppProvidersProps) {
  const theme = useThemeStore((state) => state.theme);
  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <SystemBars />
        <UndoToastProvider>
          <CelebrationProvider>
            <MomentQueueProvider>{children}</MomentQueueProvider>
          </CelebrationProvider>
        </UndoToastProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}
