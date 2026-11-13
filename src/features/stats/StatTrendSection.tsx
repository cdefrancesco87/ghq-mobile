import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip } from '@/features/shared/Chip';
import { statIcon } from '@/features/shared/icons';
import { ThemedText } from '@/features/shared/ThemedText';
import { termInSentence } from '@/i18n/lexicon';
import { STAT_TREND } from '@/rules/config';
import type { StatTrend } from '@/rules/statTrend';
import { STAT_KEYS, type GameDay, type StatKey } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';
import { ColumnChart, type ChartColumn } from './ColumnChart';
import { formatDay } from './format';

export interface StatTrendSectionProps {
  readonly trend: StatTrend;
}

/**
 * The trend of the stats (design-sezioni.md 8.8; backlog T81): chips with the icon and the name of
 * each stat in the lexicon of the theme, a line chart in `primario` of the level of the chosen stat
 * month by month, and under it «Forza: da 3 a 7 negli ultimi 3 mesi». The chart has numbered axes,
 * a description and the table of its values, and becomes that table with very large text (8.12).
 */
export function StatTrendSection({ trend }: StatTrendSectionProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const [stat, setStat] = useState<StatKey>(STAT_KEYS[0]);
  const language = i18n.language;
  const statName = (key: StatKey) => t(`stats.${key}`, { context: family });
  const level = t('lexicon.level', { context: family });

  const monthDay = (month: string) => `${month}-01` as GameDay;
  const columns: ChartColumn[] = trend.months.map((month) => ({
    key: month.month,
    label: formatDay(monthDay(month.month), language, { month: 'short' }),
    spoken: formatDay(monthDay(month.month), language, { month: 'long', year: 'numeric' }),
    value: month.levels[stat],
    text: t('statsScreen.statTrend.value', { term: level, level: month.levels[stat] }),
  }));
  const top = Math.max(1, ...trend.months.map((month) => month.levels[stat]));
  const ticks = [...new Set([0, Math.round(top / 2), top])].map((value) => ({
    value,
    text: String(value),
  }));

  const from = trend.from[stat];
  const to = trend.to[stat];
  const sentence =
    from === to
      ? t('statsScreen.statTrend.same', {
          stat: statName(stat),
          term: termInSentence(level, language),
          level: to,
          count: STAT_TREND.sentenceMonths,
        })
      : t('statsScreen.statTrend.sentence', {
          stat: statName(stat),
          from,
          to,
          count: STAT_TREND.sentenceMonths,
        });

  return (
    <View testID="stats-stat-trend" style={styles.group}>
      <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
        {t('statsScreen.statTrend.title')}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={t('statsScreen.statTrend.stats')}
        contentContainerStyle={styles.chips}
      >
        {STAT_KEYS.map((key) => (
          <Chip
            key={key}
            testID={`stats-stat-trend-chip-${key}`}
            label={statName(key)}
            icon={statIcon(key)}
            selected={key === stat}
            onPress={() => setStat(key)}
          />
        ))}
      </ScrollView>
      <ColumnChart
        testID="stats-stat-trend-chart"
        title={statName(stat)}
        columns={columns}
        max={top}
        ticks={ticks}
        line
        description={t('statsScreen.statTrend.description', {
          stat: statName(stat),
          values: columns.map((column) => `${column.spoken}: ${column.text}`).join(', '),
        })}
      />
      <ThemedText testID="stats-stat-trend-sentence">{sentence}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  chips: { gap: 8, paddingVertical: 4 },
});
