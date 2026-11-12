import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { barRatio } from '@/features/shared/Bar';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { useLargeText } from '@/features/shared/useLargeText';
import type { Hero } from '@/db/repositories/hero';
import { HP } from '@/rules/config';
import { useTheme } from '@/theme/ThemeProvider';

const TRACK_HEIGHT = 6;

export interface HeroStickyBarProps {
  readonly hero: Hero;
  readonly xpToNext: number;
}

/**
 * The thin bar that takes the place of the hero card while scrolling (design-sezioni.md 2.2 ★):
 * level, health, experience and streak, so the gains of a completion stay in view. With very large
 * text only the level (2.11). The screen reader already has the hero card, so it skips this copy.
 */
export function HeroStickyBar({ hero, xpToNext }: HeroStickyBarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const largeText = useLargeText();
  return (
    <View
      testID="today-sticky"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.bar,
        { paddingTop: top + 8, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <ThemedText variant="label">{t('today.hero.stickyLevel', { level: hero.level })}</ThemedText>
      {largeText ? null : (
        <>
          <Track testID="today-sticky-hp" color={colors.hp} ratio={barRatio(hero.hp, HP.max)} />
          <Track
            testID="today-sticky-xp"
            color={colors.xp}
            ratio={barRatio(hero.xpInLevel, xpToNext)}
          />
          <View style={styles.streak}>
            <ThemedText variant="numbers" color={colors.textMuted}>
              {String(hero.streak)}
            </ThemedText>
            <Icon name="serie" size={16} color={colors.textMuted} />
          </View>
        </>
      )}
    </View>
  );
}

function Track({ color, ratio, testID }: { color: string; ratio: number; testID: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.track, { backgroundColor: colors.track }]}>
      <View style={{ height: '100%', width: `${ratio * 100}%`, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  track: { flex: 1, height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, overflow: 'hidden' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
