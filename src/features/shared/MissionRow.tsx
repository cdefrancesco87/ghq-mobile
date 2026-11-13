import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
} from 'react-native';

import type { Difficulty as DifficultyLevel } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';
import { COMPLETION_CONTROL_SIZE, CompletionControl, DoneMark } from './CompletionControl';
import { Difficulty } from './Difficulty';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { ProgressRing } from './ProgressRing';
import { ThemedText } from './ThemedText';
import { useLargeText } from './useLargeText';

const MIN_HEIGHT = 64;
const PRIORITY_MIN_HEIGHT = 72;
const NAME_LINES = 2;
const LARGE_TEXT_NAME_LINES = 3;
const PRIORITY_NUMBER_SCALE = 1.6;
const RATE_RING_SIZE = 16;
const RATE_RING_STROKE = 3;
/** The column of the icon: in Arcade a pixel drawing is 24 and a line drawing 20. */
const ICON_COLUMN_WIDTH = 24;
/** The rate of a mission that was never expected yet. */
const NO_RATE = '–';

/** An action of the screen reader: the same as the swipe and the menu of the row. */
export interface MissionRowAction {
  readonly name: string;
  readonly label: string;
  readonly onAction: () => void;
}

interface CommonProps {
  /** The row is `testID`, its parts are `testID-body`, `testID-control`… */
  readonly testID: string;
  readonly name: string;
  readonly difficulty: DifficultyLevel;
  /** Under the name: the frequency (`describeFrequency`) or the progress, e.g. «1,25 di 2 L». */
  readonly detail: string;
  /** Before the detail in the danger colour, e.g. «Scaduta ieri» (design 2.5). */
  readonly warning?: string;
  /** Opens the detail of the mission. */
  readonly onPress?: () => void;
  /** Opens the menu of the row. */
  readonly onLongPress?: () => void;
  readonly actions?: readonly MissionRowAction[];
}

interface ToComplete {
  /** The XP at stake. */
  readonly xp: number;
  readonly onComplete: (event: GestureResponderEvent) => void;
  /** Progress of a measurable mission, from 0 to 1. */
  readonly progress?: number;
  /** A long press on the control; the menu of the row when missing («Inserisci valore», 2.5). */
  readonly onControlLongPress?: () => void;
}

export type MissionRowProps = CommonProps &
  (
    | ({ readonly variant: 'today'; readonly icon: IconName } & ToComplete)
    | ({ readonly variant: 'priority'; readonly position: 1 | 2 | 3 } & ToComplete)
    | {
        readonly variant: 'list';
        readonly icon: IconName;
        readonly streak: number;
        /** `times_per_week` missions count their streak in weeks. */
        readonly streakUnit?: 'days' | 'weeks';
        /** Completion in the last 30 days, from 0 to 100; null when nothing was expected yet. */
        readonly completionRate: number | null;
        /** Archived, or a single task already done: muted text (design 3.7). */
        readonly muted?: boolean;
        /**
         * Paused (design 3.6): muted, a lock beside the frozen streak and no rate; `detail` says
         * until when.
         */
        readonly paused?: boolean;
      }
    | {
        readonly variant: 'done';
        readonly icon: IconName;
        /** The time of completion, already written for the language. */
        readonly doneTime: string;
      }
    | {
        /** Skipped today, among the done ones with the skip icon (design-sezioni.md 2.5). */
        readonly variant: 'skipped';
        readonly icon: IconName;
        /** The reason, already written for the language. */
        readonly reason: string;
      }
  );

