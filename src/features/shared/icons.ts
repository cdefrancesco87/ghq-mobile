import type { StatKey } from '@/rules/types';
import { SHAPES } from '@/theme/shapes';
import type { ThemeFamily } from '@/theme/themes';
import { LINE_ICON_BODIES, PIXEL_ICON_BODIES } from './generated/svgData';

// The icons of design-sezioni.md A5. Their names are those of the files in assets/design/lotto1/.

export type IconName = keyof typeof LINE_ICON_BODIES | keyof typeof PIXEL_ICON_BODIES;

/** The body sizes of A5: 24 in the tab bar and headers, 20 in rows, 16 in chips. */
export type IconSize = 24 | 20 | 16;

type Bodies = Readonly<Record<string, string | undefined>>;

const LINE: Bodies = LINE_ICON_BODIES;
const PIXEL: Bodies = PIXEL_ICON_BODIES;

const CATEGORY_ICONS: Readonly<Record<string, IconName | undefined>> = {
  health: 'salute',
  mind: 'mente',
  work_study: 'lavoro-studio',
  home: 'casa',
};

/** The default icon of a mission: that of its category (design-sezioni.md 4, Categoria e icona). */
export function categoryIcon(categoryKey: string | null): IconName {
  return (categoryKey === null ? undefined : CATEGORY_ICONS[categoryKey]) ?? 'missioni';
}

/**
 * The icons that a mission can choose in the editor (design-sezioni.md 4.9): those of the
 * categories, then a set of common use. PROVVISORIO (T78): the set is not listed in the documents.
 */
export const MISSION_ICONS = [
  'missioni',
  'salute',
  'mente',
  'lavoro-studio',
  'casa',
  'spada',
  'cuore',
  'sole',
  'nota',
  'timer',
  'calendario',
  'trofeo',
  'regalo',
  'mappa',
  'riposo',
  'compagno',
] as const satisfies readonly IconName[];

const STAT_ICONS: Readonly<Record<StatKey, IconName>> = {
  strength: 'forza',
  constitution: 'costituzione',
  intelligence: 'intelligenza',
  wisdom: 'saggezza',
  charisma: 'carisma',
  discipline: 'disciplina',
};

/** The icon of a hero stat (design-sezioni.md 4.4). */
export function statIcon(stat: StatKey): IconName {
  return STAT_ICONS[stat];
}

/** Every icon of the app. */
export const ICON_NAMES = [...new Set([...Object.keys(LINE), ...Object.keys(PIXEL)])] as IconName[];

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"';

function lineXml(body: string, family: ThemeFamily): string {
  const { width, linecap, linejoin } = SHAPES[family].icon;
  return `${SVG} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="${linecap}" stroke-linejoin="${linejoin}">${body}</svg>`;
}

function pixelXml(body: string): string {
  return `${SVG} viewBox="0 0 12 12" fill="currentColor">${body}</svg>`;
}

/** Arcade prefers the pixel drawing and the other themes the line drawing, when it has both. */
function drawsInPixels(name: IconName, family: ThemeFamily): boolean {
  return PIXEL[name] !== undefined && (family === 'arcade' || LINE[name] === undefined);
}

/**
 * The SVG of an icon, in `currentColor`: when an icon has only one of the two drawings, every theme
 * shows that one.
 */
export function iconXml(name: IconName, family: ThemeFamily): string {
  return drawsInPixels(name, family)
    ? pixelXml(PIXEL[name] as string)
    : lineXml(LINE[name] as string, family);
}

/** The side of an icon: a pixel drawing is always shown at 24 (2×), to stay sharp (A5). */
export function iconSide(name: IconName, family: ThemeFamily, size: IconSize): IconSize {
  return drawsInPixels(name, family) ? 24 : size;
}
