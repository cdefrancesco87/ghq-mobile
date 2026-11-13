import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  STATS_PERIODS,
  type StatsPeriod,
  type StatsSummary,
  type StatsView,
} from '@/db/repositories/statsView';
import { Card } from '@/features/shared/Card';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { SegmentedControl } from '@/features/shared/SegmentedControl';
import { ThemedText } from '@/features/shared/ThemedText';
import { useLargeText } from '@/features/shared/useLargeText';
import { announceOnIos } from '@/features/shared/announce';
import { termInSentence } from '@/i18n/lexicon';
import type { GameDay } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';
import { Heatmap } from './Heatmap';
import { HeatmapDaySheet, longDay } from './HeatmapDaySheet';
import { QuestLog } from './QuestLog';
import { SummaryTile } from './SummaryTile';
import { useBackfillCandidates } from './useBackfillCandidates';
import { useHeatmapDay } from './useHeatmapDay';
import { TrendRow } from './TrendRow';

type Tab = 'overview' | 'log';

/** The value of a summary tile with no data yet (8.9, mockup D29). */
const NO_VALUE = '–';

export interface StatsScreenProps {
  readonly view: StatsView;
}

/**
 * Statistics, a route of the stack opened from the Profile and from the hero card in Today
 * (design-sezioni.md 8.1, 8.2, 8.4, 8.9, mockup B9, D29): the tabs Panoramica and Registro (T67), the summary 2×2 (one column with very large text, 8.12) whose
 * comparisons appear only when positive, and the missions from the least constant in the period.
 * The heatmap (8.3) sits between the summary and the trends, its days open a sheet.
 */
export function StatsScreen({ view }: StatsScreenProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<StatsPeriod>('week');
  // The day stays while the sheet slides away.
  const [openDay, setOpenDay] = useState<GameDay | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const day = useHeatmapDay(openDay);
  const backfill = useBackfillCandidates(openDay);

  const showDay = (gameDay: GameDay) => {
    setOpenDay(gameDay);
    setSheetVisible(true);
  };

  // The day touched is said with its percentage (8.3); on Android the sheet title is read.
  useEffect(() => {
    if (sheetVisible && day !== null) {
      announceOnIos(
        t('statsScreen.heatmapDay', {
          day: longDay(day.day, i18n.language),
          value:
            day.rate === null
              ? t('statsScreen.heatmapLevels.none')
              : t('statsScreen.percent', { rate: day.rate }),
        }),
      );
    }
  }, [sheetVisible, day, t, i18n.language]);

  const term = (count: number) =>
    termInSentence(
      t(count === 1 ? 'lexicon.missions' : 'lexicon.missions_pl', { context: family }),
      i18n.language,
    );
  const trends = view.trends[period];
  const anyRate = trends.some((trend) => trend.rate !== null);

  return (
    <View testID="stats-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="stats-header"
        title={t('lexicon.screenStats', { context: family })}
        compact
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <SegmentedControl
          testID="stats-tabs"
          accessibilityLabel={t('statsScreen.tabs')}
          options={[
            { value: 'overview' as const, label: t('statsScreen.overview') },
            { value: 'log' as const, label: t('statsScreen.log') },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'log' ? (
          <QuestLog />
        ) : (
          <>
            <Summary summary={view.summary} term={term} />
            <View style={styles.group}>
              <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
                {t('statsScreen.heatmap')}
              </ThemedText>
              <Heatmap view={view.heatmap} onOpenDay={showDay} />
            </View>
            <View style={styles.group}>
              <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
                {t('statsScreen.trends', { term: term(2) })}
              </ThemedText>
              <SegmentedControl
                testID="stats-period"
                accessibilityLabel={t('statsScreen.period')}
                options={STATS_PERIODS.map((value) => ({
                  value,
                  label: t(`statsScreen.periods.${value}`),
                }))}
                value={period}
                onChange={setPeriod}
              />
              {anyRate ? (
                <Card testID="stats-trends">
                  {trends.map((trend, index) => (
                    <View key={trend.mission.id}>
                      {index === 0 ? null : (
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                      )}
                      <TrendRow
                        trend={trend}
                        onPress={() =>
                          router.push({
                            pathname: '/stats',
                            params: { missionId: trend.mission.id },
                          })
                        }
                      />
                    </View>
                  ))}
                </Card>
              ) : (
                <ThemedText
                  testID="stats-trends-empty"
                  color={colors.textMuted}
                  style={styles.empty}
                >
                  {t('statsScreen.trendsEmpty', { term: term(2), termOne: term(1) })}
                </ThemedText>
              )}
            </View>
          </>
        )}
      </ScrollView>
      <HeatmapDaySheet
        visible={sheetVisible}
        day={day}
        today={view.heatmap.today}
        backfill={backfill?.[0] ?? null}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

interface SummaryProps {
  readonly summary: StatsSummary;
  readonly term: (count: number) => string;
}

/** The four tiles of 8.2; a comparison line only when the change is positive. */
function Summary({ summary, term }: SummaryProps) {
  const { t } = useTranslation();
  const { family } = useTheme();
  const largeText = useLargeText();
  const positive = (change: number | null): change is number => change !== null && change > 0;

  const tiles = [
    <SummaryTile
      key="streak"
      testID="stats-streak"
      label={t('lexicon.streak', { context: family })}
      value={String(summary.streak)}
      icon="serie"
      note={
        positive(summary.streakChange)
          ? t('statsScreen.streakChange', { count: summary.streakChange })
          : undefined
      }
    />,
    <SummaryTile
      key="record"
      testID="stats-record"
      label={t('statsScreen.record')}
      value={String(summary.streakBest)}
      unit={t('statsScreen.recordUnit', { count: summary.streakBest })}
    />,
    <SummaryTile
      key="week"
      testID="stats-week"
      label={t('statsScreen.week')}
      value={String(summary.weekDone)}
      note={
        positive(summary.weekDoneChange)
          ? t('statsScreen.weekChange', {
              count: summary.weekDoneChange,
              term: term(summary.weekDoneChange),
            })
          : undefined
      }
    />,
    <SummaryTile
      key="rate"
      testID="stats-rate"
      label={t('statsScreen.rate')}
      value={summary.rate === null ? NO_VALUE : t('statsScreen.percent', { rate: summary.rate })}
      spokenValue={summary.rate === null ? t('statsScreen.noData') : undefined}
      ring={summary.rate === null ? undefined : summary.rate / 100}
      note={
        positive(summary.rateChange)
          ? t('statsScreen.rateChange', { count: summary.rateChange })
          : undefined
      }
    />,
  ];

  const columns = largeText ? 1 : 2;
  const rows = [];
  for (let index = 0; index < tiles.length; index += columns) {
    rows.push(tiles.slice(index, index + columns));
  }
  return (
    <View testID="stats-summary" style={styles.column}>
      {rows.map((row, index) => (
        <View key={index} style={styles.row}>
          {row}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, padding: 16 },
  group: { gap: 8 },
  column: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  divider: { height: StyleSheet.hairlineWidth },
  empty: { textAlign: 'center', paddingVertical: 16 },
});
