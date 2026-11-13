import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import type {
  HistoryEntry,
  MissionDetail,
  PeriodDetail,
  RateColumn,
  ValueColumn,
} from '@/db/repositories/missionDetail';
import type { Mission } from '@/db/repositories/missions';
import { STATS_PERIODS, type StatsPeriod } from '@/db/repositories/statsView';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { Difficulty } from '@/features/shared/Difficulty';
import { EmptyState } from '@/features/shared/EmptyState';
import { Icon } from '@/features/shared/Icon';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { SegmentedControl } from '@/features/shared/SegmentedControl';
import { ThemedText } from '@/features/shared/ThemedText';
import { useLargeText } from '@/features/shared/useLargeText';
import { missionIcon } from '@/features/today/missionText';
import { termInSentence } from '@/i18n/lexicon';
import { addDays } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';
import { ColumnChart, type ChartColumn } from './ColumnChart';
import { DayMarks } from './DayMarks';
import { formatDay, formatNumber } from './format';
import { SummaryTile } from './SummaryTile';

/** The value of a tile or a column with no data (8.9, mockup D29). */
const NO_VALUE = '–';

/** The ticks of the axis of the rates. */
const RATE_TICKS = [0, 50, 100];

export interface MissionDetailScreenProps {
  /** Null for a mission deleted or unknown. */
  readonly detail: MissionDetail | null;
}

/**
 * The detail of a mission (analisi-funzionale.md US-STAT-02, design-sezioni.md 8.5, 8.12,
 * mockup D31): a full screen opened from Statistics, Habits, Today and the card of a boss, with
 * Modifica at the top right; icon, frequency and difficulty; streak, record and rate in the
 * period of the selector; the chart of the period, the values of a measurable mission against
 * its goal, the history from the log and the notes.
 */