/** A mission in Today, in Habits and in the Plan of the day (design-sezioni.md A6, 2.5, 3.2). */
export function MissionRow(props: MissionRowProps) {
  const { t } = useTranslation();
  const { colors, family, typography } = useTheme();
  const large = useLargeText();
  const { testID, name, difficulty, onPress, onLongPress, actions, warning } = props;
  const detail = [warning, props.detail].filter(Boolean).join(' · ');

  const difficultyWord = t(`shared.difficulty.${difficulty}`).toLowerCase();
  const doneAt =
    props.variant === 'done'
      ? t('shared.missionRow.doneAt', { context: family, time: props.doneTime })
      : props.variant === 'skipped'
        ? t('shared.missionRow.skippedReason', { reason: props.reason })
        : '';
  // Done and skipped rows have the same muted look and the time, or the reason, under the name.
  const closed = props.variant === 'done' || props.variant === 'skipped';
  const accessibilityActions = actions?.map(({ name: action, label }) => ({ name: action, label }));
  const onAccessibilityAction = (event: AccessibilityActionEvent) =>
    actions?.find((action) => action.name === event.nativeEvent.actionName)?.onAction();
  const actionProps = { accessibilityActions, onAccessibilityAction };

  const toComplete = props.variant === 'today' || props.variant === 'priority';
  const xp = toComplete ? (
    <ThemedText testID={`${testID}-xp`} variant="numbers" color={colors.textMuted}>
      {`+${props.xp}`}
    </ThemedText>
  ) : null;
  const notches = closed ? null : <Difficulty difficulty={difficulty} showWord={false} />;
  const rate =
    props.variant === 'list' && props.completionRate !== null
      ? Math.min(Math.max(props.completionRate, 0), 100)
      : null;
  const paused = props.variant === 'list' && props.paused === true;
  const muted = closed || paused || (props.variant === 'list' && props.muted === true);
  const valueColor = muted ? colors.textMuted : colors.text;
  const listValues =
    props.variant === 'list' ? (
      <>
        <View style={styles.value}>
          <Icon
            testID={`${testID}-${paused ? 'lock' : 'streak'}`}
            name={paused ? 'lucchetto' : 'serie'}
            size={16}
            color={colors.textMuted}
          />
          <ThemedText variant="numbers" color={valueColor}>
            {String(props.streak)}
          </ThemedText>
        </View>
        {paused ? null : (
          <View style={styles.value}>
            <ProgressRing
              progress={(rate ?? 0) / 100}
              size={RATE_RING_SIZE}
              strokeWidth={RATE_RING_STROKE}
            />
            <ThemedText testID={`${testID}-rate`} variant="numbers" color={valueColor}>
              {rate === null ? NO_RATE : `${rate}%`}
            </ThemedText>
          </View>
        )}
      </>
    ) : null;

  return (
    <View
      testID={testID}
      style={[
        styles.row,
        { minHeight: props.variant === 'priority' ? PRIORITY_MIN_HEIGHT : MIN_HEIGHT },
      ]}
    >
      <Pressable
        testID={`${testID}-body`}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole={onPress === undefined ? undefined : 'button'}
        accessibilityLabel={bodyLabel()}
        {...(toComplete ? {} : actionProps)}
        style={styles.body}
      >
        {props.variant === 'priority' ? (
          <ThemedText
            testID={`${testID}-position`}
            variant="numbers"
            color={family === 'minimal' ? colors.textMuted : colors.primary}
            style={{
              fontSize: Math.round(typography.numbers.fontSize * PRIORITY_NUMBER_SCALE),
            }}
          >
            {String(props.position)}
          </ThemedText>
        ) : (
          <View testID={`${testID}-icon`} style={styles.icon}>
            <Icon name={props.icon} size={20} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.texts}>
          <ThemedText
            numberOfLines={large ? LARGE_TEXT_NAME_LINES : NAME_LINES}
            color={muted ? colors.textMuted : colors.text}
            style={props.variant === 'done' ? styles.struck : undefined}
          >
            {name}
          </ThemedText>
          <View style={styles.meta}>
            {warning === undefined || closed ? null : (
              <ThemedText testID={`${testID}-warning`} variant="caption" color={colors.dangerText}>
                {warning}
              </ThemedText>
            )}
            <ThemedText variant="caption" color={colors.textMuted} style={styles.detail}>
              {closed ? doneAt : props.detail}
            </ThemedText>
            {large ? null : notches}
          </View>
          {large && !closed ? (
            <View testID={`${testID}-under`} style={styles.meta}>
              {xp}
              {notches}
              {listValues}
            </View>
          ) : null}
        </View>
        {!large && (xp !== null || listValues !== null) ? (
          <View testID={`${testID}-trailing`} style={styles.trailing}>
            {xp}
            {listValues}
          </View>
        ) : null}
      </Pressable>
      {toComplete ? (
        <CompletionControl
          testID={`${testID}-control`}
          accessibilityLabel={controlLabel(props.xp, props.progress)}
          onPress={props.onComplete}
          onLongPress={props.onControlLongPress ?? onLongPress}
          progress={props.progress}
          showPercentage={!large}
          {...actionProps}
        />
      ) : null}
      {props.variant === 'done' ? <DoneMark testID={`${testID}-control`} /> : null}
      {props.variant === 'skipped' ? (
        <View
          testID={`${testID}-control`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.mark}
        >
          <Icon name="salta" size={20} color={colors.textMuted} />
        </View>
      ) : null}
    </View>
  );

  function bodyLabel(): string {
    switch (props.variant) {
      case 'today':
      case 'priority':
        return t('shared.missionRow.openLabel', { name, detail });
      case 'list':
        return t(
          paused
            ? 'shared.missionRow.listLabelPaused'
            : rate === null
              ? 'shared.missionRow.listLabelNoRate'
              : 'shared.missionRow.listLabel',
          {
            name,
            detail,
            difficulty: difficultyWord,
            streak: streakWords(props.streak, props.streakUnit ?? 'days'),
            rate,
          },
        );
      case 'done':
      case 'skipped':
        return t('shared.missionRow.doneLabel', { name, difficulty: difficultyWord, doneAt });
    }
  }

  function streakWords(streak: number, unit: 'days' | 'weeks'): string {
    const singular = streak === 1;
    const key =
      unit === 'days'
        ? singular
          ? 'streakDay'
          : 'streakDays'
        : singular
          ? 'streakWeek'
          : 'streakWeeks';
    return t(`shared.missionRow.${key}`, { streak });
  }

  function controlLabel(missionXp: number, progress: number | undefined): string {
    const values = {
      name,
      difficulty: difficultyWord,
      xp: missionXp,
      xpTerm: t('lexicon.xp_pl', { context: family }),
    };
    const label =
      progress === undefined
        ? t('shared.missionRow.todoLabel', values)
        : t('shared.missionRow.progressLabel', { ...values, progress: detail });
    return props.variant === 'priority'
      ? t('shared.missionRow.priorityLabel', { position: props.position, label })
      : label;
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: ICON_COLUMN_WIDTH, alignItems: 'center' },
  texts: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 },
  detail: { flexShrink: 1 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  struck: { textDecorationLine: 'line-through' },
  mark: {
    width: COMPLETION_CONTROL_SIZE,
    height: COMPLETION_CONTROL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
