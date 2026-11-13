import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Trophy } from '@/db/repositories/trophies';
import { BossSprite } from '@/features/shared/BossSprite';
import { Icon } from '@/features/shared/Icon';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useTheme } from '@/theme/ThemeProvider';
import { useBossTexts } from './bossTexts';

/** The boss in miniature (design-sezioni.md 5.7): 32×32 at 2×. */
export const TROPHY_SIZE = 64;
const PEDESTAL_HEIGHT = 12;

/** The empty pedestal under a trophy, or alone in the empty Hall. */
export function Pedestal({ width }: { readonly width: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.pedestal,
        { width, backgroundColor: colors.surfaceHigh, borderColor: colors.border },
      ]}
    />
  );
}

export interface TrophyTileProps {
  readonly trophy: Trophy;
  readonly onOpen: () => void;
  readonly testID: string;
}

/**
 * A trophy of the Hall (design-sezioni.md 5.7; mockups D25, B3a): the boss in miniature on a
 * pedestal, in Minimal the medal in a circle; the name, the day of the victory and the days taken.
 */
export function TrophyTile({ trophy, onOpen, testID }: TrophyTileProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const { nameOf } = useBossTexts();
  const name = nameOf(trophy.boss);
  const [, month, day] = trophy.defeatedDay.split('-').map(Number);
  const date = { day, month: t(`shared.frequency.month.${month}`), count: trophy.daysTaken };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('bosses.trophies.label', { name, ...date })}
      accessibilityHint={t('bosses.trophies.openHint')}
      onPress={onOpen}
      style={styles.tile}
    >
      {family === 'minimal' ? (
        <View
          style={[styles.medal, { backgroundColor: colors.surface, borderRadius: TROPHY_SIZE / 2 }]}
        >
          <Icon name="trofeo" color={colors.coinsText} />
        </View>
      ) : (
        <BossSprite
          kind={trophy.boss.kind === 'starter' ? 'quest' : trophy.boss.difficulty}
          size={TROPHY_SIZE}
        />
      )}
      <Pedestal width={TROPHY_SIZE + 8} />
      <ThemedText variant="label" numberOfLines={2} style={styles.center}>
        {name}
      </ThemedText>
      <ThemedText variant="caption" color={colors.textMuted} style={styles.center}>
        {t('bosses.trophies.detail', date)}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', gap: 4, padding: 4 },
  medal: {
    width: TROPHY_SIZE,
    height: TROPHY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedestal: { height: PEDESTAL_HEIGHT, borderRadius: PEDESTAL_HEIGHT / 2, borderWidth: 1 },
  center: { textAlign: 'center' },
});
