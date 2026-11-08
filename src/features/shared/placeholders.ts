import type { ThemeFamily } from '@/theme/themes';

// Everything provisional in the art of the app, in one place, so that it can be replaced when the
// final files arrive (task C15; docs/mockup/LEGGIMI.md). The app icon is the exception: the stores
// read PNG files, so its placeholder stays in app.json.

/**
 * DRAFT drawings, viewBox 24, of the icons with no line file in `assets/design/lotto1/linea/`.
 * `oggi` has a pixel file; the others have no file at all.
 */
export const LINE_ICON_PLACEHOLDERS = {
  oggi: '<path d="M4 11l8-7 8 7v9h-5v-5H9v5H4z"/>',
  abitudini: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  nuovo: '<path d="M12 5v14M5 12h14"/>',
  boss: '<path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 5 3.5 6v4h9v-4c2-1 3.5-3 3.5-6a8 8 0 0 0-8-8zM10.5 21v-3M13.5 21v-3"/><circle cx="9" cy="11" r="2"/><circle cx="15" cy="11" r="2"/>',
  profilo: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
} as const;

/** The icons with no line file that show their pixel drawing in every theme. */
export const LINE_ICONS_DRAWN_IN_PIXELS = [
  'calendario',
  'cuore',
  'elimina',
  'esperienza',
  'livello',
  'mappa',
  'modifica',
  'moneta',
  'pozione',
  'promemoria',
  'ripeti',
  'scudo',
  'serie',
  'spada',
  'tema',
  'timer',
  'trofeo',
  'uovo',
] as const;

/** The logo: its files for a light and a dark background, and width ÷ height. */
export const LOGO_PLACEHOLDERS = {
  mark: { light: 'logo-marchio', dark: 'logo-marchio', ratio: 1 },
  horizontal: { light: 'logo-orizzontale', dark: 'logo-orizzontale-scuro', ratio: 3.86 },
  short: { light: 'logo-sigla', dark: 'logo-sigla', ratio: 1.99 },
} as const;

/** The intermediate sprites of the evolution of the companion. */
export const EVOLUTION_STEPS = [1, 2] as const;

export function evolutionSpriteKey(
  family: ThemeFamily,
  step: (typeof EVOLUTION_STEPS)[number],
): string {
  return `compagno-evoluzione-${step}-${family}`;
}
