import type { TodayMission, TodayView } from '../../db/repositories/todayView';
import type { SettingValue } from '../../db/repositories/settings';
import type { CompanionStage, Mood } from '../../rules/companion';
import { WIDGETS } from '../../rules/config';
import type { GameDay, GameMode } from '../../rules/types';
import { THEMES, type ThemeColors, type ThemeFamily, type ThemeTokens } from '../../theme/themes';
import type { WidgetTexts } from './texts';

// What the widgets show (design-sezioni.md 12.1–12.4, 12.9, 12.10), built from the view of Today
// with no React and no database: the app writes it to the storage it shares with the widgets
// after every action and at the day change. Texts and colours are ready to draw, because the
// widget runs without i18next and without the theme of the app.

/** The circle of a row: `complete` a mission, or `progress` a measurable one by its increment. */
export interface WidgetTarget {
  readonly kind: 'complete' | 'progress';
  readonly missionId: string;
  readonly day: GameDay;
  /**
   * What makes a touch unique, for its idempotency key: the generation of the snapshot for a
   * completion, the generation and the value reached for a measurable mission (`progressStamp`).
   * Two touches on the same circle of the same snapshot count once; a value reached again after
   * an undo comes with a new snapshot, so it counts again.
   */
  readonly stamp: string;
}

/**
 * The stamp of a touch on a measurable mission: `<generation>~<value>`. The widget writes the
 * next one itself after a touch (`GhqWidgets`), with the value it reached.
 */
export function progressStamp(generation: string, value: number): string {
  return `${generation}~${value}`;
}

const KINDS = { c: 'complete', p: 'progress' } as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `c|<mission>|<day>|<stamp>`: the `target` of the button of a circle. */
export function encodeTarget(target: WidgetTarget): string {
  return [target.kind[0], target.missionId, target.day, target.stamp].join('|');
}

/** The target of a touch, or null for anything this app did not write. */
export function decodeTarget(value: string): WidgetTarget | null {
  const parts = value.split('|');
  if (parts.length !== 4) {
    return null;
  }
  const [code, missionId, day, stamp] = parts;
  const kind = KINDS[code as keyof typeof KINDS];
  if (kind === undefined || missionId === '' || !DAY.test(day) || stamp === '') {
    return null;
  }
  return { kind, missionId, day: day as GameDay, stamp };
}

/** The colours a widget needs, from the roles of the theme (design 12.4). */
export interface WidgetColors {
  readonly background: string;
  readonly surface: string;
  readonly border: string;
  readonly text: string;
  readonly textMuted: string;
  readonly primary: string;
  readonly onPrimary: string;
  readonly done: string;
  readonly danger: string;
}

/** The theme of the settings: Minimal has a light and a dark version, like the phone. */
export interface WidgetTheme {
  readonly family: ThemeFamily;
  readonly light: ThemeTokens;
  readonly dark: ThemeTokens;
}

export function widgetThemeOf(setting: SettingValue<'theme'>): WidgetTheme {
  if (setting === 'minimal') {
    return { family: 'minimal', light: THEMES['minimal-chiaro'], dark: THEMES['minimal-scuro'] };
  }
  const theme = THEMES[setting];
  return { family: theme.family, light: theme, dark: theme };
}

export function colorsOf({
  background,
  surface,
  border,
  text,
  textMuted,
  primary,
  onPrimary,
  done,
  danger,
}: ThemeColors): WidgetColors {
  return { background, surface, border, text, textMuted, primary, onPrimary, done, danger };
}

export interface WidgetMission {
  readonly id: string;
  readonly name: string;
  readonly done: boolean;
  /** The circle adds the increment instead of completing (design 12.2). */
  readonly measurable: boolean;
  /** «1,25 di 2 L» for a quantity goal; null otherwise. */
  readonly detail: string | null;
  /** «+15» for a mission to do; null when done and in the Essential mode. */
  readonly xp: string | null;
  readonly value: number;
  readonly step: number | null;
  readonly goal: number | null;
  /** The `target` of the circle (`encodeTarget`); null when done. */
  readonly target: string | null;
  /** The name of the circle for the screen reader (design 12.10). */
  readonly a11y: string;
  /** The name opens the app on the mission. */
  readonly url: string;
  readonly openA11y: string;
}

