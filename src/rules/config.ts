import type { Difficulty, Language } from './types';

// Every game value that may need tuning, in one place. The values come from
// docs/riferimenti: xp-e-monete.md, statistiche-eroe.md and the «Regole di gioco» section of
// analisi-funzionale.md. They are a first calibration: change them here, never inside the rules.

/** Values that depend on the difficulty of a mission. */
export interface DifficultyValues {
  /** XP of a completion, before the streak multiplier. */
  readonly xp: number;
  /** Coins of a completion (the streak multiplier never applies to coins). */
  readonly coins: number;
  /** Damage dealt to the linked boss. */
  readonly bossDamage: number;
  /** Points given to the primary stat. */
  readonly statPoints: number;
}

export const DIFFICULTY_VALUES = {
  easy: { xp: 10, coins: 2, bossDamage: 2, statPoints: 10 },
  medium: { xp: 25, coins: 5, bossDamage: 5, statPoints: 20 },
  hard: { xp: 50, coins: 10, bossDamage: 10, statPoints: 30 },
} as const satisfies Record<Difficulty, DifficultyValues>;

/** XP multiplier from a streak of at least `fromDays` days, in ascending order. */
export const STREAK_MULTIPLIERS = [
  { fromDays: 7, multiplier: 1.1 },
  { fromDays: 30, multiplier: 1.2 },
  { fromDays: 100, multiplier: 1.3 },
] as const;

export const HERO_LEVELS = {
  /** Highest hero level of the first version. */
  max: 50,
  /** XP to go from level n to n + 1 = xpToNextFactor × (n + xpToNextOffset). */
  xpToNextFactor: 50,
  xpToNextOffset: 3,
  /** The hero title changes every this many levels. */
  titleEveryLevels: 5,
} as const;

/** The name of the hero, up to this many characters (design-sezioni.md 1.3). */
export const HERO_NAME_MAX_LENGTH = 20;

export const STATS = {
  /** Share of the points given to the secondary stat, rounded down. */
  secondaryShare: 0.3,
  /** Points given to the boss stat (if any) by every boss step. */
  bossStepPoints: 10,
  /** Highest stat level of the first version: points above it keep adding up. */
  levelMax: 10,
  /** Points to go from stat level n to n + 1 = pointsToNextFactor × (n + pointsToNextOffset). */
  pointsToNextFactor: 100,
  pointsToNextOffset: 1,
  /** The form arrow compares the points of the last window with those of the window before. */
  formWindowDays: 30,
  /** Minimum change, up or down, that shows the form arrow. */
  formChangeThreshold: 0.1,
  /** No form arrow during the first days of use. */
  formHiddenFirstDays: 30,
} as const;

const HP_MAX = 50;

export const HP = {
  /** Highest hit points. */
  max: HP_MAX,
  /** Highest loss at one day change. */
  dailyLossMax: 10,
  /** Hit points gained with every completion. */
  perCompletion: 1,
  /** XP multiplier on the exhausted day. */
  exhaustedXpMultiplier: 0.5,
  /** Hit points after the exhausted day: 25% of the maximum, rounded up (13 of 50). */
  afterExhaustion: Math.ceil(HP_MAX * 0.25),
} as const;

/** Bonus when every mission due today is completed. */
export const FULL_DAY = {
  bonusCoins: 10,
  bonusHp: 5,
} as const;

/** «Salta oggi» and «Giornata completa» in Today (T59, provisional choices). */
/**
 * Measurable missions (design-sezioni.md 4.7). PROVISIONAL (dev run, T60): the proposed increment
 * is about an eighth of the target, rounded to a handy number; «Inserisci valore» adds the typed
 * amount to the value of the day.
 */
export const MEASURABLE = {
  incrementShareOfTarget: 1 / 8,
  handySteps: [1, 2, 2.5, 5],
  /** Unit chips of the editor, in order; any other text is a custom unit. */
  units: ['liter', 'milliliter', 'page', 'step', 'km', 'time'],
  /** Units counted in whole numbers: the proposed increment is at least 1. */
  wholeUnits: ['milliliter', 'page', 'step', 'time'],
} as const;

