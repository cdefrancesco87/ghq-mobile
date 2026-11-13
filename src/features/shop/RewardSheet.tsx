import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TextInput, View } from 'react-native';

import type { RewardInput, RewardView } from '@/db/repositories/rewards';
import { Button } from '@/features/shared/Button';
import { Chip } from '@/features/shared/Chip';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { REWARD_SIZES, REWARDS } from '@/rules/config';
import { rewardPrice, type RewardSize } from '@/rules/rewards';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { MAX_TEXT_SCALE } from '@/theme/textScale';
import { useTheme } from '@/theme/ThemeProvider';
import { useShopTexts } from './shopTexts';

const FIELD_MIN_HEIGHT = 56;
const DEFAULT_SIZE: RewardSize = 'small';

export interface RewardSheetProps {
  readonly visible: boolean;
  /** The reward to change; null for a new one. */
  readonly reward: RewardView | null;
  readonly onSave: (input: RewardInput) => void;
  readonly onClose: () => void;
}

/**
 * Creating or changing a reward (design-sezioni.md 7.6): the name (required, up to 40 characters)
 * and the size with 4 chips, each with its price; the price is never typed by hand.
 */
export function RewardSheet({ visible, reward, onSave, onClose }: RewardSheetProps) {
  const { t } = useTranslation();
  const { colors, family, typography } = useTheme();
  const texts = useShopTexts();
  const [name, setName] = useState(reward?.name ?? '');
  const [size, setSize] = useState<RewardSize>(reward?.size ?? DEFAULT_SIZE);
  const [shownFor, setShownFor] = useState<string | null>(null);
  // Every opening starts from the reward shown (or from an empty one).
  const key = visible ? (reward?.id ?? 'new') : null;
  if (key !== shownFor) {
    setShownFor(key);
    if (key !== null) {
      setName(reward?.name ?? '');
      setSize(reward?.size ?? DEFAULT_SIZE);
    }
  }
  const shape = SHAPES[family].control;
  const radius = shape.kind === 'rounded' ? shape.radius : 0;
  const valid = name.trim() !== '';
  const save = () => {
    if (valid) {
      onSave({ name, size });
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={reward === null ? t('shop.rewards.createTitle') : t('shop.rewards.editTitle')}
      testID="shop-reward-sheet"
    >
      <View style={styles.group}>
        <TextInput
          testID="shop-reward-name"
          value={name}
          onChangeText={(text) => setName(text.slice(0, REWARDS.nameMaxLength))}
          maxLength={REWARDS.nameMaxLength}
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          autoFocus={reward === null}
          returnKeyType="done"
          onSubmitEditing={save}
          placeholder={t('shop.rewards.example')}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          accessibilityLabel={t('shop.rewards.nameLabel')}
          accessibilityHint={t('shop.rewards.nameHint', { max: REWARDS.nameMaxLength })}
          style={[
            textStyleOf(typography.body),
            styles.field,
            { color: colors.text, borderColor: colors.textMuted, borderRadius: radius },
          ]}
        />
        <ThemedText variant="caption" color={colors.textMuted}>
          {t('shop.rewards.nameHint', { max: REWARDS.nameMaxLength })}
        </ThemedText>
      </View>
      <View style={styles.group}>
        <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
          {t('shop.rewards.sizeTitle')}
        </ThemedText>
        <View style={styles.chips}>
          {REWARD_SIZES.map((option) => {
            const price = rewardPrice(option);
            return (
              <Chip
                key={option}
                testID={`shop-reward-size-${option}`}
                label={t('shop.rewards.sizeChip', { size: texts.size(option), price })}
                accessibilityLabel={t('shop.rewards.sizeChipLabel', {
                  size: texts.size(option),
                  ...texts.withCoins(price),
                })}
                selected={size === option}
                onPress={() => setSize(option)}
              />
            );
          })}
        </View>
      </View>
      <Button
        testID="shop-reward-save"
        label={reward === null ? t('shop.rewards.create') : t('shop.rewards.save')}
        onPress={save}
        disabled={!valid}
        style={styles.button}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8, paddingTop: 16 },
  field: { minHeight: FIELD_MIN_HEIGHT, borderWidth: 1, paddingHorizontal: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { marginTop: 24 },
});