/** `missions`: the list; `full_day`: everything done; `rest`: a rest day or no missions today. */
export type WidgetState = 'missions' | 'full_day' | 'rest';

export interface WidgetSnapshot {
  readonly day: GameDay;
  /** Changes at every write: the stamp of the completions of this snapshot. */
  readonly generation: string;
  readonly essential: boolean;
  readonly state: WidgetState;
  readonly streak: number;
  /** No level in the Essential mode (design 12.9). */
  readonly level: number | null;
  readonly levelText: string | null;
  readonly done: number;
  readonly total: number;
  readonly remaining: number;
  /** «3 rimaste» or «Tutte fatte». */
  readonly remainingText: string;
  /** «2 di 5». */
  readonly progressText: string;
  /** «Giornata completa!» or the rest day; null with the list. */
  readonly message: string | null;
  /**
   * The texts after a touch, before the app writes again: «N rimaste» by count left, «N di 5» by
   * count done, and «Giornata completa!».
   */
  readonly remainingTexts: readonly string[];
  readonly progressTexts: readonly string[];
  readonly fullDayText: string;
  readonly missions: readonly WidgetMission[];
  /** Missions left out of the list, «e altre 3». */
  readonly more: number;
  readonly moreText: string | null;
  readonly companion: { readonly stage: CompanionStage; readonly mood: Mood };
  /** Notifications of GHQ not seen yet, the badge of the small widget (design 12.1). */
  readonly unseen: number;
  readonly unseenText: string | null;
  readonly colors: { readonly light: WidgetColors; readonly dark: WidgetColors };
  /** «GHQ, serie 12 giorni, 3 rimaste» for the screen reader. */
  readonly description: string;
  readonly moreA11y: string;
  readonly urls: { readonly open: string; readonly more: string };
  /**
   * Touches the widget recorded before the app read them (`target` of each), written by the
   * widget itself; the app always writes an empty list.
   */
  readonly pending: readonly string[];
}

export interface WidgetExtras {
  readonly unseen: number;
  readonly texts: WidgetTexts;
  /** A value that changes at every write, e.g. the instant in base 36. */
  readonly generation: string;
  /** Very large system text: one row less (design 12.10). */
  readonly largeText?: boolean;
}

const TODAY_URL = 'ghq:///today';

/** Missions to do first, those of the plan in its order; the done ones at the bottom (12.2). */
function ordered(view: TodayView): TodayMission[] {
  const active = view.missions.filter((item) => item.state !== 'skipped');
  const todo = active.filter((item) => item.state === 'todo');
  const planned = view.plan
    .map((id) => todo.find((item) => item.mission.id === id))
    .filter((item): item is TodayMission => item !== undefined);
  const others = todo.filter((item) => !view.plan.includes(item.mission.id));
  return [...planned, ...others, ...active.filter((item) => item.state === 'done')];
}

function rowOf(
  item: TodayMission,
  day: GameDay,
  essential: boolean,
  { texts, generation }: WidgetExtras,
): WidgetMission {
  const { id, name, goalType, goalTarget, goalUnit, goalStep } = item.mission;
  const done = item.state === 'done';
  const measurable = goalType !== 'none';
  const value = item.value ?? 0;
  const quantity = goalType === 'quantity' && goalTarget !== null && goalUnit !== null;
  const target: WidgetTarget = measurable
    ? { kind: 'progress', missionId: id, day, stamp: progressStamp(generation, value) }
    : { kind: 'complete', missionId: id, day, stamp: generation };
  return {
    id,
    name,
    done,
    measurable,
    detail: quantity ? texts.amount(value, goalTarget, goalUnit) : null,
    xp: done || essential ? null : texts.xp(item.xp),
    value,
    step: goalStep,
    goal: goalTarget,
    target: done ? null : encodeTarget(target),
    a11y:
      quantity && goalStep !== null
        ? texts.incrementLabel(name, goalStep, goalUnit)
        : texts.completeLabel(name),
    url: `${TODAY_URL}?mission=${encodeURIComponent(id)}`,
    openA11y: texts.openLabel(name),
  };
}

