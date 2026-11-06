import { contrastRatio, mixColours, relativeLuminance } from '@/theme/contrast';

describe('contrastRatio', () => {
  it('goes from 1 for the same colour to 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#3e63dd', '#3e63dd')).toBe(1);
  });

  it('gives the known value of the WCAG grey and does not depend on the order', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
    expect(contrastRatio('#ffffff', '#767676')).toBe(contrastRatio('#767676', '#ffffff'));
  });

  it('rejects colours that are not #rrggbb', () => {
    expect(() => contrastRatio('#fff', '#000000')).toThrow(RangeError);
    expect(() => relativeLuminance('red')).toThrow(RangeError);
  });
});

describe('mixColours', () => {
  it('mixes two colours channel by channel', () => {
    expect(mixColours('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixColours('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixColours('#000000', '#ffffff', 1)).toBe('#ffffff');
  });
});
