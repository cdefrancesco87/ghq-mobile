import { useTranslation } from 'react-i18next';
import type { GestureResponderEvent } from 'react-native';

import type { TodayMission } from '@/db/repositories/todayView';
import { formatAmount, formatNumber } from '@/features/shared/amount';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { formatClock } from '@/features/shared/formatClock';
import { categoryIcon, ICON_NAMES, type IconName } from '@/features/shared/icons';
import { termInSentence } from '@/i18n/lexicon';
import { addDays } from '@/rules/gameDay';
import { formatCountdown, timerRemainingMs } from '@/rules/timer';
import type { GameDay } from '@/rules/types';

const MINUTE_MS = 60_000;

/** «07:42»: the local time of a UTC instant, with the offset of the phone. */
function formatInstant(instant: number, tzOffset: number, language: string): string {
  return new Intl.DateTimeFormat(language, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(instant + tzOffset * MINUTE_MS));
}

export function missionIcon({ iconKey, categoryKey }: TodayMission['mission']): IconName {
  return iconKey !== null && (ICON_NAMES as readonly string[]).includes(iconKey)
    ? (iconKey as IconName)
    : categoryIcon(categoryKey);
}

/** Where the touch was, for the celebration; the centre of the screen in the tests. */
export function originOf(event: GestureResponderEvent | undefined) {
  return { x: event?.nativeEvent?.pageX ?? 0, y: event?.nativeEvent?.pageY ?? 0 };
}

export interface TimerState {
  readonly running: boolean;
  /** The minutes done, from 0 to 1. */
  readonly progress: number;
  readonly remainingMs: number;
}

/**
 * The timer of a duration mission still to do at `now` (design 2.5, T79); null for the other
 * missions. A timer that is not running keeps the minutes saved by its pauses.
 */
export function timerStateOf(item: TodayMission, now: number): TimerState | null {
  const { goalType, goalTarget } = item.mission;
  if (goalType !== 'duration' || goalTarget === null || goalTarget <= 0 || item.state !== 'todo') {
    return null;
  }
  const remainingMs = timerRemainingMs({
    startedAt: item.timerStartedAt,
    target: goalTarget,
    value: item.value ?? 0,
    now,
  });
  return {
    running: item.timerStartedAt !== null,
    progress: 1 - remainingMs / (goalTarget * MINUTE_MS),
    remainingMs,
  };
}

/** The texts under the name of a mission of Today: frequency and time, overdue, done at, skip. */
export function useMissionTexts(day: GameDay, tzOffset: number, now = 0) {
  const { t, i18n } = useTranslation();

  /** «09:30 rimasti», «In pausa · 07:30 rimasti» or «10 min» for a duration goal (T79). */
  const timerTextOf = (item: TodayMission): string | null => {
    const timer = timerStateOf(item, now);
    if (timer === null) {
      return null;
    }
    const time = formatCountdown(timer.remainingMs);
    if (timer.running) {
      return t('today.timer.running', { time });
    }
    return (item.value ?? 0) > 0
      ? t('today.timer.paused', { time })
      : t('today.timer.ready', {
          minutes: formatNumber(item.mission.goalTarget ?? 0, i18n.language),
        });
  };

  /** «1,2 di 2 L» for a quantity goal (design-sezioni.md 2.5); null for the other missions. */
  const progressOf = (item: TodayMission): string | null => {
    const { goalType, goalTarget, goalUnit } = item.mission;
    if (goalType !== 'quantity' || goalTarget === null || goalUnit === null) {
      return null;
    }
    return t('today.missions.progressAmount', {
      value: formatNumber(item.value ?? 0, i18n.language),
      target: formatAmount(goalTarget, goalUnit, i18n.language),
    });
  };

  const detailOf = (item: TodayMission): string => {
    const { frequency, dueDay } = item.mission;
    const progress = progressOf(item) ?? timerTextOf(item);
    // An overdue task says so in its warning: its due day would repeat it.
    const detail = progress ?? (item.overdue ? '' : describeFrequency(frequency, t, dueDay));
    if (item.time === null) {
      return detail;
    }
    const time = formatClock(item.time, i18n.language);
    return detail === '' ? time : t('today.missions.detailTime', { detail, time });
  };

  const warningOf = (item: TodayMission): string | undefined => {
    const { dueDay } = item.mission;
    if (!item.overdue || dueDay === null) {
      return undefined;
    }
    if (dueDay === addDays(day, -1)) {
      return t('today.missions.overdueYesterday');
    }
    const [, month, dayOfMonth] = dueDay.split('-').map(Number);
    return t('today.missions.overdueOn', {
      day: dayOfMonth,
      month: t(`shared.frequency.month.${month}`),
    });
  };

  const doneTimeOf = (item: TodayMission): string =>
    item.doneAt === null ? '' : formatInstant(item.doneAt, tzOffset, i18n.language);

  /** The reason of a skipped mission, inside the sentence «saltata · malattia». */
  const reasonOf = (item: TodayMission): string =>
    item.skipReason === null
      ? ''
      : termInSentence(t(`today.skip.reasons.${item.skipReason}`), i18n.language);

  return { detailOf, warningOf, doneTimeOf, reasonOf };
}
