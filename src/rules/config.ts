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
  /** Highest number of active bosses at the same time. */
  maxActive: 3,
  /** A boss has from minSteps to maxSteps steps. */
  minSteps: 2,
  maxSteps: 20,
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
} as const;

/** Companion mood, from the share of missions completed in the last days. */
export const MOOD = {
  windowDays: 3,
  /** Happy above this share. */
  happyAbove: 0.7,
  /** Sad below this share. */
  sadBelow: 0.3,
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
