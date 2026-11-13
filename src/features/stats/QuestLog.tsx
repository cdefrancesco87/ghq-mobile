import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  QUEST_LOG_FILTERS,
  type QuestLogEntry,
  type QuestLogFilter,
  type QuestLogType,
} from '@/db/repositories/questLog';
import { undoEvent, UndoRefusedError } from '@/db/repositories/undo';
import { useBadgeTexts } from '@/features/shared/badgeTexts';
import { ActionSheet } from '@/features/shared/ActionSheet';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Chip } from '@/features/shared/Chip';
import { ConfirmDialog } from '@/features/shared/ConfirmDialog';
import { EmptyState } from '@/features/shared/EmptyState';
import { Icon } from '@/features/shared/Icon';
import { Sheet, SHEET_DURATION_MS } from '@/features/shared/Sheet';
import type { IconName } from '@/features/shared/icons';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { useUndoToast } from '@/features/shared/UndoToast';
import { useEssential } from '@/features/shared/useGameMode';
import { termInSentence } from '@/i18n/lexicon';
import { QUEST_LOG } from '@/rules/config';
import { addDays } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';
import { runAction } from '@/stores/app';
import { useTheme } from '@/theme/ThemeProvider';
import { BackfillPicker } from './BackfillPicker';
import { longDay } from './HeatmapDaySheet';
import { NO_RANGE, QuestLogFilterSheet, type QuestLogRange } from './QuestLogFilterSheet';
import { useBackfillCandidates } from './useBackfillCandidates';
import { useQuestLog } from './useQuestLog';
import { usePastWeeklyRecaps } from './useWeeklyRecap';
import { WeeklyRecapCard } from './WeeklyRecapCard';

const ICONS: Record<QuestLogType, IconName> = {
  'mission.completed': 'completa',
  'mission.progressed': 'quantita',
  'mission.backfilled': 'calendario',
  'mission.skipped': 'salta',
  'boss.step_done': 'spada',
  'boss.defeated': 'trofeo',
  'boss.deadline_missed': 'moneta',
  'item.bought': 'negozio',
  'item.used': 'pozione',
  'shield.consumed': 'scudo',
  'reward.redeemed': 'regalo',
  'hero.level_up': 'livello',
  'badge.unlocked': 'badge',
  'bonus.full_day': 'esperienza',
  'bonus.plan': 'esperienza',
  'day.closed': 'cuore',
};

/** Entries written when the app opens, not when the user acted: no time next to them. */
const WITHOUT_TIME: readonly QuestLogType[] = ['day.closed', 'boss.deadline_missed'];

/** The key of a type in `questLog.kinds`. */
const kindKey = (type: QuestLogType) => type.replace('.', '_');

/**
 * The Registro of Statistics (design-sezioni.md 8.6, mockup D32): the chips Tutto, Completamenti,
 * Salti, Boss and Oggetti with «Filtra» for a mission and the days, the entries grouped by day
 * with the icon of the type, the text in the lexicon of the theme and what they gave on the right.
 * A completion, a skip or a step of today is undone from the menu of its entry, with a
 * confirmation (the rules of T40). «+ Completamento dimenticato» completes afterwards a mission of
 * the last 7 days (US-STAT-03), shown only when there is one. In the Essential mode (8.11) no
 * entries of health, bosses, coins and shop, and no chips Boss and Oggetti: only the experience.
 * «Riepiloghi passati» opens the weekly recaps before the one of the Overview (8.7, T81).
 */
