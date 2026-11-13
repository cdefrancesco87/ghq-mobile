import { useTranslation } from 'react-i18next';

import { BADGE_LIST, NAMED_BADGES } from '@/content/badges';
import { termInSentence } from '@/i18n/lexicon';
import type { BadgeDefinition } from '@/rules/badges';
import { companionName } from '@/rules/companion';
import { useHeroStore } from '@/stores/hero';
import { useTheme } from '@/theme/ThemeProvider';

export interface BadgeTexts {
  /** «Serie di 7», «Primo passo». */
  readonly nameOf: (badge: BadgeDefinition) => string;
  /** «Serie: 7 giorni di fila». */
  readonly conditionOf: (badge: BadgeDefinition) => string;
  /** The badge of a key of the content; undefined for an unknown key. */
  readonly find: (key: string) => BadgeDefinition | undefined;
}

/** Names and conditions of the badges in the lexicon of the theme (design-sezioni.md 9.6). */
export function useBadgeTexts(): BadgeTexts {
  const { t, i18n } = useTranslation();
  const { family } = useTheme();
  const chosenName = useHeroStore((state) => state.companionName);
  const term = (key: string) => t(`lexicon.${key}`, { context: family });
  const inSentence = (key: string) => termInSentence(term(key), i18n.language);
  const values = () => ({
    mission: inSentence('missions'),
    missions: inSentence('missions_pl'),
    boss: inSentence('boss'),
    bosses: inSentence('boss_pl'),
    streak: term('streak'),
    level: term('level'),
    levelLower: inSentence('level'),
    fullDay: term('fullDay'),
    plan: term('dayPlan'),
    companion: companionName(chosenName, term('companion')),
  });
  return {
    nameOf: (badge) =>
      t(`badges.name.${NAMED_BADGES.has(badge.key) ? badge.key : badge.metric}`, {
        ...values(),
        n: badge.target,
      }),
    conditionOf: (badge) =>
      t(`badges.condition.${badge.metric}`, { ...values(), count: badge.target }),
    find: (key) => BADGE_LIST.find((badge) => badge.key === key),
  };
}
