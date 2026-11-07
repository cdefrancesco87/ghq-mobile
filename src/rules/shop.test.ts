import { canUsePotion } from '@/rules/shop';

describe('canUsePotion', () => {
  it('refuses at full hit points (choice 18)', () => {
    expect(canUsePotion(50)).toBe(false);
  });

  it('allows a potion below the maximum, even when it heals less than 10', () => {
    expect(canUsePotion(47)).toBe(true);
    expect(canUsePotion(0)).toBe(true);
  });

  it('rejects hit points that are not valid', () => {
    expect(() => canUsePotion(51)).toThrow(RangeError);
    expect(() => canUsePotion(-1)).toThrow(RangeError);
    expect(() => canUsePotion(2.5)).toThrow(RangeError);
  });
});
