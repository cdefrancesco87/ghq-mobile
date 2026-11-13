import type { ThemeColors } from './themes';

// «Colori per daltonici» (design-sezioni.md A4, 10.2; analisi-funzionale.md, accessibility): the
// heatmap, the bars and the states move to one blue–orange scale, the same in every theme, which
// stays apart with deuteranopia and protanopia. Text colours stay those of the theme, which are
// checked for 4.5:1 on its backgrounds; colour is never the only signal anyway.
//
// PROVISIONAL (T82, gap L31): temi.json has no scale yet (task C15). These are the blue and orange
// of the Okabe–Ito palette, made a little lighter or darker so that they reach about 2.8:1 on the
// backgrounds and cards of all six themes (a single colour cannot reach 3:1 on all of them). To be
// checked with a deuteranopia and protanopia simulator and replaced by the values of temi.json.

export const COLORBLIND = {
  /** Done, experience: what went well. */
  blue: '#2f86d4',
  /** Health, boss, danger: what hurts. */
  orange: '#d55e00',
  /** Heatmap levels 1–3 (less than half, at least half, all); level 0 stays the theme's. */
  heatmap: ['#e69f00', '#56b4e9', '#2f86d4'],
} as const;

/** The colours of a theme with the colour-blind scale on heatmap, bars and states. */
export function withColorblindColors(colors: ThemeColors): ThemeColors {
  const [low, half, full] = COLORBLIND.heatmap;
  return {
    ...colors,
    done: COLORBLIND.blue,
    xp: COLORBLIND.blue,
    hp: COLORBLIND.orange,
    boss: COLORBLIND.orange,
    danger: COLORBLIND.orange,
    heatmap: [colors.heatmap[0], low, half, full],
  };
}
