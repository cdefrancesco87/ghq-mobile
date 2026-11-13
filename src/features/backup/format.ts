import type { TFunction } from 'i18next';

import { formatClock } from '@/features/shared/formatClock';
import type { CloudProvider } from './cloudStore';

const MS_PER_DAY = 86_400_000;
const pad = (value: number) => String(value).padStart(2, '0');

/** The names of the clouds, the same in every language. */
export const CLOUD_NAMES: Readonly<Record<CloudProvider, string>> = {
  icloud: 'iCloud',
  googledrive: 'Google Drive',
};

/**
 * When a backup was made, as the page says it: «oggi alle 06:12», «ieri alle 06:12», «9 novembre
 * alle 06:12» (design-sezioni.md 10.8), in the time of the phone.
 *
 * @param tzOffset Minutes east of UTC.
 */
export function backupWhen(
  at: number,
  { now, tzOffset }: { now: number; tzOffset: number },
  language: string,
  t: TFunction,
): string {
  const local = new Date(at + tzOffset * 60_000);
  const day = Math.floor(local.getTime() / MS_PER_DAY);
  const today = Math.floor((now + tzOffset * 60_000) / MS_PER_DAY);
  const time = formatClock(`${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`, language);
  if (day === today) {
    return t('backup.whenToday', { time });
  }
  if (day === today - 1) {
    return t('backup.whenYesterday', { time });
  }
  const sameYear = local.getUTCFullYear() === new Date(now + tzOffset * 60_000).getUTCFullYear();
  const date = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'long',
    year: sameYear ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(local);
  return t('backup.whenDate', { date, time });
}
