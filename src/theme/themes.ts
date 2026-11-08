import type { SettingValue } from '../db/repositories/settings';
import { relativeLuminance } from './contrast';
import temi from './temi.json';

// The six themes as typed tokens (design-temi.md; design-sezioni.md A3 and A4). The screens use
// only the roles, never the values.
//
// Colours come from temi.json, which does not give every role of A4 to every theme: the missing
// roles are DRAFT values derived from the palette of the same theme in `colorsOf`, to be reviewed
// by Claudio. Typography is the table of A3.

/** The themes of temi.json. */
export type ThemeKey = keyof typeof temi.temi;
export const THEME_KEYS = Object.keys(temi.temi) as ThemeKey[];

/** Lexicon and titles are per family: the two Minimal themes share theirs. */
export type ThemeFamily = 'arcade' | 'fantasy' | 'cyberpunk' | 'lovecraft' | 'minimal';

/** The colour roles of design-sezioni.md A4. */
export interface ThemeColors {
  /** Sfondo: background of the screen. */
  readonly background: string;
  /** Superficie: cards. */
  readonly surface: string;
  /** Superficie alta: sheets and menus. */
  readonly surfaceHigh: string;
  readonly border: string;
  /** Traccia: dividers and the empty part of the bars. */
  readonly track: string;
  readonly text: string;
  readonly textMuted: string;
  /** Main actions and the [+] button. */
  readonly primary: string;
  /** Text on the primary colour. */
  readonly onPrimary: string;
  readonly hp: string;
  /** Text colour for HP values (accessible on background and surface). */
  readonly hpText: string;
  readonly xp: string;
  readonly coins: string;
  /** Text colour for coin values (accessible on background and surface). */
  readonly coinsText: string;
  readonly done: string;
  /** Text colour for done state (accessible on background and surface). */
  readonly doneText: string;
  readonly skipped: string;
  readonly danger: string;
  /** Text colour for danger messages (accessible on background and surface). */
  readonly dangerText: string;
  readonly info: string;
  /** Text colour for info messages (accessible on background and surface). */
  readonly infoText: string;
  readonly boss: string;
  /** Four levels for the heatmap, from empty (level 0) to full (level 3). */
  readonly heatmap: readonly [string, string, string, string];
}

export interface TextStyleToken {
  readonly fontFamily: string;
  readonly fontWeight: '400' | '500' | '600' | '700' | '800';
  readonly fontSize: number;
  readonly uppercase: boolean;
  readonly letterSpacing: number;
  readonly italic: boolean;
  /** Lining tabular figures, so that counters do not jump. */
  readonly tabularNums: boolean;
}

/** The eight typographic roles of design-sezioni.md A3 and misure-componenti.md. */
export interface Typography {
  readonly display: TextStyleToken;
  readonly screenTitle: TextStyleToken;
  readonly sectionTitle: TextStyleToken;
  readonly body: TextStyleToken;
  readonly label: TextStyleToken;
  readonly numbers: TextStyleToken;
  readonly caption: TextStyleToken;
  /** Label under tab-bar icons. */
  readonly navLabel: TextStyleToken;
}

export interface ThemeTokens {
  readonly key: ThemeKey;
  readonly family: ThemeFamily;
  /** A dark background: light status bar and light sprites. */
  readonly dark: boolean;
  readonly colors: ThemeColors;
  readonly typography: Typography;
  /** Corner radius of buttons and cards. */
  readonly radius: number;
}

type RawColours = Readonly<Record<string, string | undefined>>;

function colorsOf(key: ThemeKey, raw: RawColours): ThemeColors {
  const required = (role: string): string => {
    const value = raw[role];
    if (value === undefined) {
      throw new Error(`temi.json: theme ${key} has no colour «${role}»`);
    }
    return value;
  };
  return {
    background: required('sfondo'),
    surface: required('superficie'),
    surfaceHigh: required('superficieAlta'),
    border: required('bordo'),
    track: required('traccia'),
    text: required('testo'),
    textMuted: required('testoTenue'),
    primary: required('primario'),
    onPrimary: required('suPrimario'),
    hp: required('vita'),
    hpText: required('vitaTesto'),
    xp: required('esperienza'),
    coins: required('monete'),
    coinsText: required('moneteTesto'),
    done: required('fatto'),
    doneText: required('fattoTesto'),
    skipped: required('saltato'),
    danger: required('pericolo'),
    dangerText: required('pericoloTesto'),
    info: required('info'),
    infoText: required('infoTesto'),
    boss: required('boss'),
    heatmap: [
      required('heatmap0'),
      required('heatmap1'),
      required('heatmap2'),
      required('heatmap3'),
    ],
  };
}

function style(
  fontFamily: string,
  fontWeight: TextStyleToken['fontWeight'],
  fontSize: number,
  extra: Partial<
    Pick<TextStyleToken, 'uppercase' | 'letterSpacing' | 'italic' | 'tabularNums'>
  > = {},
): TextStyleToken {
  return {
    fontFamily,
    fontWeight,
    fontSize,
    uppercase: false,
    letterSpacing: 0,
    italic: false,
    tabularNums: false,
    ...extra,
  };
}

