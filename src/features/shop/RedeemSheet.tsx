import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { RewardView } from '@/db/repositories/rewards';
import { Button } from '@/features/shared/Button';
import { Icon } from '@/features/shared/Icon';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import type { ShopOffer } from '@/rules/shop';
import { useTheme } from '@/theme/ThemeProvider';
import { useShopTexts } from './shopTexts';

export interface RedeemSheetProps {
  readonly visible: boolean;
  /** Kept while the sheet slides away. */
  readonly reward: RewardView | null;
  readonly offer: ShopOffer | null;
  readonly coins: number;
  readonly onRedeem: () => void;
  readonly onClose: () => void;
}

/**
 * The confirmation of a redemption (design-sezioni.md 7.6): name, price, balance after and
 * «Riscatta per 250»; short of coins the sheet opens but the button stays off with the reason.
 */
export function RedeemSheet({
  visible,
  reward,
  offer,
  coins,
  onRedeem,
  onClose,
}: RedeemSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const texts = useShopTexts();
  if (reward === null || offer === null) {
    return null;
  }
  const label = t('shop.rewards.redeem', { price: reward.price });
  const caption =
    offer.balanceAfter === null
      ? t('shop.balanceHave', texts.withCoins(coins))
      : t('shop.balanceAfter', texts.withCoins(offer.balanceAfter));
  const reason = offer.state === 'missing' ? texts.missing(offer.missing) : null;

  return (
    <Sheet visible={visible} onClose={onClose} title={label} testID="shop-redeem-sheet">
      <ThemedText testID="shop-redeem-caption" variant="caption" color={colors.textMuted}>
        {caption}
      </ThemedText>
      <View style={styles.reward} accessible>
        <Icon name="regalo" size={24} color={colors.text} />
        <View style={styles.flex}>
          <ThemedText testID="shop-redeem-name">{reward.name}</ThemedText>
          <ThemedText variant="caption" color={colors.textMuted}>
            {`${texts.size(reward.size)} · ${texts.coins(reward.price)}`}
          </ThemedText>
        </View>
      </View>
      {reason === null ? null : (
        <ThemedText testID="shop-redeem-reason" color={colors.dangerText}>
          {reason}
        </ThemedText>
      )}
      <Button
        testID="shop-redeem-confirm"
        label={label}
        onPress={onRedeem}
        disabled={offer.state !== 'buyable'}
        disabledReason={reason ?? undefined}
        style={styles.button}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
  button: { marginTop: 16 },
});