/** The counters of «Frequenza» in the editor (design-sezioni.md 4.6) and their first values. */
export const FREQUENCY_EDITOR = {
  timesPerWeek: { min: 1, max: 6, initial: 3 },
  everyNDays: { min: 2, max: 30, initial: 2 },
} as const;

export const SKIP_TODAY = {
  /**
   * A skip that leaves every other mission of the day, or every other priority, done gives the
   * bonus of the full day, or of the plan, so the order of skip and completions does not matter
   * (choice 4 only speaks of completions). Its undo takes the bonus back.
   */
  givesDayBonuses: true,
  /** The short animation of the card «Giornata completa» (design-sezioni.md 2.7). */
  fullDayCardMs: 1500,
} as const;

export const DAY_PLAN = {
  /** Highest number of priorities in the day plan. */
  maxPriorities: 3,
  /** Bonus when every priority of the day plan is completed. */
  bonusXp: 25,
} as const;

export const SKIPS = {
  /** «Salta oggi»: highest number of skips of one mission in a week. */
  maxPerMissionPerWeek: 3,
} as const;

export const SHOP = {
  /** The potion restores hit points, never above `HP.max`. */
  potion: { price: 50, hp: 10 },
  /** The streak shield saves the streaks on one missed day. */
  shield: { price: 100, maxOwned: 2 },
} as const;

/** Multiplier of the victory reward, by boss difficulty. */
const BOSS_DIFFICULTY_MULTIPLIER: Readonly<Record<Difficulty, number>> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
};

export const BOSS = {
  /** Boss hit points = steps × hpPerStep. */
  hpPerStep: 20,
  /** Damage dealt by every completed step. */
  stepDamage: 20,
  /** The boss hit points never go below remaining steps × minHpPerRemainingStep. */
  minHpPerRemainingStep: 10,
  /** Victory XP = steps × victoryXpPerStep × difficultyMultiplier. */
  difficultyMultiplier: BOSS_DIFFICULTY_MULTIPLIER,
  victoryXpPerStep: 10,
  /** Victory coins = victory XP ÷ victoryXpPerCoin, rounded down. */
  victoryXpPerCoin: 5,
  /** On a missed deadline the boss steals this share of the coins, up to deadlineStealMax. */
  deadlineStealShare: 0.1,
  deadlineStealMax: 500,
  /** Warning this many days before the deadline. */
  deadlineWarningDays: 3,
  /**
   * Local time of the system notification of the warning, on the first day of the warning
   * (PROVISIONAL: design-sezioni.md 11.6 gives no time; after any day change, which ends by 06:00).
   */
  deadlineWarningTime: '09:00',
  /** Highest number of active bosses at the same time. */
  maxActive: 3,
  /** A boss has from minSteps to maxSteps steps. */
  minSteps: 2,
  maxSteps: 20,
} as const;

/**
 * Changing the steps of a boss after its creation (CLAUDE.md, choice 21, still reserved: task C13a).
 * PROVISIONAL until Claudio decides: a step added to do brings its hit points, a step to do taken
 * away takes them with it, and the hit points never go below the protected part (10 per step
 * left). A done step can be renamed and moved, not taken away; at least one step to do stays, for
 * the final blow. A deleted boss leaves every list and its missions, and the log keeps what it gave.
 */
export const BOSS_EDIT = {
  /** Hit points gained or lost by the boss for every step to do added or taken away. */
  hpPerStepToDo: BOSS.hpPerStep,
  /** Done steps can be taken away from a boss. */
  canRemoveDoneSteps: false,
  /** Steps to do that must stay after a change. */
  minStepsLeft: 1,
} as const;

/** Victory of the quest of the first launch (CLAUDE.md, choice 12): not the formula of the bosses. */
export const STARTER_QUEST_REWARD = {
  /** The XP missing to reach this level. */
  xpToLevel: 2,
  /** The price of a potion. */
  coins: SHOP.potion.price,
} as const;

export const COMPANION = {
  /** The egg hatches into a puppy at this number of completions. */
  puppyAtCompletions: 1,
  /** The puppy becomes an adult at this number of completions. */
  adultAtCompletions: 150,
  /** The name of the companion, up to this many characters (design-sezioni.md 6.7). */
  nameMaxLength: 20,
} as const;