/** The table of design-sezioni.md A3 («spaziato» is a DRAFT letter spacing of 1). */
const TYPOGRAPHY: Readonly<Record<ThemeFamily, Typography>> = {
  minimal: {
    display: style('Manrope', '800', 32),
    screenTitle: style('Manrope', '800', 24),
    sectionTitle: style('Manrope', '700', 17),
    body: style('Manrope', '500', 16),
    label: style('Manrope', '600', 14),
    numbers: style('Manrope', '700', 15, { tabularNums: true }),
    caption: style('Manrope', '500', 12),
    navLabel: style('Manrope', '600', 11),
  },
  arcade: {
    display: style('Press Start 2P', '400', 20),
    screenTitle: style('Press Start 2P', '400', 14),
    sectionTitle: style('Press Start 2P', '400', 10, { uppercase: true }),
    body: style('VT323', '400', 22),
    label: style('VT323', '400', 20, { uppercase: true }),
    numbers: style('Press Start 2P', '400', 11),
    caption: style('VT323', '400', 18),
    navLabel: style('VT323', '400', 14, { uppercase: true }),
  },
  fantasy: {
    display: style('Cinzel', '700', 30),
    screenTitle: style('Cinzel', '700', 22),
    sectionTitle: style('Cinzel', '600', 15, { letterSpacing: 1 }),
    body: style('Alegreya', '400', 17),
    label: style('Alegreya', '500', 15),
    numbers: style('Alegreya', '500', 16, { tabularNums: true }),
    caption: style('Alegreya', '400', 14, { italic: true }),
    navLabel: style('Alegreya', '500', 13),
  },
  cyberpunk: {
    display: style('Chakra Petch', '700', 30, { uppercase: true }),
    screenTitle: style('Chakra Petch', '600', 22, { uppercase: true }),
    sectionTitle: style('Chakra Petch', '600', 14, { uppercase: true, letterSpacing: 1 }),
    body: style('Chakra Petch', '400', 16),
    label: style('Share Tech Mono', '400', 14, { uppercase: true }),
    numbers: style('Share Tech Mono', '400', 15),
    caption: style('Share Tech Mono', '400', 12),
    navLabel: style('Chakra Petch', '600', 11, { uppercase: true }),
  },
  lovecraft: {
    display: style('IM Fell English SC', '400', 30),
    screenTitle: style('IM Fell English SC', '400', 24),
    sectionTitle: style('IM Fell English SC', '400', 17),
    body: style('Crimson Pro', '400', 18),
    label: style('Crimson Pro', '600', 15),
    numbers: style('Crimson Pro', '600', 16, { tabularNums: true }),
    caption: style('Crimson Pro', '400', 14, { italic: true }),
    navLabel: style('Crimson Pro', '600', 13),
  },
};

function familyOf(key: ThemeKey): ThemeFamily {
  return key.startsWith('minimal') ? 'minimal' : (key as ThemeFamily);
}

export const THEMES: Readonly<Record<ThemeKey, ThemeTokens>> = Object.fromEntries(
  THEME_KEYS.map((key) => {
    const raw = temi.temi[key];
    const colors = colorsOf(key, raw.colori as RawColours);
    const tokens: ThemeTokens = {
      key,
      family: familyOf(key),
      dark: relativeLuminance(colors.background) < 0.5,
      colors,
      typography: TYPOGRAPHY[familyOf(key)],
      radius: raw.forma.raggio,
    };
    return [key, tokens];
  }),
) as Record<ThemeKey, ThemeTokens>;

/** The colour roles with a single colour (all but the heatmap). */
export type ColorRole = Exclude<keyof ThemeColors, 'heatmap'>;

/** The text and background roles used together: text needs a contrast of at least 4.5:1. */
export const TEXT_PAIRS: readonly (readonly [ColorRole, ColorRole])[] = [
  ['text', 'background'],
  ['text', 'surface'],
  ['text', 'surfaceHigh'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['onPrimary', 'primary'],
  ['hpText', 'background'],
  ['hpText', 'surface'],
  ['xp', 'background'],
  ['xp', 'surface'],
  ['coinsText', 'background'],
  ['coinsText', 'surface'],
  ['doneText', 'background'],
  ['doneText', 'surface'],
  ['dangerText', 'background'],
  ['dangerText', 'surface'],
  ['infoText', 'background'],
  ['infoText', 'surface'],
];

/**
 * The theme to show for the `theme` setting: `minimal` follows the light or dark mode of the
 * phone (US-ONB-02), the other values are themes.
 */
export function resolveTheme(
  setting: SettingValue<'theme'>,
  colorScheme: string | null | undefined,
): ThemeKey {
  if (setting === 'minimal') {
    return colorScheme === 'dark' ? 'minimal-scuro' : 'minimal-chiaro';
  }
  return setting;
}
