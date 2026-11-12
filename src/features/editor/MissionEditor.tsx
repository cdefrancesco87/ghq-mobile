import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createMission,
  deleteMission,
  isMissionNameTaken,
  listTodayMissions,
} from '@/db/repositories/missions';
import { gameDayOf, getSetting } from '@/db/repositories/settings';
import { systemScheduler } from '@/features/notifications/system';
import { Button } from '@/features/shared/Button';
import { Difficulty } from '@/features/shared/Difficulty';
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
import { ChoiceButton } from './ChoiceButton';

/** Past this length the name shows how many characters it has (design-sezioni.md 4.2). */
export const NAME_COUNTER_FROM = 60;
const NAME_LINES = 2;
const NAME_MIN_HEIGHT = 56;
const STAT_SIZE = 52;

type Kind = 'habit' | 'task';

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

/**
 * The editor of a new mission, basic fields (design-sezioni.md 4.1–4.4, 4.10, 4.12, 4.15; mockups
 * B5 and D13): name with the keyboard open, type, difficulty and main stat, then the bar with the
 * preview of the rewards and Save. The name alone and Enter save a daily medium habit (US-EDT-01).
 */
export function MissionEditor() {
  const { t } = useTranslation();
  const { colors, family, typography } = useTheme();
  const router = useRouter();
  const toast = useUndoToast();
  const highlight = useHighlightStore((state) => state.highlight);
  const clearHighlight = useHighlightStore((state) => state.clear);
  const large = useLargeText();
  const { bottom } = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('habit');
  const [difficulty, setDifficulty] = useState<Level>('medium');
  const [stat, setStat] = useState<StatKey | null>(null);
  const [failed, setFailed] = useState(false);
  // Enter and Save, or two quick taps, would otherwise create the mission twice.
  const saving = useRef(false);

  const trimmed = name.trim();
  const taken = useMemo(() => isMissionNameTaken(getSession().db, name), [name]);
  const rewards = baseRewards(difficulty, stat);
  const xpTerm = t('lexicon.xp_pl', { context: family });
  const coinsTerm = t('lexicon.coins_pl', { context: family });
  const statName = (key: StatKey) => t(`stats.${key}`, { context: family });
  const titleKey = kind === 'habit' ? 'editor.newHabit' : 'editor.newTask';
  const shape = SHAPES[family].control;
  const radius = shape.kind === 'rounded' ? shape.radius : 0;

  const save = () => {
    if (trimmed === '' || saving.current) {
      return;
    }
    saving.current = true;
    let created;
    try {
      created = runAction((db, clock) => {
        const mission = createMission(
          db,
          { name: trimmed, kind, difficulty, statPrimary: stat },
          clock,
        );
        const day = gameDayOf(clock.now, clock.tzOffset, getSetting(db, 'day_change'));
        return {
          id: mission.id,
          inToday: listTodayMissions(db, day).some((m) => m.id === mission.id),
        };
      });
    } catch {
      saving.current = false;
      setFailed(true);
      return;
    }
    const { id, inToday } = created;
    // Only a row that Today shows can be highlighted: a task without a due day is not there.
    if (inToday) {
      highlight(id);
    }
    router.back();
    toast.show({
      message: t('editor.created'),
      onUndo: () => {
        clearHighlight();
        try {
          const { cancelledNotificationIds } = runAction((db, clock) =>
            deleteMission(db, id, clock),
          );
          if (cancelledNotificationIds.length > 0) {
            void systemScheduler.cancel(cancelledNotificationIds).catch(() => undefined);
          }
        } catch {
          toast.show({ message: t('today.missions.errors.failed') });
        }
      },
    });
  };

  const reward = [
    t('editor.rewardXp', { xp: rewards.xp, term: xpTerm }),
    t('editor.rewardCoins', { coins: rewards.coins, term: coinsTerm }),
    ...(stat === null
      ? []
      : [t('editor.rewardStat', { points: rewards.stats[stat] ?? 0, stat: statName(stat) })]),
  ].join(' · ');

  return (
    <KeyboardAvoidingView
      testID="editor"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.surfaceHigh }]}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText variant="sectionTitle" accessibilityRole="header">
          {t(titleKey, { context: family })}
        </ThemedText>
        <View style={styles.field}>
          <TextInput
            testID="editor-name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setFailed(false);
            }}
            autoFocus
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
        <SegmentedControl
          testID="editor-kind"
          accessibilityLabel={t('editor.kind')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'habit', label: t('editor.habit') },
            { value: 'task', label: t('editor.task') },
          ]}
        />
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
                selected={level === difficulty}
                onPress={() => setDifficulty(level)}
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
        </View>
        <View style={styles.field}>
          <ThemedText variant="label" color={colors.textMuted}>
            {stat === null ? t('editor.stat') : t('editor.statChosen', { stat: statName(stat) })}
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
                  selected={key === stat}
                  onPress={() => setStat(key)}
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
          {stat === null ? (
            <ThemedText testID="editor-stat-missing" variant="caption" color={colors.textMuted}>
              {t('editor.statMissing')}
            </ThemedText>
          ) : null}
        </View>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
