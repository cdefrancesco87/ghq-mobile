import { Stack, useNavigation, usePreventRemove, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listActiveBosses } from '@/db/repositories/boss';
import {
  archiveMission,
  createMission,
  deleteMission,
  getMission,
  isMissionNameTaken,
  listTodayMissions,
  missionReminderTimes,
  restoreMission,
  updateMission,
} from '@/db/repositories/missions';
import { gameDayOf, getSetting } from '@/db/repositories/settings';
import { useBossTexts } from '@/features/bosses/bossTexts';
import { systemScheduler } from '@/features/notifications/system';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { ConfirmDialog } from '@/features/shared/ConfirmDialog';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { Difficulty } from '@/features/shared/Difficulty';
import { formatAmount } from '@/features/shared/amount';
import { formatClock } from '@/features/shared/formatClock';
import { Icon } from '@/features/shared/Icon';
import { statIcon } from '@/features/shared/icons';
import { SegmentedControl } from '@/features/shared/SegmentedControl';
import { ThemedText } from '@/features/shared/ThemedText';
import { useLargeText } from '@/features/shared/useLargeText';
import { useUndoToast } from '@/features/shared/UndoToast';
import { completionDeltas } from '@/rules/completion';
import { DIFFICULTIES, STAT_KEYS, type Difficulty as Level, type StatKey } from '@/rules/types';
import { runAction } from '@/stores/app';
import { useHighlightStore } from '@/stores/highlight';
import { getSession } from '@/stores/session';
import { textStyleOf } from '@/theme/fonts';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { BossSheet } from './BossSheet';
import { ChoiceButton } from './ChoiceButton';
import {
  draftOf,
  goalOf,
  hasAdvancedValues,
  missionInput,
  newDraft,
  sameDraft,
  type Draft,
} from './draft';
import { DueDaySheet } from './DueDaySheet';
import { FrequencySheet } from './FrequencySheet';
import { GoalSheet } from './GoalField';
import { OptionRow } from './OptionRow';
import { RemindersSheet } from './RemindersSheet';

/** Past this length the name shows how many characters it has (design-sezioni.md 4.2). */
export const NAME_COUNTER_FROM = 60;
const NAME_LINES = 2;
const NAME_MIN_HEIGHT = 56;
const STAT_SIZE = 52;

// The same objects at every render: new options would be set again and again (4.1, 4.15).
const HALF_SHEET = { sheetAllowedDetents: [0.5, 1] };
const FULL_SHEET = { sheetAllowedDetents: [1] };

type OptionSheet = 'frequency' | 'due' | 'reminders' | 'boss' | 'goal';
type Dialog = 'discard' | 'delete';

/** Base values, without the streak multiplier: the preview never promises XP that can change (4.10). */
function baseRewards(difficulty: Level, stat: StatKey | null) {
  return completionDeltas({
    difficulty,
    heroStreak: 0,
    exhausted: false,
    statPrimary: stat,
    statSecondary: null,
  });
}

/** Cancels on the phone the reminders of a mission that is gone; a leftover is only a nuisance. */
function cancelNotifications(ids: readonly string[]): void {
  if (ids.length > 0) {
    void systemScheduler.cancel([...ids]).catch(() => undefined);
  }
}

export interface MissionEditorProps {
  /** The mission to edit; a new mission when missing. */
  readonly missionId?: string;
  /** The boss already linked, when the editor is opened from a boss (design-sezioni.md 4.1). */
  readonly bossId?: string;
}

/**
 * The mission editor (design-sezioni.md 4.1–4.6, 4.8–4.10, 4.12, 4.15; mockups B5, D13–D16): name
 * with the keyboard open, type, difficulty and main stat, «Altre opzioni» with frequency or due day,
 * reminders and linked boss, then the bar with the preview of the rewards and Save. The name alone
 * and Enter save a daily medium habit (US-EDT-01). Editing opens at full height, with Archive,
 * Delete and «Vale dai prossimi completamenti»; closing with changes asks «Scartare le modifiche?».
 */
