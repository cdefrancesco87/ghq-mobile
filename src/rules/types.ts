/** Difficulty of a mission or of a boss, as stored in the `difficulty` columns. */
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** The six hero stats, as stored in `hero_stats.stat_key`. */
export const STAT_KEYS = [
  'strength',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
  'discipline',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/**
 * A game day in the `YYYY-MM-DD` format, e.g. `2026-11-06`.
 * It can differ from the calendar date: the game day changes at the time chosen by the user,
 * not at midnight.
 */
export type GameDay = `${number}-${number}-${number}`;

/** Stat points by stat: only the stats that change are present. */
export type StatPoints = Partial<Record<StatKey, number>>;

/**
 * How a game action changes the hero. These are the `d_xp`, `d_coins`, `d_hp` and `d_stats`
 * columns of the event log.
 */
export interface Deltas {
  readonly xp: number;
  readonly coins: number;
  readonly hp: number;
  readonly stats: StatPoints;
}

/** Game mode of the `game_mode` setting: the full game or the Essential mode. */
export const GAME_MODES = ['full', 'essential'] as const;
export type GameMode = (typeof GAME_MODES)[number];
