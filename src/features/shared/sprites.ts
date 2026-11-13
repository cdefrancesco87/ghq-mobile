import type { CompanionStage, Mood } from '@/rules/companion';
import type { Difficulty } from '@/rules/types';
import { THEMES, type ThemeFamily, type ThemeKey } from '@/theme/themes';

// The names of the sprite files of assets/design/ (esito-lotto3.md) and how large they are drawn.

/** The moods of the rules plus the pose for the gifts. */
export type CompanionPose = Mood | 'cheering';

/** A boss of a goal, or the one of the starter quest. */
export type BossKind = Difficulty | 'quest';

const STAGE_FILES: Readonly<Record<Exclude<CompanionStage, 'egg'>, string>> = {
  baby: 'cucciolo',
  adult: 'adulto',
};

const POSE_FILES: Readonly<Record<CompanionPose, string>> = {
  happy: 'felice',
  normal: 'normale',
  sad: 'triste',
  cheering: 'esulta',
};

const BOSS_FILES: Readonly<Record<BossKind, string>> = {
  quest: 'quest',
  easy: 'facile',
  medium: 'medio',
  hard: 'difficile',
};

/** Minimal draws the companion in two versions: its themes have the same names as the files. */
function companionFilePrefix(theme: ThemeKey): string {
  const { family } = THEMES[theme];
  return family === 'minimal' ? `compagno-${theme}` : `compagno-${family}`;
}

export function companionSpriteKey(
  theme: ThemeKey,
  stage: CompanionStage,
  pose: CompanionPose,
): string {
  const prefix = companionFilePrefix(theme);
  return stage === 'egg' ? `${prefix}-uovo` : `${prefix}-${STAGE_FILES[stage]}-${POSE_FILES[pose]}`;
}

/** The habitat of the companion sheet (design-sezioni.md 6.10): Minimal has one per version. */
export function habitatKey(theme: ThemeKey): string {
  const { family } = THEMES[theme];
  return family === 'minimal' ? `habitat-${theme}` : `habitat-${family}`;
}

/** `null` for Minimal, which has no boss sprites: a line icon in a circle stands in for them. */
export function bossSpriteKey(family: ThemeFamily, kind: BossKind): string | null {
  return family === 'minimal' ? null : `boss-${family}-${BOSS_FILES[kind]}`;
}

/** The seal of the theme for a plan of the day all done (design-sezioni.md 2.3, esito-lotto4.md). */
export function sealSpriteKey(family: ThemeFamily): string {
  return `sigillo-${family}`;
}

/** The side of a pixel sprite in a box: only whole multiples of its grid (A5), at least once. */
export function spriteSide(grid: number, box: number): number {
  return grid * Math.max(1, Math.floor(box / grid));
}
