import { useTranslation } from 'react-i18next';

import type { ItemKey } from '@/content/shop';
import { termInSentence } from '@/i18n/lexicon';
import { SHOP } from '@/rules/config';
import type { RewardSize } from '@/rules/rewards';
import { useTheme } from '@/theme/ThemeProvider';

/** The names and sentences of the shop in the lexicon of the theme (design-sezioni.md 7.3, 7.7). */
export function useShopTexts() {
  const { t, i18n } = useTranslation();
  const { family } = useTheme();
  const inSentence = (key: string) => termInSentence(t(key, { context: family }), i18n.language);

  /** The values of a sentence with coins: «50 monete», «1 gettone» in the lexicon of the theme. */
  const withCoins = (count: number) => ({
    count,
    term: inSentence(count === 1 ? 'lexicon.coins' : 'lexicon.coins_pl'),
  });

  /** The hit points of the theme, as a title: «Vita», «Integrità». */
  const hpTerm = t('lexicon.hp', { context: family });

  return {
    withCoins,
    coins: (count: number) => t('shop.price', withCoins(count)),
    missing: (count: number) => t('shop.missing', withCoins(count)),
    hpTerm,
    /** «Vita già al massimo» (mockup D28B): no article, which changes with the term of the theme. */
    hpFull: t('shop.hpFull', { hp: hpTerm }),
    /** «Media», the size on the card and in the chips of the sheet. */
    size: (size: RewardSize) => t(`shop.rewards.sizes.${size}`),
    /** What the screen reader hears of a reward: «Pizza, ricompensa media, 250 monete» (7.6). */
    rewardLabel: (reward: { name: string; size: RewardSize; price: number }, missing: number) =>
      [
        reward.name,
        t(`shop.rewards.kinds.${reward.size}`),
        t('shop.price', withCoins(reward.price)),
        missing > 0 ? t('shop.missing', withCoins(missing)) : null,
      ]
        .filter((part) => part !== null)
        .join(', '),
    name: (key: ItemKey) => t(`lexicon.${key}`, { context: family }),
    description: (key: ItemKey) =>
      key === 'potion'
        ? t('shop.potionDescription', { amount: SHOP.potion.hp, hp: inSentence('lexicon.hp') })
        : t('shop.shieldDescription', { context: family }),
  };
}
