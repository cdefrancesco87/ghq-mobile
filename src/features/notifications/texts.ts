import { createInstance, type TFunction } from 'i18next';

import { loadHero } from '../../db/repositories/hero';
import { getSetting } from '../../db/repositories/settings';
import { companion } from '../../db/schema';
import type { Db } from '../../db/types';
import { RESOURCES, type Language } from '../../i18n';
import { termInSentence } from '../../i18n/lexicon';
import { FALLBACK_LANGUAGE } from '../../rules/config';
import { companionName } from '../../rules/companion';
import type { EveningSummary } from '../../rules/notifications';
import { dailyVariant, eveningSituation, voiceOf } from '../../rules/tale';
import type { GameDay, GameMode } from '../../rules/types';
import type { ThemeFamily } from '../../theme/themes';
import { plainTale, taleVariants } from '../companion/taleTexts';
import { formatAmount } from '../shared/amount';

// The texts of the notifications (design-sezioni.md 11.2–11.5, 11.8), in the language and the
// lexicon of the theme of the settings. They are written outside React: the background task of
// the actions has no screen and no i18next of the app, so this file keeps its own instances.

/** The Android channels (design 11.1), plus the quiet one of the confirmation after Complete. */
export const CHANNELS = ['reminders', 'summaries', 'boss', 'recall', 'confirmations'] as const;
export type Channel = (typeof CHANNELS)[number];

export interface NotificationText {
  readonly title: string;
  readonly body: string;
}

export interface NotificationTexts {
  /** The sentence under the name of the mission, in the tone of the theme. */
  readonly reminderBody: string;
  /** The buttons of a reminder. */
  readonly completeLabel: string;
  readonly snoozeLabel: string;
  /** «3 missioni per adesso» and the names of the missions. */
  group(names: readonly string[]): NotificationText;
  /**
   * The evening summary signed by the companion (design 6.14, 11.5): its name as the title and a
   * text in its voice, by the situation of the day. `done` is the missions done today; `day`
   * keeps one variant of the text for the whole day.
   */
  evening(
    summary: EveningSummary,
    tale: { readonly day: GameDay; readonly done: number },
  ): NotificationText;
  /** «Fatto!» with the gains, without them in the Essential mode (design 11.8). */
  confirmation(gains: { readonly xp: number; readonly coins: number }): NotificationText;
  /**
   * A mission linked to the health data completed by itself (design 12.7): its name, then
   * «Obiettivo raggiunto: 8.000 passi · +20 XP», without the XP in the Essential mode.
   */
  healthGoal(goal: {
    readonly name: string;
    readonly target: number;
    readonly unit: string;
    readonly xp: number;
  }): NotificationText;
  readonly channels: Readonly<Record<Channel, string>>;
}

export interface TextSettings {
  readonly language: Language;
  /** A theme of the settings (`minimal-scuro` too): only its family counts. */
  readonly theme: string;
  readonly gameMode: GameMode;
  readonly heroName: string;
  /** The name given to the companion; null or missing means the name of the theme. */
  readonly companionName?: string | null;
}

const translators = new Map<Language, TFunction>();

/** An i18next of its own for each language, ready at once (no React); the widgets use it too. */
export function translator(language: Language): TFunction {
  let t = translators.get(language);
  if (t === undefined) {
    const instance = createInstance();
    void instance.init({
      resources: RESOURCES,
      lng: language,
      fallbackLng: FALLBACK_LANGUAGE,
      interpolation: { escapeValue: false },
      initAsync: false,
    });
    t = instance.t;
    translators.set(language, t);
  }
  return t;
}

export function familyOf(theme: string): ThemeFamily {
  return theme.startsWith('minimal') ? 'minimal' : (theme as ThemeFamily);
}

export function notificationTexts(settings: TextSettings): NotificationTexts {
  const { language } = settings;
  const t = translator(language);
  const context = familyOf(settings.theme);
  const term = (key: string) => termInSentence(t(`lexicon.${key}`, { context }), language);
  const missions = (count: number) => term(count === 1 ? 'missions' : 'missions_pl');

  return {
    reminderBody: t('notifications.reminder.body', { context }),
    completeLabel: t('notifications.reminder.complete'),
    snoozeLabel: t('notifications.reminder.snooze'),
    group: (names) => ({
      title: t('notifications.group.title', { count: names.length, term: missions(names.length) }),
      body: names.join(', '),
    }),
    evening: (summary, { day, done }) => {
      const gender = t('lexicon.missions_g', { context });
      const others =
        summary.kind === 'all_done' || summary.others === 0
          ? ''
          : ` ${t('notifications.evening.others', {
              count: summary.others,
              context: gender === 'm' ? 'm' : undefined,
            })}`;
      const left = summary.kind === 'all_done' ? 0 : summary.count;
      const situation = eveningSituation(done, done + left) ?? 'allDone';
      const voice = voiceOf(settings.theme);
      const key =
        dailyVariant(taleVariants(language)(`tale.${voice}.${situation}`), day) ??
        `tale.${voice}.${situation}.1`;
      return {
        title: companionName(settings.companionName ?? null, t('lexicon.companion', { context })),
        body: plainTale(
          t(key, {
            hero: settings.heroName,
            count: left,
            missing: summary.kind === 'all_done' ? '' : `${summary.names.join(', ')}${others}`,
          }),
        ),
      };
    },
    confirmation: ({ xp, coins }) => {
      const title = t('notifications.confirmation.title');
      if (settings.gameMode === 'essential') {
        return { title, body: '' };
      }
      const gain = t('notifications.confirmation.xp', { xp, xpTerm: term('xp_pl') });
      return {
        title,
        body:
          coins > 0
            ? t('notifications.confirmation.coins', { gain, coins, coinsTerm: term('coins_pl') })
            : gain,
      };
    },
    healthGoal: ({ name, target, unit, xp }) => {
      const goal = t('notifications.healthGoal.body', {
        target: formatAmount(target, unit, language),
      });
      return {
        title: name,
        body:
          settings.gameMode === 'essential' || xp <= 0
            ? goal
            : t('notifications.healthGoal.gain', { goal, xp, xpTerm: term('xp_pl') }),
      };
    },
    channels: Object.fromEntries(
      CHANNELS.map((channel) => [channel, t(`notifications.channels.${channel}`)]),
    ) as Record<Channel, string>,
  };
}

/** The texts with the settings and the name of the hero in the database. */
export function notificationTextsOf(db: Db): NotificationTexts {
  let heroName = '';
  try {
    heroName = loadHero(db).name;
  } catch {
    // Before the first launch there is no hero: no text names it yet.
  }
  return notificationTexts({
    companionName: db.select({ name: companion.name }).from(companion).get()?.name ?? null,
    language: getSetting(db, 'language'),
    theme: getSetting(db, 'theme'),
    gameMode: getSetting(db, 'game_mode'),
    heroName,
  });
}
