import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ProgressRing, ringStroke } from '@/features/shared/ProgressRing';
import { ThemedText } from '@/features/shared/ThemedText';
import type { GameDay } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';

const RING_SIZE = 48;

/** «Venerdì 6 novembre»: the game day in the language of the app, with a capital first letter. */
export function formatGameDay(day: GameDay, language: string): string {
  const [year, month, date] = day.split('-').map(Number);
  const text = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, date, 12)));
  return text.charAt(0).toLocaleUpperCase(language) + text.slice(1);
}

export interface TodayHeaderProps {
  readonly day: GameDay;
  readonly heroName: string;
  readonly doneCount: number;
  readonly totalCount: number;
}

/** Date and greeting in the tone of the theme, with the progress of the day (design 2.2). */
export function TodayHeader({ day, heroName, doneCount, totalCount }: TodayHeaderProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <ThemedText variant="caption" color={colors.textMuted} testID="today-date">
          {formatGameDay(day, i18n.language)}
        </ThemedText>
        <ThemedText variant="screenTitle" accessibilityRole="header" testID="today-greeting">
          {t('shared.greeting', { context: family, name: heroName })}
        </ThemedText>
      </View>
      {totalCount === 0 ? null : (
        <View
          testID="today-progress"
          accessible
          accessibilityLabel={t('today.progressLabel', { done: doneCount, total: totalCount })}
          style={styles.ring}
        >
          <ProgressRing
            progress={doneCount / totalCount}
            size={RING_SIZE}
            strokeWidth={ringStroke(family)}
          />
          <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
            <ThemedText variant="caption" allowFontScaling={false}>
              {t('today.progress', { done: doneCount, total: totalCount })}
            </ThemedText>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, gap: 4 },
  ring: { width: RING_SIZE, height: RING_SIZE },
  centre: { alignItems: 'center', justifyContent: 'center' },
});
