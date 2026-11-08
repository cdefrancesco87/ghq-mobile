import type { ThemeFamily } from '@/theme/themes';

// Everything provisional in the art of the app, in one place, so that it can be replaced when the
// final files arrive (task C15; docs/mockup/LEGGIMI.md). The app icon is the exception: the stores
// read PNG files, so its placeholder stays in app.json.

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