/** Companion mood, from the share of missions completed in the last days. */
export const MOOD = {
  windowDays: 3,
  /** Happy above this share. */
  happyAbove: 0.7,
  /** Sad below this share. */
  sadBelow: 0.3,
} as const;

/** The Habits list (design-sezioni.md 3.2, 3.7). */
export const HABITS_LIST = {
  /** The completion rate of a row covers this many game days, today included. */
  rateWindowDays: 30,
  /** A completed single task stays in the list this many days, then is archived by itself. */
  doneTaskVisibleDays: 7,
} as const;

/**
 * Pausing a mission (design-sezioni.md 3.6). PROVISIONAL (backlog T62): «3 giorni», «1 settimana»
 * and «2 settimane» are that many game days of pause, today included; the sheet starts on one week
 * as in mockup D19A.
 */
export const MISSION_PAUSE = {
  presetDays: [3, 7, 14],
  defaultDays: 7,
} as const;

/**
 * Statistics, overview (design-sezioni.md 8.2, 8.4). PROVISIONAL (backlog T52): the documents do
 * not say which days the periods cover; they are the last game days up to today, included.
 */
export const STATS_SCREEN = {
  /** «Ultimi 30 giorni», compared with the 30 days before. */
  rateWindowDays: 30,
  /** The streak is compared with the one of this many days before. */
  streakCompareDays: 7,
  /** The mission trends, by period of the selector. */
  periodDays: { week: 7, month: 30, year: 365 },
} as const;

/**
 * The heatmap of Statistics (design-sezioni.md 8.3). PROVISIONAL (backlog T66): the documents give
 * the minimum cell, the space and the months, not how many weeks fit on screen.
 */
export const HEATMAP = {
  /** Weeks of the strip: 12 months and the week of today. */
  weeks: 53,
  /** Weeks the cells try to fill on screen, about 5 months. */
  visibleWeeks: 22,
  /** Smallest side of a cell and the space between cells. */
  minCell: 14,
  gap: 3,
} as const;

/**
 * The detail of a mission (design-sezioni.md 8.5). PROVISIONAL (backlog T53): the documents do
 * not say how many columns the charts have nor how long the history is.
 */
export const MISSION_DETAIL = {
  /** Period Mese: the rate of the current week and of the weeks before it. */
  monthWeeks: 5,
  /** Period Anno: the rate of the current calendar month and of the months before it. */
  yearMonths: 12,
  /** The latest entries of the log shown in the history. */
  historyMax: 20,
} as const;

/** How the reminders are scheduled in the system (stack-tecnologico.md, point 5). */
export const REMINDERS = {
  /** Game days scheduled ahead, from today; they are scheduled again at every start. */
  windowDays: 7,
  /** iOS keeps at most 64 scheduled notifications per app: the earliest ones win. */
  maxScheduled: 64,
} as const;

/** Language of the first launch when no device language is supported (CLAUDE.md, choice 19). */
export const FALLBACK_LANGUAGE: Language = 'en';

/** The Profile (design-sezioni.md 9.2, 9.5). */
export const PROFILE = {
  /**
   * The name of the hero changed from the Profile, up to this many characters (design 9.2). The
   * first launch keeps HERO_NAME_MAX_LENGTH (design 1.3).
   */
  nameMaxLength: 24,
  /**
   * The latest gains of a stat in its detail. PROVISIONAL (backlog T54): the documents do not
   * say how many.
   */
  recentGainsMax: 5,
} as const;

/** The Settings (design-sezioni.md 10.6). */
export const SETTINGS_SCREEN = {
  /**
   * The interval of «Non disturbare» added with «+ Aggiungi intervallo», then changed by the user.
   * PROVISIONAL (backlog T55): the documents give only the example 22:00–07:00.
   */
  newQuietInterval: { start: '22:00', end: '07:00' },
} as const;

/** The backup in the cloud (stack-tecnologico.md, point 4; design-sezioni.md 10.8). */
export const BACKUP = {
  /** The system runs the automatic backup at most this often, in minutes: once a day. */
  autoIntervalMinutes: 24 * 60,
  /**
   * The automatic backup is skipped when the last one is more recent than this, in hours, so a
   * task that the system runs a little early does not make two backups on the same day.
   * PROVISIONAL (backlog T57): the documents say only «giornaliero».
   */
  autoMinGapHours: 20,
} as const;
