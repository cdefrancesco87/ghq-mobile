import { useTranslation } from 'react-i18next';

import type { Boss } from '@/db/repositories/boss';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Name and step titles of a boss. The quest of the first launch keeps keys of the language
 * files (onboarding.ts), with the name in the lexicon of the theme; the other bosses keep what
 * the user wrote.
 */
export function useBossTexts() {
  const { t } = useTranslation();
  const { family } = useTheme();
  return {
    nameOf: (boss: Boss) =>
      boss.kind === 'starter' ? t(boss.name, { context: family }) : boss.name,
    stepTitleOf: (boss: Boss, title: string) => (boss.kind === 'starter' ? t(title) : title),
  };
}
