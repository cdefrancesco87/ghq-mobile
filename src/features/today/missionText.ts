import { useTranslation } from 'react-i18next';
import type { GestureResponderEvent } from 'react-native';

import type { TodayMission } from '@/db/repositories/todayView';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { formatClock } from '@/features/shared/formatClock';
import { categoryIcon, ICON_NAMES, type IconName } from '@/features/shared/icons';
import { termInSentence } from '@/i18n/lexicon';
import { addDays } from '@/rules/gameDay';
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

/** The texts under the name of a mission of Today: frequency and time, overdue, done at, skip. */
export function useMissionTexts(day: GameDay, tzOffset: number) {
  const { t, i18n } = useTranslation();

  const detailOf = (item: TodayMission): string => {
    const { frequency, dueDay } = item.mission;
    // An overdue task says so in its warning: its due day would repeat it.
    const detail = item.overdue ? '' : describeFrequency(frequency, t, dueDay);
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
