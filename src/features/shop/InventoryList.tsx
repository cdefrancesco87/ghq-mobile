import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { isGiftKey, type GiftKey } from '@/content/shop';
import type { ShopView } from '@/db/repositories/shop';
import { Bar } from '@/features/shared/Bar';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { EmptyState } from '@/features/shared/EmptyState';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { companionName } from '@/rules/companion';
import { HP } from '@/rules/config';
import { useTheme } from '@/theme/ThemeProvider';
import { ItemSprite } from './ItemSprite';
import { useShopTexts } from './shopTexts';

const SPRITE_SIZE = 40;
const EMPTY_SPRITE_SIZE = 96;

export interface InventoryListProps {
  readonly view: ShopView;
  readonly onUsePotion: () => void;
  /** «Dona a Blob»: gives the gift and opens the companion with its cheer (7.5). */
  readonly onGiveGift: (key: GiftKey) => void;
}

/**
 * The objects owned (design-sezioni.md 7.5, mockup D28): a row each with the quantity, «Usa» for
 * the potion (off at full hit points, «La vita è già al massimo») and the shield that works by
 * itself; the bar of the hit points shows what a potion gives back; the gifts have «Dona a Blob»
 * (off for the egg). Empty: the backpack.
 */
export function InventoryList({ view, onUsePotion, onGiveGift }: InventoryListProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const texts = useShopTexts();
  const owned = [...view.items, ...view.gifts].filter((item) => item.owned > 0);
  const petName = companionName(view.companion.name, t('lexicon.companion', { context: family }));
  const isEgg = view.companion.stage === 'egg';

  if (owned.length === 0) {
    return (
      <EmptyState
        testID="shop-inventory-empty"
        companion={<ItemSprite object="backpack" size={EMPTY_SPRITE_SIZE} />}
        message={t('shop.empty', { context: family })}
      />
    );
  }

  return (
    <View style={styles.list}>
      <Card>
        <Bar
          kind="hp"
          label={texts.hpTerm}
          value={view.hp}
          max={HP.max}
          testID="shop-inventory-hp"
        />
      </Card>
      <Card testID="shop-inventory">
        {owned.map((item, index) => {
          const name = texts.name(item.key);
          const quantity = t('shop.quantity', { count: item.owned });
          const detail = isGiftKey(item.key)
            ? isEgg
              ? t('shop.gifts.eggNo')
              : texts.description(item.key)
            : item.key === 'shield'
              ? t('shop.shieldAuto')
              : view.canUsePotion
                ? texts.description(item.key)
                : texts.hpFull;
          return (
            <Fragment key={item.key}>
              {index === 0 ? null : (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              )}
              <View testID={`shop-inventory-${item.key}`} style={styles.row}>
                <View
                  accessible
                  accessibilityLabel={`${name}, ${t('shop.owned', { count: item.owned })}, ${detail}`}
                  style={styles.text}
                >
                  <ItemSprite object={item.key} size={SPRITE_SIZE} />
                  <View style={styles.flex}>
                    <ThemedText>
                      {name} <ThemedText color={colors.textMuted}>{quantity}</ThemedText>
                    </ThemedText>
                    <ThemedText
                      testID={`shop-inventory-${item.key}-detail`}
                      variant="caption"
                      color={colors.textMuted}
                    >
                      {detail}
                    </ThemedText>
                  </View>
                </View>
                {item.key === 'potion' ? (
                  <Button
                    testID="shop-inventory-use-potion"
                    label={t('shop.use')}
                    accessibilityLabel={`${t('shop.use')} ${name}`}
                    onPress={onUsePotion}
                    disabled={!view.canUsePotion}
                    disabledReason={texts.hpFull}
                  />
                ) : null}
                {isGiftKey(item.key) ? (
                  <Button
                    testID={`shop-inventory-give-${item.key}`}
                    label={t('shop.gifts.give', { name: petName })}
                    onPress={() => onGiveGift(item.key as GiftKey)}
                    disabled={isEgg}
                    disabledReason={t('shop.gifts.eggNo')}
                  />
                ) : null}
              </View>
            </Fragment>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16 },
  row: { minHeight: MIN_TOUCH + 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
});
