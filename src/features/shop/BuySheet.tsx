import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import type { ShopViewItem } from '@/db/repositories/shop';
import { Button } from '@/features/shared/Button';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import type { ShopOffer } from '@/rules/shop';
import { useTheme } from '@/theme/ThemeProvider';
import { ItemSprite } from './ItemSprite';
import { useShopTexts } from './shopTexts';

const SPRITE_SIZE = 40;

export interface BuySheetProps {
  readonly visible: boolean;
  /** Kept while the sheet slides away. */
  readonly item: ShopViewItem | null;
  readonly offer: ShopOffer | null;
  readonly coins: number;
  readonly canUsePotion: boolean;
  readonly onBuy: (useNow: boolean) => void;
  readonly onClose: () => void;
}

/**
 * The confirmation of a purchase (design-sezioni.md 7.4, mockup D27): «Compra per 50» with the
 * balance after, «Usa subito» for the potion; short of coins or at the maximum the sheet opens but
 * the button stays off with the reason.
 */
export function BuySheet({
  visible,
  item,
  offer,
  coins,
  canUsePotion,
  onBuy,
  onClose,
}: BuySheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const texts = useShopTexts();
  const [useNow, setUseNow] = useState(false);
  const [shownKey, setShownKey] = useState(item?.key);
  if (item?.key !== shownKey) {
    // Another item: «Usa subito» starts off again.
    setShownKey(item?.key);
    setUseNow(false);
  }
  if (item === null || offer === null) {
    return null;
  }
  const name = texts.name(item.key);
  const buyLabel = t('shop.buy', { price: item.price });
  const title = offer.state === 'max' ? name : buyLabel;
  const caption =
    offer.state === 'max'
      ? t('shop.atMax')
      : offer.balanceAfter === null
        ? t('shop.balanceHave', texts.withCoins(coins))
        : t('shop.balanceAfter', texts.withCoins(offer.balanceAfter));
  const reason =
    offer.state === 'max'
      ? t('shop.max', { count: item.owned })
      : offer.state === 'missing'
        ? texts.missing(offer.missing)
        : null;
  const useNowAllowed = canUsePotion && offer.state === 'buyable';

  return (
    <Sheet visible={visible} onClose={onClose} title={title} testID="shop-buy-sheet">
      <ThemedText testID="shop-buy-caption" variant="caption" color={colors.textMuted}>
        {caption}
      </ThemedText>
      <View style={styles.item} accessible>
        <ItemSprite object={item.key} size={SPRITE_SIZE} />
        <View style={styles.flex}>
          <ThemedText>{name}</ThemedText>
          <ThemedText variant="caption" color={colors.textMuted}>
            {texts.description(item.key)}
          </ThemedText>
        </View>
      </View>
      {item.key === 'potion' ? (
        <View style={styles.toggle}>
          <View style={styles.flex}>
            <ThemedText>{t('shop.useNow')}</ThemedText>
            {canUsePotion ? null : (
              <ThemedText testID="shop-buy-hp-full" variant="caption" color={colors.textMuted}>
                {texts.hpFull}
              </ThemedText>
            )}
          </View>
          <Switch
            testID="shop-buy-use-now"
            value={useNow && useNowAllowed}
            onValueChange={setUseNow}
            disabled={!useNowAllowed}
            accessibilityLabel={t('shop.useNow')}
            accessibilityHint={canUsePotion ? undefined : texts.hpFull}
            trackColor={{ false: colors.track, true: colors.primary }}
            thumbColor={colors.surfaceHigh}
          />
        </View>
      ) : null}
      {reason === null ? null : (
        <ThemedText
          testID="shop-buy-reason"
          color={offer.state === 'missing' ? colors.dangerText : colors.textMuted}
          style={styles.reason}
        >
          {reason}
        </ThemedText>
      )}
      <Button
        testID="shop-buy-confirm"
        label={buyLabel}
        onPress={() => onBuy(useNow && useNowAllowed)}
        disabled={offer.state !== 'buyable'}
        disabledReason={reason ?? undefined}
        style={styles.button}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  toggle: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 16 },
  reason: { paddingTop: 8 },
  button: { marginTop: 16 },
});
