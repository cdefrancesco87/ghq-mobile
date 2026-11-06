import { FONT_FILES, fontNameOf, textStyleOf } from '@/theme/fonts';
import { THEMES, THEME_KEYS, type TextStyleToken } from '@/theme/themes';

const ALL_STYLES = THEME_KEYS.flatMap((key) => Object.values(THEMES[key].typography));

describe('fonts', () => {
  it('bundles a font for every text style of every theme, and no other', () => {
    const used = new Set(ALL_STYLES.map(fontNameOf));
    expect([...used].sort()).toEqual(Object.keys(FONT_FILES).sort());
  });

  it('names the font after family, weight and italic', () => {
    expect(fontNameOf(THEMES['minimal-chiaro'].typography.display)).toBe('Manrope_800ExtraBold');
    expect(fontNameOf(THEMES.arcade.typography.numbers)).toBe('PressStart2P_400Regular');
    expect(fontNameOf(THEMES.fantasy.typography.caption)).toBe('Alegreya_400Regular_Italic');
    expect(fontNameOf(THEMES.lovecraft.typography.screenTitle)).toBe('IMFellEnglishSC_400Regular');
  });

  it('refuses a font that is not bundled', () => {
    const missing: TextStyleToken = { ...THEMES.arcade.typography.body, fontWeight: '800' };
    expect(() => fontNameOf(missing)).toThrow('not bundled');
  });

  it('turns a typographic role into a text style', () => {
    expect(textStyleOf(THEMES.cyberpunk.typography.sectionTitle)).toEqual({
      fontFamily: 'ChakraPetch_600SemiBold',
      fontSize: 14,
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontVariant: [],
    });
    expect(textStyleOf(THEMES['minimal-scuro'].typography.numbers).fontVariant).toEqual([
      'lining-nums',
      'tabular-nums',
    ]);
  });
});
