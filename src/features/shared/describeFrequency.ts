import type { TFunction } from 'i18next';

import type { Weekday } from '@/rules/gameDay';
import type { Frequency } from '@/rules/frequency';
import type { GameDay } from '@/rules/types';

/** From this many days in a row, weekdays are written as a range: «Lun–ven». */
const MIN_RANGE_DAYS = 3;
const ALL_WEEKDAYS = 7;

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Groups the days in runs of consecutive days, from Monday to Sunday. */
function runsOf(days: readonly Weekday[]): Weekday[][] {
  const runs: Weekday[][] = [];
  for (const day of [...days].sort((a, b) => a - b)) {
    const run = runs.at(-1);
    if (run !== undefined && run[run.length - 1] === day - 1) {
      run.push(day);
    } else {
      runs.push([day]);
    }
  }
  return runs;
}

function describeWeekdays(days: readonly Weekday[], t: TFunction): string {
  const name = (day: Weekday) => t(`shared.frequency.weekdayShort.${day}`);
  const parts = runsOf(days).flatMap((run) =>
    run.length >= MIN_RANGE_DAYS ? [`${name(run[0])}–${name(run[run.length - 1])}`] : run.map(name),
  );
  return capitalized(parts.join(', '));
}

function describeDueDay(dueDay: GameDay | null | undefined, t: TFunction): string {
  if (dueDay === null || dueDay === undefined) {
    return t('shared.frequency.noDueDay');
  }
  const [, month, day] = dueDay.split('-').map(Number);
  return t('shared.frequency.dueOn', { day, month: t(`shared.frequency.month.${month}`) });
}

/**
 * The frequency of a mission in words; without a frequency, a single task: its due day.
 * Weekdays always go from Monday: it is a description, it does not depend on `week_start`.
 */
export function describeFrequency(
  frequency: Frequency | null,
  t: TFunction,
  dueDay?: GameDay | null,
): string {
  if (frequency === null) {
    return describeDueDay(dueDay, t);
  }
  switch (frequency.type) {
    case 'daily':
      return t('shared.frequency.daily');
    case 'weekdays':
      return frequency.days.length === ALL_WEEKDAYS
        ? t('shared.frequency.daily')
        : describeWeekdays(frequency.days, t);
    case 'times_per_week':
      return frequency.times === 1
        ? t('shared.frequency.oncePerWeek')
        : t('shared.frequency.timesPerWeek', { times: frequency.times });
    case 'every_n_days':
      return frequency.n === 1
        ? t('shared.frequency.daily')
        : t('shared.frequency.everyNDays', { n: frequency.n });
    case 'monthly':
      return t('shared.frequency.monthly', { day: frequency.day });
    case 'yearly':
      return t('shared.frequency.yearly', {
        day: frequency.day,
        month: t(`shared.frequency.month.${frequency.month}`),
      });
  }
}
