import type { Db } from '../../db/types';
import { getSetting } from '../../db/repositories/settings';
import type { Language } from '../../i18n';
import { termInSentence } from '../../i18n/lexicon';
import { formatAmount, formatNumber } from '../shared/amount';
import { familyOf, translator } from '../notifications/texts';

// The texts of the widgets (design-sezioni.md 12.1–12.3, 12.10), in the language and the lexicon
// of the theme of the settings. The widget draws them as they are: it has no i18next.

export interface WidgetTexts {
  /** «Livello 7». */
  level(level: number): string;
  /** «3 rimaste», «Tutte fatte» with nothing left. */
  remaining(count: number): string;
  /** «2 di 5». */
  progress(done: number, total: number): string;
  /** «e altre 3». */
  more(count: number): string;
  /** «Giornata completa!» in the tone of the theme. */
  readonly fullDay: string;
  /** «Giorno di riposo: la serie è al sicuro». */
  readonly rest: string;
  /** «1,25 di 2 L». */
  amount(value: number, target: number, unit: string): string;
  /** «+15». */
  xp(xp: number): string;
  /** «Completa Leggi 20 pagine». */
  completeLabel(name: string): string;
  /** «Aggiungi 0,25 L a Bevi acqua». */
  incrementLabel(name: string, amount: number, unit: string): string;
  /** «Apri Leggi 20 pagine». */
  openLabel(name: string): string;
  /** «Apri Oggi». */
  readonly moreLabel: string;
  /** «2 notifiche non viste». */
  unseenLabel(count: number): string;
  /** «GHQ, serie 12 giorni, 3 rimaste». */
  description(streak: number, remaining: number): string;
}

export interface WidgetTextSettings {
  readonly language: Language;
  /** A theme of the settings (`minimal-scuro` too): only its family counts. */
  readonly theme: string;
}

export function widgetTexts({ language, theme }: WidgetTextSettings): WidgetTexts {
  const t = translator(language);
  const context = familyOf(theme);
  // «Tutti fatti», «3 rimasti» when the missions of the theme are masculine.
  const gender = t('lexicon.missions_g', { context }) === 'm' ? 'm' : undefined;
  const remaining = (count: number) =>
    count === 0
      ? t('widgets.allDone', { context: gender })
      : t('widgets.remaining', { count, context: gender });

  return {
    level: (level) => t('today.hero.level', { term: t('lexicon.level', { context }), level }),
    remaining,
    progress: (done, total) => t('today.progress', { done, total }),
    more: (count) => t('notifications.evening.others', { count, context: gender }),
    fullDay: t('widgets.fullDay', { term: t('lexicon.fullDay', { context }) }),
    rest: t('widgets.rest'),
    amount: (value, target, unit) =>
      t('today.missions.progressAmount', {
        value: formatNumber(value, language),
        target: formatAmount(target, unit, language),
      }),
    xp: (xp) => t('widgets.xp', { xp }),
    completeLabel: (name) => t('notifications.recent.completeA11y', { name }),
    incrementLabel: (name, amount, unit) =>
      t('widgets.incrementA11y', { name, amount: formatAmount(amount, unit, language) }),
    openLabel: (name) => t('widgets.openA11y', { name }),
    moreLabel: t('widgets.moreA11y'),
    unseenLabel: (count) => t('widgets.unseenA11y', { count }),
    description: (streak, left) =>
      t('widgets.description', {
        streak: t('widgets.streakDays', {
          count: streak,
          term: termInSentence(t('lexicon.streak', { context }), language),
        }),
        remaining: remaining(left),
      }),
  };
}

/** The texts with the language and the theme of the settings in the database. */
export function widgetTextsOf(db: Db): WidgetTexts {
  return widgetTexts({ language: getSetting(db, 'language'), theme: getSetting(db, 'theme') });
}
