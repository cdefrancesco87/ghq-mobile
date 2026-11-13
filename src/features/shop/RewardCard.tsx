import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { RewardView } from '@/db/repositories/rewards';
import { Frame } from '@/features/shared/Frame';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { REWARD_SIZES } from '@/rules/config';
import { rewardDots } from '@/rules/rewards';
import type { ShopOffer } from '@/rules/shop';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { useShopTexts } from './shopTexts';

const DOT_SIZE = 8;

export interface RewardCardProps {
  readonly reward: RewardView;
  readonly offer: ShopOffer;
  readonly onPress: () => void;
  /** The menu with Modifica and Elimina: «…» or a long press (design 7.6). */
  readonly onMenu: () => void;
}

/**
 * A personal reward in the grid of the shop (design-sezioni.md 7.6): the line icon of the gift
 * with 1 to 4 dots for the size, the name on up to 2 lines, the size and only the price; short of
 * coins the price is muted with «Ti mancano 40 monete».
 */
export function RewardCard({ reward, offer, onPress, onMenu }: RewardCardProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const texts = useShopTexts();
  const muted = offer.state !== 'buyable';
  const missing = offer.state === 'missing' ? texts.missing(offer.missing) : null;
  const dots = rewardDots(reward.size);
  const testID = `shop-reward-${reward.id}`;

  return (
    <View style={styles.card}>
      <Frame shape={SHAPES[family].card} fill={colors.surface} stroke={colors.border} />
      <Pressable
        testID={testID}
        onPress={onPress}
        onLongPress={onMenu}
        accessibilityRole="button"
        accessibilityLabel={texts.rewardLabel(reward, offer.missing)}
        style={styles.main}
      >
        <View style={styles.top}>
          <Icon name="regalo" size={24} color={muted ? colors.textMuted : colors.text} />
          <View style={styles.dots}>
            {REWARD_SIZES.map((size, index) => (
              <View
                key={size}
                style={[
                  styles.dot,
                  index < dots
                    ? { backgroundColor: colors.coins }
                    : { borderWidth: 1, borderColor: colors.textMuted },
                ]}
              />
            ))}
          </View>
        </View>
        <ThemedText
          testID={`${testID}-name`}
          variant="sectionTitle"
          numberOfLines={2}
          color={muted ? colors.textMuted : colors.text}
        >
          {reward.name}
        </ThemedText>
        <ThemedText variant="caption" color={colors.textMuted} style={styles.grow}>
          {texts.size(reward.size)}
        </ThemedText>
        <View style={styles.price}>
          <Icon name="moneta" size={16} color={muted ? colors.textMuted : colors.coinsText} />
          <ThemedText
            testID={`${testID}-price`}
            variant="numbers"
            color={muted ? colors.textMuted : colors.coinsText}
          >
            {reward.price}
          </ThemedText>
        </View>
        {missing === null ? null : (
          <ThemedText testID={`${testID}-missing`} variant="caption" color={colors.textMuted}>
            {missing}
          </ThemedText>
        )}
      </Pressable>
      <Pressable
        testID={`${testID}-menu`}
        onPress={onMenu}
        accessibilityRole="button"
        accessibilityLabel={t('shop.rewards.more', { name: reward.name })}
        style={styles.more}
      >
        <Icon name="altro" size={20} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

export interface NewRewardCardProps {
  /** Without rewards the card shows the example (7.6). */
  readonly showExample: boolean;
  readonly onPress: () => void;
}

/** The dashed card «+ Nuova ricompensa», always the last of the group (7.6). */
export function NewRewardCard({ showExample, onPress }: NewRewardCardProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const shape = SHAPES[family].card;
  const radius = shape.kind === 'rounded' ? shape.radius : 0;
  return (
    <Pressable
      testID="shop-reward-new"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('shop.rewards.new')}
      style={[styles.card, styles.newCard, { borderColor: colors.textMuted, borderRadius: radius }]}
    >
      <Icon name="aggiungi" size={24} color={colors.primary} />
      <ThemedText variant="label" color={colors.primary} style={styles.center}>
        {t('shop.rewards.new')}
      </ThemedText>
      {showExample ? (
        <ThemedText
          testID="shop-reward-example"
          variant="caption"
          color={colors.textMuted}
          style={styles.center}
        >
          {t('shop.rewards.example')}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  main: { flex: 1, padding: 16, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  grow: { flexGrow: 1 },
  price: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  more: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCard: {
    minHeight: 120,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
});