export function MissionDetailScreen({ detail }: MissionDetailScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [period, setPeriod] = useState<StatsPeriod>('week');

  if (detail === null) {
    return (
      <View testID="mission-detail" style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader
          testID="mission-detail-header"
          title={t('missionDetail.title')}
          compact
          onBack={() => router.back()}
        />
        <EmptyState testID="mission-detail-gone" message={t('missionDetail.gone')} />
      </View>
    );
  }

  const { mission } = detail;
  const habit = mission.kind === 'habit';
  const current = detail.periods[period];

  return (
    <View testID="mission-detail" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="mission-detail-header"
        title={mission.name}
        compact
        onBack={() => router.back()}
        actions={
          <Button
            testID="mission-detail-edit"
            variant="text"
            label={t('missionDetail.edit')}
            accessibilityLabel={t('missionDetail.editLabel', { name: mission.name })}
            onPress={() => router.push({ pathname: '/editor', params: { missionId: mission.id } })}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View testID="mission-detail-top" style={styles.top}>
          <Icon name={missionIcon(mission)} size={24} color={colors.text} />
          <View style={styles.topText}>
            <ThemedText testID="mission-detail-frequency" color={colors.textMuted}>
              {describeFrequency(mission.frequency, t, mission.dueDay)}
            </ThemedText>
            <Difficulty testID="mission-detail-difficulty" difficulty={mission.difficulty} />
          </View>
        </View>
        {habit ? (
          <SegmentedControl
            testID="mission-detail-period"
            accessibilityLabel={t('statsScreen.period')}
            options={STATS_PERIODS.map((value) => ({
              value,
              label: t(`statsScreen.periods.${value}`),
            }))}
            value={period}
            onChange={setPeriod}
          />
        ) : null}
        <Tiles detail={detail} period={period} />
        {current.chart.kind === 'none' ? null : (
          <Card testID="mission-detail-chart-card">
            {/* A new period starts with no column chosen and the table closed. */}
            <PeriodChart key={period} period={period} detail={current} />
          </Card>
        )}
        {current.values === null ? null : (
          <Card testID="mission-detail-values-card">
            <ValuesChart key={period} detail={detail} period={period} values={current.values} />
          </Card>
        )}
        <History mission={mission} entries={detail.history} today={detail.today} />
        {mission.notes === null || mission.notes.trim() === '' ? null : (
          <View style={styles.group}>
            <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
              {t('missionDetail.notes')}
            </ThemedText>
            <ThemedText testID="mission-detail-notes">{mission.notes}</ThemedText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

interface TilesProps {
  readonly detail: MissionDetail;
  readonly period: StatsPeriod;
}

/** Streak, record and rate in the period (8.5); a task has no streak, only its rate. */
function Tiles({ detail, period }: TilesProps) {
  const { t } = useTranslation();
  const { family } = useTheme();
  const largeText = useLargeText();
  const { mission } = detail;
  const rate = detail.periods[period].rate;
  const weekly = mission.frequency?.type === 'times_per_week';
  const unit = (count: number) =>
    t(weekly ? 'missionDetail.weeksUnit' : 'statsScreen.recordUnit', { count });

  const rateTile = (
    <SummaryTile
      key="rate"
      testID="mission-detail-rate"
      label={t(`missionDetail.rate.${period}`)}
      value={rate === null ? NO_VALUE : t('statsScreen.percent', { rate })}
      spokenValue={rate === null ? t('statsScreen.noData') : undefined}
    />
  );
  const tiles =
    mission.kind === 'task'
      ? [rateTile]
      : [
          <SummaryTile
            key="streak"
            testID="mission-detail-streak"
            label={t('lexicon.streak', { context: family })}
            value={String(mission.streak)}
            icon="serie"
            unit={unit(mission.streak)}
          />,
          <SummaryTile
            key="record"
            testID="mission-detail-record"
            label={t('statsScreen.record')}
            value={String(mission.streakBest)}
            unit={unit(mission.streakBest)}
          />,
          rateTile,
        ];
  return (
    <View testID="mission-detail-tiles" style={largeText ? styles.column : styles.row}>
      {tiles}
    </View>
  );
}

interface PeriodChartProps {
  readonly period: StatsPeriod;
  readonly detail: PeriodDetail;
}

/** Settimana: a cell per day; Mese and Anno: the rate by week or by month (8.5, gap L15). */
function PeriodChart({ period, detail }: PeriodChartProps) {
  const { t, i18n } = useTranslation();
  const { chart } = detail;
  const title = t(`missionDetail.chart.${period}`);
  if (chart.kind === 'days') {
    return <DayMarks testID="mission-detail-days" title={title} columns={chart.columns} />;
  }
  if (chart.kind === 'none') {
    return null;
  }
  const columns = chart.columns.map((column): ChartColumn => {
    const { label, spoken } = rateColumnWords(column, period, i18n.language, t);
    return {
      key: column.from,
      label,
      spoken,
      value: column.rate,
      text: column.rate === null ? NO_VALUE : t('statsScreen.percent', { rate: column.rate }),
    };
  });
  return (
    <ColumnChart
      testID="mission-detail-rates"
      title={title}
      columns={columns}
      max={100}
      ticks={RATE_TICKS.map((value) => ({
        value,
        text: t('statsScreen.percent', { rate: value }),
      }))}
      description={describeChart(title, columns, t)}
    />
  );
}

/** «9/11» and «settimana del 9 novembre», or «nov» and «novembre 2026». */
function rateColumnWords(
  column: RateColumn,
  period: StatsPeriod,
  language: string,
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (period === 'year') {
    return {
      label: formatDay(column.from, language, { month: 'narrow' }),
      spoken: formatDay(column.from, language, { month: 'long', year: 'numeric' }),
    };
  }
  return {
    label: formatDay(column.from, language, { day: 'numeric', month: 'numeric' }),
    spoken: t('missionDetail.weekOf', {
      day: formatDay(column.from, language, { day: 'numeric', month: 'long' }),
    }),
  };
}

/** «Percentuale per settimana. Da 40% a 80%: minimo 40%, massimo 100%.» (8.12) */
function describeChart(
  title: string,
  columns: readonly ChartColumn[],
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const known = columns.filter(
    (column): column is ChartColumn & { value: number } => column.value !== null,
  );
  if (known.length === 0) {
    return t('missionDetail.chartEmpty', { title });
  }
  const byValue = [...known].sort((a, b) => a.value - b.value);
  return t('missionDetail.chartSummary', {
    title,
    first: known[0].text,
    last: known[known.length - 1].text,
    min: byValue[0].text,
    max: byValue[byValue.length - 1].text,
  });
}

/** «1,25 L»: a value of a measurable mission with its unit. */
function useAmount(mission: Mission): (value: number) => string {
  const { t, i18n } = useTranslation();
  const unitKey = mission.goalUnit ?? '';
  return (value) =>
    t('missionDetail.amount', {
      value: formatNumber(value, i18n.language),
      unit: t(`missionDetail.units.${unitKey}`, { defaultValue: unitKey }),
    });
}

interface ValuesChartProps {
  readonly detail: MissionDetail;
  readonly period: StatsPeriod;
  readonly values: readonly ValueColumn[];
}

/** The value of every day (of every month in Anno) with the dashed line of the goal (8.5). */
function ValuesChart({ detail, period, values }: ValuesChartProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { mission } = detail;
  const target = mission.goalTarget ?? 0;
  const amount = useAmount(mission);
  const title = t(`missionDetail.values.${period}`);
  const daily = period !== 'year';
  // Labels on the first day and every 7 days, so that 30 columns stay readable.
  const columns = values.map((column, index): ChartColumn => {
    const labelled = !daily || values.length <= 7 || (values.length - 1 - index) % 7 === 0;
    const label = !labelled
      ? ''
      : daily
        ? formatDay(
            column.from,
            i18n.language,
            values.length <= 7 ? { weekday: 'narrow' } : { day: 'numeric' },
          )
        : formatDay(column.from, i18n.language, { month: 'narrow' });
    return {
      key: column.from,
      label,
      spoken: daily
        ? formatDay(column.from, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })
        : formatDay(column.from, i18n.language, { month: 'long', year: 'numeric' }),
      value: column.value,
      text: column.value === null ? NO_VALUE : amount(column.value),
    };
  });
  const highest = Math.max(target, ...values.map((column) => column.value ?? 0));
  const ticks = [0, target, ...(highest > target ? [highest] : [])].map((value) => ({
    value,
    text: formatNumber(value, i18n.language),
  }));
  const average = detail.periods[period].average;
  return (
    <View style={styles.group}>
      <ColumnChart
        testID="mission-detail-values"
        title={title}
        columns={columns}
        max={highest}
        ticks={ticks}
        goal={{ value: target, text: amount(target) }}
        description={`${describeChart(title, columns, t)} ${t('missionDetail.goal', {
          target: amount(target),
        })}`}
      />
      <ThemedText testID="mission-detail-average" color={colors.textMuted}>
        {average === null
          ? t('missionDetail.goal', { target: amount(target) })
          : t('missionDetail.average', { value: amount(average), target: amount(target) })}
      </ThemedText>
    </View>
  );
}

interface HistoryProps {
  readonly mission: Mission;
  readonly entries: readonly HistoryEntry[];
  readonly today: GameDay;
}

/** The entries of the log of the mission, the latest first (8.5, 8.6). */
function History({ mission, entries, today }: HistoryProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const amount = useAmount(mission);
  const dayWords = (day: GameDay) => {
    if (day === today) {
      return t('missionDetail.today');
    }
    if (day === addDays(today, -1)) {
      return t('missionDetail.yesterday');
    }
    return formatDay(day, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const gains = (entry: HistoryEntry) =>
    [
      entry.xp > 0
        ? t('missionDetail.xp', { xp: entry.xp, xpTerm: t('lexicon.xp_pl', { context: family }) })
        : null,
      entry.coins > 0
        ? t('missionDetail.coins', {
            coins: entry.coins,
            coinsTerm: termInSentence(t('lexicon.coins_pl', { context: family }), i18n.language),
          })
        : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' · ');
  const what = (entry: HistoryEntry) => {
    const kind = t(`missionDetail.history.${entry.type.slice('mission.'.length)}`);
    return entry.type === 'mission.progressed' && entry.value !== null
      ? t('missionDetail.progressed', { kind, value: amount(entry.value) })
      : kind;
  };

  return (
    <View style={styles.group}>
      <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
        {t('missionDetail.historyTitle')}
      </ThemedText>
      {entries.length === 0 ? (
        <ThemedText testID="mission-detail-history-empty" color={colors.textMuted}>
          {t('missionDetail.historyEmpty')}
        </ThemedText>
      ) : (
        <Card testID="mission-detail-history">
          {entries.map((entry, index) => (
            <View
              key={entry.id}
              testID={`mission-detail-history-${index}`}
              accessible
              accessibilityLabel={[dayWords(entry.gameDay), what(entry), gains(entry)]
                .filter((part) => part !== '')
                .join('. ')}
              style={[
                styles.entry,
                index === 0 ? null : { borderTopColor: colors.border, borderTopWidth: 1 },
              ]}
            >
              <View style={styles.entryText}>
                <ThemedText>{what(entry)}</ThemedText>
                <ThemedText variant="caption" color={colors.textMuted}>
                  {dayWords(entry.gameDay)}
                </ThemedText>
              </View>
              <ThemedText variant="numbers" color={colors.textMuted}>
                {gains(entry)}
              </ThemedText>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, padding: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topText: { flex: 1, gap: 4 },
  group: { gap: 8 },
  row: { flexDirection: 'row', gap: 12 },
  column: { gap: 12 },
  entry: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
  },
  entryText: { flexShrink: 1, gap: 2 },
});
