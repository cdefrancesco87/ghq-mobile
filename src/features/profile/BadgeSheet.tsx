import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { BadgeItem } from '@/db/repositories/badges';
import { Bar } from '@/features/shared/Bar';
import { useBadgeTexts } from '@/features/shared/badgeTexts';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { termInSentence } from '@/i18n/lexicon';
import { useTheme } from '@/theme/ThemeProvider';
import { BadgeMedal } from './BadgeMedal';
import { BADGE_SIZE, useBadgeDate } from './BadgeTile';

export interface BadgeSheetProps {
  readonly visible: boolean;
  /** The badge last opened: it stays while the sheet slides away. */
  readonly item: BadgeItem | null;
  readonly onClose: () => void;
}

/**
 * The detail of a badge (design-sezioni.md 9.6; mockup D34B): the shape, the name, the condition
 * and, if unlocked, the date and the bonus coins received; if locked, the progress.
 */
export function BadgeSheet({ visible, item, onClose }: BadgeSheetProps) {
  return (
    <Sheet visible={visible && item !== null} onClose={onClose} testID="badge-sheet">
      {item === null ? null : <Content item={item} />}
    </Sheet>
  );
}

function Content({ item }: { readonly item: BadgeItem }) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const { nameOf, conditionOf } = useBadgeTexts();
  const dateOf = useBadgeDate();
  const name = nameOf(item.badge);
  const unlocked = item.unlockedAt !== null;
  const coins = {
    coins: item.coins ?? 0,
    coinsTerm: termInSentence(t('lexicon.coins_pl', { context: family }), i18n.language),
  };
  return (
    <View style={styles.content}>
      <BadgeMedal unlocked={unlocked} size={BADGE_SIZE} label={name} />
      <ThemedText testID="badge-sheet-name" variant="screenTitle" accessibilityRole="header">
        {name}
      </ThemedText>
      <ThemedText testID="badge-sheet-condition" color={colors.textMuted} style={styles.center}>
        {conditionOf(item.badge)}
      </ThemedText>
      {unlocked ? (
        <>
          <ThemedText testID="badge-sheet-date" variant="label" color={colors.doneText}>
            {t('badges.unlockedOn', { date: dateOf(item) })}
          </ThemedText>
          <ThemedText
            testID="badge-sheet-coins"
            variant="label"
            color={colors.coinsText}
            accessibilityLabel={t('badges.coinsLabel', coins)}
          >
            {t('badges.coins', coins)}
          </ThemedText>
        </>
      ) : (
        <View style={styles.progress}>
          <Bar
            kind="xp"
            label={t('badges.locked')}
            value={item.progress.current}
            max={item.progress.target}
            showLabel={false}
            showValue={false}
            testID="badge-sheet-bar"
          />
          <ThemedText testID="badge-sheet-progress" variant="caption" color={colors.textMuted}>
            {t('badges.progress', {
              current: item.progress.current,
              target: item.progress.target,
            })}
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 8, paddingBottom: 24 },
  center: { textAlign: 'center' },
  progress: { alignSelf: 'stretch', alignItems: 'center', gap: 4 },
});