/** 0, 1, … up to `total`. */
const counts = (total: number) => Array.from({ length: total + 1 }, (_, index) => index);

export function buildWidgetSnapshot(
  view: TodayView,
  theme: WidgetTheme,
  gameMode: GameMode,
  extras: WidgetExtras,
): WidgetSnapshot {
  const { texts } = extras;
  const essential = gameMode === 'essential';
  const total = view.totalCount;
  const done = view.doneCount;
  const remaining = Math.max(0, total - done);
  const state: WidgetState =
    view.restDay || total === 0 ? 'rest' : remaining === 0 ? 'full_day' : 'missions';
  const all = state === 'rest' ? [] : ordered(view);
  const rows = extras.largeText ? WIDGETS.rowsLargeText : WIDGETS.rows;
  // With more missions than rows, the last row says «e altre N» (design 12.2).
  const shown = all.length > rows ? all.slice(0, rows - 1) : all;
  const more = all.length - shown.length;
  const streak = view.hero.streak;
  return {
    day: view.day,
    generation: extras.generation,
    essential,
    state,
    streak,
    level: essential ? null : view.hero.level,
    levelText: essential ? null : texts.level(view.hero.level),
    done,
    total,
    remaining,
    remainingText: texts.remaining(remaining),
    progressText: texts.progress(done, total),
    message: state === 'full_day' ? texts.fullDay : state === 'rest' ? texts.rest : null,
    remainingTexts: counts(total).map((count) => texts.remaining(count)),
    progressTexts: counts(total).map((count) => texts.progress(count, total)),
    fullDayText: texts.fullDay,
    missions: shown.map((item) => rowOf(item, view.day, essential, extras)),
    more,
    moreText: more > 0 ? texts.more(more) : null,
    companion: { stage: view.companion.stage, mood: view.companion.mood },
    unseen: extras.unseen,
    unseenText: extras.unseen > 0 ? texts.unseenLabel(extras.unseen) : null,
    colors: { light: colorsOf(theme.light.colors), dark: colorsOf(theme.dark.colors) },
    description: texts.description(streak, remaining),
    moreA11y: texts.moreLabel,
    // The touch opens «Notifiche recenti» when some are not seen (design 12.1).
    urls: { open: extras.unseen > 0 ? `${TODAY_URL}?notifications=1` : TODAY_URL, more: TODAY_URL },
    pending: [],
  };
}

/**
 * The snapshot with no profile (before the first launch is finished, after «Elimina tutti i
 * dati»): no missions, no streak, no level, no message, so a widget left on the home screen
 * shows none of the data deleted.
 */
export function emptyWidgetSnapshot(
  day: GameDay,
  theme: WidgetTheme,
  { texts, generation }: Pick<WidgetExtras, 'texts' | 'generation'>,
): WidgetSnapshot {
  return {
    day,
    generation,
    essential: false,
    state: 'rest',
    streak: 0,
    level: null,
    levelText: null,
    done: 0,
    total: 0,
    remaining: 0,
    remainingText: texts.remaining(0),
    progressText: texts.progress(0, 0),
    message: null,
    remainingTexts: [texts.remaining(0)],
    progressTexts: [texts.progress(0, 0)],
    fullDayText: texts.fullDay,
    missions: [],
    more: 0,
    moreText: null,
    companion: { stage: 'egg', mood: 'normal' },
    unseen: 0,
    unseenText: null,
    colors: { light: colorsOf(theme.light.colors), dark: colorsOf(theme.dark.colors) },
    description: 'GHQ',
    moreA11y: texts.moreLabel,
    urls: { open: TODAY_URL, more: TODAY_URL },
    pending: [],
  };
}
