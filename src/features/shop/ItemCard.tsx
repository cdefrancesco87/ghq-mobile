import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ShopViewItem } from '@/db/repositories/shop';
import { Frame } from '@/features/shared/Frame';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import type { ShopOffer } from '@/rules/shop';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { ItemSprite } from './ItemSprite';
import { useShopTexts } from './shopTexts';

/** The 16×16 sprites shown at 4× (design-sezioni.md 7.3). */
const SPRITE_SIZE = 64;

export interface ItemCardProps {
  readonly item: ShopViewItem;
  readonly offer: ShopOffer;
  readonly onPress: () => void;
}

/**
 * A card of the shop: sprite, name, description, price and «Ne hai 1»; short of coins the price is
 * muted with «Ti mancano 20 monete», at the maximum «Ne hai già 2, il massimo» (7.3). The screen
 * reader hears «Pozione, ridà 10 vita, 50 monete, ne hai 1» (7.10).
 */
export function ItemCard({ item, offer, onPress }: ItemCardProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const texts = useShopTexts();
  const name = texts.name(item.key);
  const description = texts.description(item.key);
  const owned =
    offer.state === 'max'
      ? t('shop.max', { count: item.owned })
      : item.owned > 0
        ? t('shop.owned', { count: item.owned })
        : null;
  const missing = offer.state === 'missing' ? texts.missing(offer.missing) : null;
  const label = [name, description, texts.coins(item.price), owned, missing]
    .filter((part) => part !== null)
    .join(', ');
  const muted = offer.state !== 'buyable';

  return (
    <Pressable
      testID={`shop-item-${item.key}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.card}
    >
      <Frame shape={SHAPES[family].card} fill={colors.surface} stroke={colors.border} />
      <View style={styles.sprite}>
        <ItemSprite object={item.key} size={SPRITE_SIZE} />
      </View>
      <ThemedText variant="sectionTitle" color={muted ? colors.textMuted : colors.text}>
        {name}
      </ThemedText>
      <ThemedText variant="caption" color={colors.textMuted} style={styles.description}>
        {description}
      </ThemedText>
      <View style={styles.footer}>
        <View style={styles.price}>
          <Icon name="moneta" size={16} color={muted ? colors.textMuted : colors.coinsText} />
          <ThemedText
            testID={`shop-item-${item.key}-price`}
            variant="numbers"
            color={muted ? colors.textMuted : colors.coinsText}
          >
            {item.price}
          </ThemedText>
        </View>
        {owned === null ? null : (
          <ThemedText testID={`shop-item-${item.key}-owned`} variant="caption">
            {owned}
          </ThemedText>
        )}
      </View>
      {missing === null ? null : (
        <ThemedText
          testID={`shop-item-${item.key}-missing`}
          variant="caption"
          color={colors.textMuted}
        >
          {missing}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: 16, gap: 4 },
  sprite: { alignItems: 'center', paddingVertical: 8 },
  description: { flexGrow: 1 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  price: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
