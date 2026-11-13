import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { StatRow } from '@/db/repositories/profile';
import { Bar } from '@/features/shared/Bar';
import { Frame } from '@/features/shared/Frame';
import { Icon } from '@/features/shared/Icon';
import { statIcon } from '@/features/shared/icons';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';

export interface StatTileProps {
  readonly row: StatRow;
  readonly onPress: () => void;
  /** One tile per row, with very large text (design-sezioni.md 9.11). */
  readonly fullWidth: boolean;
}

/**
 * A tile of the character sheet (design-sezioni.md 9.4; mockup B7): icon and name of the stat in
 * the lexicon of the theme, «Lv 4» and the bar towards the next level; «Max» with the full bar at
 * the cap; «Completa missioni di questo tipo» while the stat is at 0. The form arrow comes with
 * T69. Read as «Forza, livello 4, 340 punti su 500» (9.11).
 */
export function StatTile({ row, onPress, fullWidth }: StatTileProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const { stat, points, progress } = row;
  const name = t(`stats.${stat}`, { context: family });
  const total = progress.toNext ?? Math.max(progress.inLevel, 1);
  const label = progress.max
    ? t('profile.statLabel', { context: 'max', name, points })
    : t('profile.statLabel', {
        name,
        level: progress.level,
        points: progress.inLevel,
        max: progress.toNext,
      });

  return (
    <Pressable
      testID={`profile-stat-${stat}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('profile.statHint')}
      onPress={onPress}
      style={[styles.tile, fullWidth ? styles.full : styles.half]}
    >
      <Frame shape={SHAPES[family].card} fill={colors.surface} stroke={colors.border} />
      <View style={styles.head}>
        <Icon name={statIcon(stat)} size={16} color={colors.textMuted} />
        <ThemedText variant="label" numberOfLines={1} style={styles.flex}>
          {name}
        </ThemedText>
      </View>
      <ThemedText testID={`profile-stat-${stat}-level`} variant="sectionTitle">
        {progress.max ? t('profile.statMax') : t('profile.statLevel', { level: progress.level })}
      </ThemedText>
      <Bar
        kind="stat"
        label={name}
        value={progress.max ? total : progress.inLevel}
        max={total}
        showLabel={false}
        showValue={false}
        testID={`profile-stat-${stat}-bar`}
      />
      {points === 0 ? (
        <ThemedText
          testID={`profile-stat-${stat}-empty`}
          variant="caption"
          color={colors.textMuted}
        >
          {t('profile.statEmpty')}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { minHeight: MIN_TOUCH, padding: 16, gap: 8 },
  half: { flexBasis: '45%', flexGrow: 1 },
  full: { flexBasis: '100%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