export function MissionEditor({ missionId, bossId }: MissionEditorProps) {
  const { t, i18n } = useTranslation();
  const { colors, family, typography } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useUndoToast();
  const highlight = useHighlightStore((state) => state.highlight);
  const clearHighlight = useHighlightStore((state) => state.clear);
  const large = useLargeText();
  const { nameOf } = useBossTexts();
  const { bottom } = useSafeAreaInsets();
  const { db } = getSession();
  const [initial] = useState<Draft | null>(() => {
    if (missionId === undefined) {
      return newDraft(bossId ?? null);
    }
    const mission = getMission(db, missionId);
    return mission === null ? null : draftOf(mission, missionReminderTimes(db, missionId));
  });
  const editing = missionId !== undefined;
  const [draft, setDraft] = useState<Draft>(() => initial ?? newDraft(null));
  const [expanded, setExpanded] = useState(
    () => editing && initial !== null && hasAdvancedValues(initial),
  );
  const [sheet, setSheet] = useState<OptionSheet | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [failed, setFailed] = useState(false);
  // Enter and Save, or two quick taps, would otherwise save twice.
  const saving = useRef(false);
  // How the editor closes once saved, archived, deleted or discarded.
  const [closing, setClosing] = useState<(() => void) | null>(null);
  const pendingClose = useRef<(() => void) | null>(null);

  const dirty = initial !== null && !sameDraft(draft, initial);
  const onLeave = useCallback(
    ({ data }: { data: { action: Parameters<typeof navigation.dispatch>[0] } }) => {
      pendingClose.current = () => navigation.dispatch(data.action);
      setDialog('discard');
    },
    [navigation],
  );
  // The question is lifted first, then the editor closes in the next render: closing while it is
  // still asked would be stopped again.
  usePreventRemove(dirty && closing === null, onLeave);
  useEffect(() => {
    closing?.();
  }, [closing]);

  const update = (changes: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setFailed(false);
  };

  const trimmed = draft.name.trim();
  const taken = useMemo(
    () =>
      isMissionNameTaken(db, draft.name) &&
      draft.name.trim().toLocaleLowerCase() !== initial?.name.trim().toLocaleLowerCase(),
    [db, draft.name, initial],
  );
  const bosses = useMemo(() => listActiveBosses(db), [db]);
  const rewards = baseRewards(draft.difficulty, draft.statPrimary);
  const xpTerm = t('lexicon.xp_pl', { context: family });
  const coinsTerm = t('lexicon.coins_pl', { context: family });
  const statName = (key: StatKey) => t(`stats.${key}`, { context: family });
  const habit = draft.kind === 'habit';
  const full = large || editing || expanded;
  const title = editing
    ? t('lexicon.editMission', { context: family })
    : t(habit ? 'editor.newHabit' : 'editor.newTask', { context: family });
  const shape = SHAPES[family].control;
  const radius = shape.kind === 'rounded' ? shape.radius : 0;
  const clockNow = getSession().clock();
  const today = gameDayOf(clockNow.now, clockNow.tzOffset, getSetting(db, 'day_change'));

  const close = () => setClosing(() => () => router.back());

  const save = () => {
    if (trimmed === '' || saving.current || initial === null) {
      return;
    }
    saving.current = true;
    const input = missionInput(draft);
    let saved;
    try {
      saved = runAction((tx, clock) => {
        const { kind: _kind, reminders, ...fields } = input;
        // The reminder rows are written again only when the times changed.
        const sameTimes = JSON.stringify(draft.reminders) === JSON.stringify(initial.reminders);
        const mission =
          missionId === undefined
            ? createMission(tx, input, clock)
            : updateMission(tx, missionId, sameTimes ? fields : { ...fields, reminders }, clock);
        const day = gameDayOf(clock.now, clock.tzOffset, getSetting(tx, 'day_change'));
        return {
          id: mission.id,
          inToday: listTodayMissions(tx, day).some((m) => m.id === mission.id),
        };
      });
    } catch {
      saving.current = false;
      setFailed(true);
      return;
    }
    close();
    if (editing) {
      return;
    }
    const { id, inToday } = saved;
    // Only a row that Today shows can be highlighted: a task without a due day is not there.
    if (inToday) {
      highlight(id);
    }
    toast.show({
      message: t('editor.created'),
      onUndo: () => {
        clearHighlight();
        try {
          cancelNotifications(
            runAction((tx, clock) => deleteMission(tx, id, clock)).cancelledNotificationIds,
          );
        } catch {
          toast.show({ message: t('today.missions.errors.failed') });
        }
      },
    });
  };

  const archive = () => {
    if (missionId === undefined) {
      return;
    }
    setFailed(false);
    try {
      runAction((tx, clock) => archiveMission(tx, missionId, clock));
    } catch {
      setFailed(true);
      return;
    }
    close();
    toast.show({
      message: t('editor.archived'),
      onUndo: () => {
        try {
          runAction((tx, clock) => restoreMission(tx, missionId, clock));
        } catch {
          toast.show({ message: t('today.missions.errors.failed') });
        }
      },
    });
  };

  const remove = () => {
    setDialog(null);
    if (missionId === undefined) {
      return;
    }
    setFailed(false);
    try {
      cancelNotifications(
        runAction((tx, clock) => deleteMission(tx, missionId, clock)).cancelledNotificationIds,
      );
    } catch {
      setFailed(true);
      return;
    }
    close();
  };

  if (initial === null) {
    // The mission was deleted while the editor was opening.
    return (
      <View
        testID="editor"
        style={[styles.screen, styles.missing, { backgroundColor: colors.surfaceHigh }]}
      >
        <ThemedText>{t('editor.missing')}</ThemedText>
      </View>
    );
  }

  const reward = [
    t('editor.rewardXp', { xp: rewards.xp, term: xpTerm }),
    t('editor.rewardCoins', { coins: rewards.coins, term: coinsTerm }),
    ...(draft.statPrimary === null
      ? []
      : [
          t('editor.rewardStat', {
            points: rewards.stats[draft.statPrimary] ?? 0,
            stat: statName(draft.statPrimary),
          }),
        ]),
  ].join(' · ');

  const linked = bosses.find((item) => item.id === draft.bossId);
  const goal = goalOf(draft.goal);
  const goalText =
    goal === null || goal.type === 'none'
      ? t('editor.goal.yesNo')
      : goal.type === 'quantity'
        ? formatAmount(goal.target, goal.unit, i18n.language)
        : formatAmount(goal.target, 'minute', i18n.language);
  const options = (
    <Card testID="editor-options">
      {habit ? (
        <OptionRow
          testID="editor-option-frequency"
          icon="ripeti"
          label={t('editor.frequency')}
          value={describeFrequency(draft.frequency, t)}
          onPress={() => setSheet('frequency')}
        />
      ) : (
        <OptionRow
          testID="editor-option-due"
          icon="calendario"
          label={t('editor.dueDay')}
          value={describeFrequency(null, t, draft.dueDay)}
          onPress={() => setSheet('due')}
        />
      )}
      {habit ? (
        <OptionRow
          testID="editor-option-reminders"
          icon="promemoria"
          label={t('editor.reminders')}
          value={
            draft.reminders.length === 0
              ? t('editor.noReminders')
              : draft.reminders.map((time) => formatClock(time, i18n.language)).join(', ')
          }
          onPress={() => setSheet('reminders')}
        />
      ) : null}
      <OptionRow
        testID="editor-option-goal"
        icon="statistiche"
        label={t('editor.goal.title')}
        value={goalText}
        onPress={() => setSheet('goal')}
      />
      <OptionRow
        testID="editor-option-boss"
        icon="boss"
        label={t('editor.linkedBoss', { context: family })}
        value={linked === undefined ? t('editor.none') : nameOf(linked)}
        onPress={() => setSheet('boss')}
      />
    </Card>
  );

  return (
    <KeyboardAvoidingView
      testID="editor"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.surfaceHigh }]}
    >
      <Stack.Screen options={full ? FULL_SHEET : HALF_SHEET} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText variant="sectionTitle" accessibilityRole="header">
          {title}
        </ThemedText>
        <View style={styles.field}>
          <TextInput
            testID="editor-name"
            value={draft.name}
            onChangeText={(name) => update({ name })}
            autoFocus={!editing}
            multiline
            numberOfLines={NAME_LINES}
            submitBehavior="submit"
            returnKeyType="done"
            onSubmitEditing={save}
            placeholder={t('editor.namePlaceholder', { context: family })}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('editor.name')}
            style={[
              textStyleOf(typography.sectionTitle),
              styles.name,
              { color: colors.text, borderColor: colors.textMuted, borderRadius: radius },
            ]}
          />
          {trimmed.length > NAME_COUNTER_FROM ? (
            <ThemedText testID="editor-name-count" variant="caption" color={colors.textMuted}>
              {t('editor.nameCount', { count: trimmed.length })}
            </ThemedText>
          ) : null}
          {taken ? (
            <ThemedText testID="editor-name-taken" variant="caption" color={colors.textMuted}>
              {t('editor.nameTaken')}
            </ThemedText>
          ) : null}
        </View>
        {/* The type of a saved mission stays: its history depends on it. */}
        {editing ? null : (
          <SegmentedControl
            testID="editor-kind"
            accessibilityLabel={t('editor.kind')}
            value={draft.kind}
            onChange={(kind) => update({ kind })}
            options={[
              { value: 'habit', label: t('editor.habit') },
              { value: 'task', label: t('editor.task') },
            ]}
          />
        )}
        <View style={styles.field}>
          <ThemedText variant="label" color={colors.textMuted}>
            {t('editor.difficulty')}
          </ThemedText>
          <View
            testID="editor-difficulty"
            accessibilityRole="radiogroup"
            accessibilityLabel={t('editor.difficulty')}
            style={large ? styles.column : styles.row}
          >
            {DIFFICULTIES.map((level, index) => (
              <ChoiceButton
                key={level}
                testID={`editor-difficulty-${level}`}
                selected={level === draft.difficulty}
                onPress={() => update({ difficulty: level })}
                accessibilityLabel={t('editor.difficultyLabel', {
                  name: t(`shared.difficulty.${level}`),
                  xp: baseRewards(level, null).xp,
                  term: xpTerm,
                  position: index + 1,
                  total: DIFFICULTIES.length,
                })}
                style={large ? undefined : styles.flex}
              >
                {(color) => <Difficulty difficulty={level} color={color} />}
              </ChoiceButton>
            ))}
          </View>
          {editing && draft.difficulty !== initial.difficulty ? (
            <ThemedText testID="editor-difficulty-note" variant="caption" color={colors.textMuted}>
              {t('editor.fromNextCompletions')}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.field}>
          <ThemedText variant="label" color={colors.textMuted}>
            {draft.statPrimary === null
              ? t('editor.stat')
              : t('editor.statChosen', { stat: statName(draft.statPrimary) })}
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={t('editor.stat')}
              style={styles.stats}
            >
              {STAT_KEYS.map((key, index) => (
                <ChoiceButton
                  key={key}
                  testID={`editor-stat-${key}`}
                  selected={key === draft.statPrimary}
                  onPress={() => update({ statPrimary: key })}
                  accessibilityLabel={t('editor.statLabel', {
                    stat: statName(key),
                    position: index + 1,
                    total: STAT_KEYS.length,
                  })}
                  style={styles.stat}
                >
                  {(color) => <Icon name={statIcon(key)} size={20} color={color} />}
                </ChoiceButton>
              ))}
            </View>
          </ScrollView>
          {draft.statPrimary === null ? (
            <ThemedText testID="editor-stat-missing" variant="caption" color={colors.textMuted}>
              {t('editor.statMissing')}
            </ThemedText>
          ) : null}
        </View>
        <Pressable
          testID="editor-more"
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((open) => !open)}
          style={styles.more}
        >
          <ThemedText style={styles.flex}>{t('editor.moreOptions')}</ThemedText>
          <Icon name={expanded ? 'freccia-su' : 'freccia-giu'} size={20} color={colors.textMuted} />
        </Pressable>
        {expanded ? options : null}
        {editing ? (
          <View style={styles.actions}>
            <Button
              testID="editor-archive"
              variant="secondary"
              label={t('editor.archive')}
              onPress={archive}
            />
            {/* Text in the danger colour, with a dialog: the history is lost (4.12). */}
            <Pressable
              testID="editor-delete"
              accessibilityRole="button"
              onPress={() => setDialog('delete')}
              style={styles.delete}
            >
              <ThemedText variant="label" color={colors.dangerText}>
                {t('editor.delete')}
              </ThemedText>
            </Pressable>
          </View>
        ) : null}
        {failed ? (
          <ThemedText testID="editor-error" color={colors.dangerText}>
            {t('today.missions.errors.failed')}
          </ThemedText>
        ) : null}
      </ScrollView>
      <View
        testID="editor-bar"
        style={[styles.bar, { borderTopColor: colors.border, paddingBottom: Math.max(bottom, 16) }]}
      >
        <View
          style={styles.flex}
          accessible
          accessibilityLabel={`${t('editor.reward')}: ${reward}`}
        >
          <ThemedText variant="caption" color={colors.textMuted}>
            {t('editor.reward')}
          </ThemedText>
          <ThemedText testID="editor-reward" variant="numbers">
            {reward}
          </ThemedText>
        </View>
        <Button
          testID="editor-save"
          label={t('editor.save', { context: family })}
          onPress={save}
          disabled={trimmed === ''}
          disabledReason={t('editor.nameMissing')}
        />
      </View>
      <FrequencySheet
        visible={sheet === 'frequency'}
        value={draft.frequency}
        onClose={() => setSheet(null)}
        onDone={(frequency) => {
          update({ frequency });
          setSheet(null);
        }}
      />
      <DueDaySheet
        visible={sheet === 'due'}
        value={draft.dueDay}
        today={today}
        onClose={() => setSheet(null)}
        onDone={(dueDay) => {
          update({ dueDay });
          setSheet(null);
        }}
      />
      <RemindersSheet
        visible={sheet === 'reminders'}
        value={draft.reminders}
        onClose={() => setSheet(null)}
        onDone={(reminders) => {
          update({ reminders });
          setSheet(null);
        }}
      />
      <GoalSheet
        visible={sheet === 'goal'}
        value={draft.goal}
        onClose={() => setSheet(null)}
        onDone={(chosen) => {
          update({ goal: chosen });
          setSheet(null);
        }}
      />
      <BossSheet
        visible={sheet === 'boss'}
        value={draft.bossId}
        onClose={() => setSheet(null)}
        onChoose={(chosen) => {
          update({ bossId: chosen });
          setSheet(null);
        }}
        onCreateGoal={() => {
          setSheet(null);
          router.navigate('/goals');
        }}
      />
      <ConfirmDialog
        testID="editor-discard"
        visible={dialog === 'discard'}
        title={t('editor.discardTitle')}
        message={t('editor.discardMessage', { name: trimmed === '' ? title : trimmed })}
        cancelLabel={t('editor.keepEditing')}
        confirmLabel={t('editor.discard')}
        onCancel={() => {
          pendingClose.current = null;
          setDialog(null);
        }}
        onConfirm={() => {
          setDialog(null);
          const leave = pendingClose.current;
          if (leave !== null) {
            setClosing(() => leave);
          }
        }}
      />
      <ConfirmDialog
        testID="editor-delete-dialog"
        visible={dialog === 'delete'}
        title={t('editor.deleteTitle', { name: initial.name })}
        message={t('editor.deleteMessage')}
        confirmLabel={t('editor.delete')}
        onCancel={() => setDialog(null)}
        onConfirm={remove}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  missing: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { gap: 16, padding: 16 },
  field: { gap: 8 },
  name: {
    minHeight: NAME_MIN_HEIGHT,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  row: { flexDirection: 'row', gap: 8 },
  column: { gap: 8 },
  flex: { flex: 1 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { width: STAT_SIZE, paddingHorizontal: 0 },
  more: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { gap: 8, alignItems: 'stretch' },
  delete: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
