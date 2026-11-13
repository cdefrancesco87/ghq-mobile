import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import type { BadgeItem } from '@/db/repositories/badges';
import { useBadgeTexts } from '@/features/shared/badgeTexts';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { formatDay } from '@/features/stats/format';
import { useTheme } from '@/theme/ThemeProvider';
import { BadgeMedal } from './BadgeMedal';

/** The badge in the grid: 24×24 pixel art at 3× (design-sezioni.md A5). */
export const BADGE_SIZE = 72;

/** «21 ottobre»: the day of an unlock. */
export function useBadgeDate(): (item: BadgeItem) => string {
  const { i18n } = useTranslation();
  return (item) =>
    item.unlockedDay === null
      ? ''
      : formatDay(item.unlockedDay, i18n.language, { day: 'numeric', month: 'long' });
}

export interface BadgeTileProps {
  readonly item: BadgeItem;
  readonly onOpen: () => void;
  readonly testID: string;
}

/**
 * A badge of the grid (design-sezioni.md 9.6; mockup D34A): unlocked in colour with its date,
 * locked as a shape in muted text with the progress («23 di 30»). The screen reader hears the
 * condition and the progress of a locked badge (9.11).
 */
export function BadgeTile({ item, onOpen, testID }: BadgeTileProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { nameOf, conditionOf } = useBadgeTexts();
  const dateOf = useBadgeDate();
  const name = nameOf(item.badge);
  const unlocked = item.unlockedAt !== null;
  const label = unlocked
    ? t('badges.tileUnlocked', { name, date: dateOf(item) })
    : t('badges.tileLocked', {
        name,
        condition: conditionOf(item.badge),
        current: item.progress.current,
        target: item.progress.target,
      });
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('badges.openHint')}
      onPress={onOpen}
      style={styles.tile}
    >
      <BadgeMedal unlocked={unlocked} size={BADGE_SIZE} label={name} />
      <ThemedText
        variant="label"
        numberOfLines={2}
        color={unlocked ? colors.text : colors.textMuted}
        style={styles.center}
      >
        {name}
      </ThemedText>
      <ThemedText
        testID={`${testID}-caption`}
        variant="caption"
        color={colors.textMuted}
        style={styles.center}
      >
        {unlocked
          ? dateOf(item)
          : t('badges.progress', { current: item.progress.current, target: item.progress.target })}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', gap: 4, padding: 4 },
  center: { textAlign: 'center' },
});