export function QuestLog() {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const badgeTexts = useBadgeTexts();
  const toast = useUndoToast();
  const essential = useEssential();
  const [chosenFilter, setFilter] = useState<QuestLogFilter>('all');
  const filters = QUEST_LOG_FILTERS.filter(
    (key) => !essential || (key !== 'bosses' && key !== 'items'),
  );
  // A chip hidden by the Essential mode falls back to Tutto.
  const filter = filters.includes(chosenFilter) ? chosenFilter : 'all';
  const [range, setRange] = useState<QuestLogRange>(NO_RANGE);
  const [limit, setLimit] = useState<number>(QUEST_LOG.pageSize);
  const [filterVisible, setFilterVisible] = useState(false);
  const [menu, setMenu] = useState<QuestLogEntry | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [queued, setQueued] = useState<QuestLogEntry | null>(null);
  const [confirming, setConfirming] = useState<QuestLogEntry | null>(null);
  const [backfillVisible, setBackfillVisible] = useState(false);
  // A new key at every opening: the choice of the previous one is forgotten.
  const [backfillKey, setBackfillKey] = useState(0);
  const view = useQuestLog({ filter, ...range, limit, essential });
  const backfill = useBackfillCandidates();
  const pastRecaps = usePastWeeklyRecaps(true);
  const [recapsVisible, setRecapsVisible] = useState(false);

  // The dialog opens once the menu has slid away: two modals at once do not open on iOS.
  useEffect(() => {
    if (queued === null || menuVisible) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setConfirming(queued);
      setQueued(null);
    }, SHEET_DURATION_MS);
    return () => clearTimeout(timer);
  }, [queued, menuVisible]);

  if (view === null) {
    return null;
  }

  const ranged = range.missionId !== null || range.from !== null || range.to !== null;
  const lexicon = (key: string) => t(`lexicon.${key}`, { context: family });
  const inSentence = (key: string) => termInSentence(lexicon(key), i18n.language);

  const dayTitle = (day: GameDay) => {
    if (day === view.today) {
      return t('questLog.today');
    }
    if (day === addDays(view.today, -1)) {
      return t('questLog.yesterday');
    }
    return longDay(day, i18n.language);
  };

  const title = (entry: QuestLogEntry): string => {
    switch (entry.type) {
      case 'mission.completed':
      case 'mission.progressed':
      case 'mission.backfilled':
      case 'mission.skipped':
        return entry.missionName ?? '';
      case 'boss.step_done':
      case 'boss.defeated':
      case 'boss.deadline_missed':
        return entry.bossStarter
          ? t('starter_quest.name', { context: family })
          : (entry.bossName ?? '');
      case 'item.bought':
      case 'item.used':
      case 'shield.consumed':
        return entry.itemKey === 'potion' || entry.itemKey === 'shield'
          ? lexicon(entry.itemKey)
          : (entry.itemKey ?? '');
      case 'badge.unlocked': {
        const badge = badgeTexts.find(entry.itemKey ?? '');
        return badge === undefined ? t('questLog.titles.badge_unlocked') : badgeTexts.nameOf(badge);
      }
      case 'hero.level_up':
        return t('questLog.level', { term: lexicon('level'), level: entry.level ?? '' });
      case 'reward.redeemed':
        return entry.rewardName ?? t('questLog.titles.reward_redeemed');
      case 'bonus.full_day':
        return lexicon('fullDay');
      case 'bonus.plan':
        return lexicon('dayPlan');
      default:
        return t(`questLog.titles.${kindKey(entry.type)}`);
    }
  };

  const detail = (entry: QuestLogEntry): string => {
    const kind =
      entry.type === 'mission.skipped' && entry.reason !== null
        ? t('questLog.withReason', {
            kind: t('questLog.kinds.mission_skipped'),
            reason: t(`today.skip.reasons.${entry.reason}`),
          })
        : t(`questLog.kinds.${kindKey(entry.type)}`);
    return WITHOUT_TIME.includes(entry.type)
      ? kind
      : t('questLog.detail', { kind, time: entry.time });
  };

  const gains = (entry: QuestLogEntry): string => {
    const signed = (value: number) => (value > 0 ? `+${value}` : `−${-value}`);
    return [
      entry.xp === 0
        ? null
        : t('questLog.amount', { value: signed(entry.xp), term: lexicon('xp_pl') }),
      entry.coins === 0 || essential
        ? null
        : t('questLog.amount', { value: signed(entry.coins), term: inSentence('coins_pl') }),
      entry.hp === 0 || essential
        ? null
        : t('questLog.amount', { value: signed(entry.hp), term: inSentence('hp') }),
      entry.damage === null || essential ? null : t('questLog.damage', { count: entry.damage }),
    ]
      .filter((part): part is string => part !== null)
      .join(' · ');
  };

  const undo = (entry: QuestLogEntry) => {
    // A skip is never refused for a boss: its texts have no `bossNotActive`.
    const texts = entry.type === 'mission.skipped' ? 'skip' : 'missions';
    try {
      runAction((db, clock) => undoEvent(db, entry.id, clock));
      toast.show({ message: t('questLog.undone') });
    } catch (error) {
      if (!(error instanceof UndoRefusedError)) {
        toast.show({ message: t('today.missions.errors.failed') });
        return;
      }
      const reasons = {
        day_changed: 'dayChanged',
        coins_spent: 'coinsSpent',
        already_undone: 'alreadyUndone',
        boss_not_active: 'bossNotActive',
      } as const;
      toast.show({ message: t(`today.${texts}.errors.${reasons[error.reason]}`) });
    }
  };

  const empty = view.days.length === 0;

  return (
    <View style={styles.log}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={t('questLog.filtersLabel')}
        contentContainerStyle={styles.chips}
      >
        {filters.map((key) => (
          <Chip
            key={key}
            testID={`stats-log-chip-${key}`}
            label={key === 'bosses' ? lexicon('boss_pl') : t(`questLog.filters.${key}`)}
            selected={filter === key}
            onPress={() => {
              setFilter(key);
              setLimit(QUEST_LOG.pageSize);
            }}
          />
        ))}
        <Chip
          testID="stats-log-filter-open"
          label={t('questLog.filter')}
          accessibilityLabel={ranged ? t('questLog.filterActive') : t('questLog.filter')}
          icon="filtro"
          selected={ranged}
          onPress={() => setFilterVisible(true)}
        />
      </ScrollView>
      {backfill !== null && backfill.length > 0 ? (
        <Button
          testID="stats-log-backfill"
          variant="secondary"
          label={t('backfill.open')}
          onPress={() => {
            setBackfillKey(backfillKey + 1);
            setBackfillVisible(true);
          }}
        />
      ) : null}
      {pastRecaps.length > 0 ? (
        <Button
          testID="stats-log-recaps"
          variant="secondary"
          label={t('statsScreen.recap.past')}
          onPress={() => setRecapsVisible(true)}
        />
      ) : null}
      {empty ? (
        <EmptyState
          testID={ranged || filter !== 'all' ? 'stats-log-empty-filtered' : 'stats-log-empty'}
          message={ranged || filter !== 'all' ? t('questLog.emptyFiltered') : t('questLog.empty')}
          actionLabel={ranged ? t('questLog.reset') : undefined}
          onAction={ranged ? () => setRange(NO_RANGE) : undefined}
        />
      ) : (
        view.days.map((day) => (
          <View key={day.day} testID={`stats-log-day-${day.day}`} style={styles.group}>
            <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
              {dayTitle(day.day)}
            </ThemedText>
            <Card style={styles.card}>
              {day.entries.map((entry, index) => {
                const what = gains(entry);
                const label = [title(entry), detail(entry), what]
                  .filter((part) => part !== '')
                  .join('. ');
                return (
                  <Pressable
                    key={entry.id}
                    testID={`stats-log-entry-${entry.id}`}
                    disabled={!entry.undoable}
                    onPress={() => {
                      setMenu(entry);
                      setMenuVisible(true);
                    }}
                    accessible
                    accessibilityRole={entry.undoable ? 'button' : 'text'}
                    accessibilityLabel={label}
                    accessibilityHint={entry.undoable ? t('questLog.menuHint') : undefined}
                    style={[
                      styles.entry,
                      index === 0
                        ? null
                        : {
                            borderTopColor: colors.border,
                            borderTopWidth: StyleSheet.hairlineWidth,
                          },
                    ]}
                  >
                    <Icon name={ICONS[entry.type]} size={20} color={colors.textMuted} />
                    <View style={styles.entryText}>
                      <ThemedText testID={`stats-log-title-${entry.id}`}>{title(entry)}</ThemedText>
                      <ThemedText variant="caption" color={colors.textMuted}>
                        {detail(entry)}
                      </ThemedText>
                    </View>
                    {what === '' ? null : (
                      <ThemedText
                        testID={`stats-log-gains-${entry.id}`}
                        variant="numbers"
                        color={colors.textMuted}
                        style={styles.gains}
                      >
                        {what}
                      </ThemedText>
                    )}
                    {entry.undoable ? (
                      <Icon name="altro" size={20} color={colors.textMuted} />
                    ) : null}
                  </Pressable>
                );
              })}
            </Card>
          </View>
        ))
      )}
      {view.hasMore ? (
        <Button
          testID="stats-log-more"
          variant="secondary"
          label={t('questLog.more')}
          onPress={() => setLimit(limit + QUEST_LOG.pageSize)}
        />
      ) : null}
      <QuestLogFilterSheet
        visible={filterVisible}
        value={range}
        missions={view.missions}
        today={view.today}
        onApply={(value) => {
          setRange(value);
          setLimit(QUEST_LOG.pageSize);
          setFilterVisible(false);
        }}
        onClose={() => setFilterVisible(false)}
      />
      <Sheet
        testID="stats-backfill"
        visible={backfillVisible}
        onClose={() => setBackfillVisible(false)}
        size="full"
        title={t('backfill.title')}
      >
        <BackfillPicker
          key={backfillKey}
          days={backfill ?? []}
          today={view.today}
          onDone={() => setBackfillVisible(false)}
        />
      </Sheet>
      <Sheet
        testID="stats-recaps"
        visible={recapsVisible}
        onClose={() => setRecapsVisible(false)}
        size="full"
        title={t('statsScreen.recap.pastTitle')}
      >
        <ScrollView contentContainerStyle={styles.recaps}>
          {pastRecaps.map((recap) => (
            <WeeklyRecapCard
              key={recap.lastDay}
              testID={`stats-recaps-${recap.lastDay}`}
              view={recap}
            />
          ))}
        </ScrollView>
      </Sheet>
      <ActionSheet
        testID="stats-log-menu"
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title={menu === null ? undefined : title(menu)}
        items={[
          {
            key: 'undo',
            label: t('questLog.undo'),
            destructive: true,
            onPress: () => setQueued(menu),
          },
        ]}
      />
      <ConfirmDialog
        testID="stats-log-undo"
        visible={confirming !== null}
        title={t('questLog.undoTitle', { name: confirming === null ? '' : title(confirming) })}
        message={t('questLog.undoMessage')}
        confirmLabel={t('questLog.undoConfirm')}
        cancelLabel={t('questLog.keep')}
        onConfirm={() => {
          const entry = confirming;
          setConfirming(null);
          if (entry !== null) {
            undo(entry);
          }
        }}
        onCancel={() => setConfirming(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  log: { gap: 16 },
  recaps: { gap: 12, paddingBottom: 16 },
  chips: { gap: 8, paddingVertical: 4 },
  group: { gap: 8 },
  card: { paddingVertical: 0 },
  entry: {
    minHeight: MIN_TOUCH + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  entryText: { flex: 1, gap: 2 },
  gains: { flexShrink: 1, textAlign: 'right' },
});
