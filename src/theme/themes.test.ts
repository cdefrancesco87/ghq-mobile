import { contrastRatio } from '@/theme/contrast';
import temi from '@/theme/temi.json';
import { TEXT_PAIRS, THEMES, THEME_KEYS, resolveTheme, type ThemeColors } from '@/theme/themes';

/** The structure of a value: the same keys and the same kinds of values. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(shape);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]));
  }
  return typeof value;
}

/** Roles of temi.json and the token that takes their value. */
const FROM_TEMI: Record<string, keyof ThemeColors> = {
  sfondo: 'background',
  superficie: 'surface',
  bordo: 'border',
  traccia: 'track',
  testo: 'text',
  testoTenue: 'textMuted',
  primario: 'primary',
  vita: 'hp',
  esperienza: 'xp',
  fatto: 'done',
  monete: 'coins',
  boss: 'boss',
  info: 'info',
};

/**
 * Text pairs below 4.5:1 with the colours of temi.json (and the draft coins of Fantasy). They
 * are in the Diary; the colours are not changed here (design-sezioni.md A4 proposes the fixes).
 */
const KNOWN_LOW_CONTRAST = [
  'arcade hp/background',
  'arcade hp/surface',
  'arcade done/surface',
  'fantasy coins/background',
  'fantasy coins/surface',
  'lovecraft hp/background',
  'lovecraft hp/surface',
  'minimal-chiaro hp/background',
  'minimal-chiaro hp/surface',
  'minimal-chiaro coins/background',
  'minimal-chiaro coins/surface',
  'minimal-chiaro done/background',
  'minimal-chiaro done/surface',
];

describe('themes', () => {
  it('has the six themes of temi.json', () => {
    expect(THEME_KEYS).toEqual([
      'arcade',
      'fantasy',
      'cyberpunk',
      'lovecraft',
      'minimal-chiaro',
      'minimal-scuro',
    ]);
  });

  it('gives every theme the same tokens', () => {
    const reference = shape(THEMES.arcade);
    for (const key of THEME_KEYS) {
      expect(shape(THEMES[key])).toEqual(reference);
    }
  });

  it('uses valid colours, and the values of temi.json wherever it gives them', () => {
    for (const key of THEME_KEYS) {
      const colors = THEMES[key].colors;
      for (const colour of [...Object.values(colors).flat()]) {
        expect(colour).toMatch(/^#[0-9a-f]{6}$/);
      }
      const raw: Record<string, string> = temi.temi[key].colori;
      for (const [role, token] of Object.entries(FROM_TEMI)) {
        if (raw[role] !== undefined) {
          expect({ key, token, value: colors[token] }).toEqual({ key, token, value: raw[role] });
        }
      }
      expect(THEMES[key].radius).toBe(temi.temi[key].forma.raggio);
    }
  });

  it('follows the typography table of design-sezioni.md A3', () => {
    expect(THEMES['minimal-scuro'].typography.display).toMatchObject({
      fontFamily: 'Manrope',
      fontWeight: '800',
      fontSize: 32,
    });
    expect(THEMES.arcade.typography.body).toMatchObject({ fontFamily: 'VT323', fontSize: 22 });
    expect(THEMES.fantasy.typography.caption).toMatchObject({
      fontFamily: 'Alegreya',
      italic: true,
    });
    expect(THEMES.cyberpunk.typography.label).toMatchObject({
      fontFamily: 'Share Tech Mono',
      uppercase: true,
    });
    expect(THEMES.lovecraft.typography.numbers).toMatchObject({
      fontFamily: 'Crimson Pro',
      tabularNums: true,
    });
  });

  it('keeps the main text pairs above 4.5:1 in every theme', () => {
    for (const key of THEME_KEYS) {
      const colors = THEMES[key].colors;
      for (const [text, background] of [
        ['text', 'background'],
        ['text', 'surface'],
        ['textMuted', 'background'],
        ['textMuted', 'surface'],
        ['onPrimary', 'primary'],
      ] as const) {
        expect(contrastRatio(colors[text], colors[background])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('lists exactly the declared text pairs that stay below 4.5:1', () => {
    const low = THEME_KEYS.flatMap((key) =>
      TEXT_PAIRS.filter(
        ([text, background]) =>
          contrastRatio(THEMES[key].colors[text], THEMES[key].colors[background]) < 4.5,
      ).map(([text, background]) => `${key} ${text}/${background}`),
    );
    expect(low).toEqual(KNOWN_LOW_CONTRAST);
  });
});

describe('resolveTheme', () => {
  it('lets Minimal follow the light or dark mode of the phone', () => {
    expect(resolveTheme('minimal', 'dark')).toBe('minimal-scuro');
    expect(resolveTheme('minimal', 'light')).toBe('minimal-chiaro');
    expect(resolveTheme('minimal', null)).toBe('minimal-chiaro');
  });

  it('keeps a theme chosen explicitly', () => {
    expect(resolveTheme('minimal-scuro', 'light')).toBe('minimal-scuro');
    expect(resolveTheme('fantasy', 'dark')).toBe('fantasy');
  });
});
