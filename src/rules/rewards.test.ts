import { REWARDS } from './config';
import { rewardDots, rewardName, rewardPrice } from './rewards';

describe('rewardPrice', () => {
  it('gives the price of each size from the configuration (choice 22)', () => {
    expect(rewardPrice('small')).toBe(100);
    expect(rewardPrice('medium')).toBe(250);
    expect(rewardPrice('large')).toBe(600);
    expect(rewardPrice('epic')).toBe(1500);
  });

  it('refuses an unknown size', () => {
    expect(() => rewardPrice('huge' as never)).toThrow(RangeError);
  });
});

describe('rewardDots', () => {
  it('shows from 1 to 4 dots for the size (design 7.6)', () => {
    expect(['small', 'medium', 'large', 'epic'].map((size) => rewardDots(size as never))).toEqual([
      1, 2, 3, 4,
    ]);
  });
});

describe('rewardName', () => {
  it('keeps the name without the spaces around it', () => {
    expect(rewardName('  Un episodio della tua serie ')).toBe('Un episodio della tua serie');
  });

  it('refuses an empty name', () => {
    expect(() => rewardName('   ')).toThrow(RangeError);
  });

  it('accepts up to 40 characters and refuses more', () => {
    expect(rewardName('a'.repeat(REWARDS.nameMaxLength))).toHaveLength(40);
    expect(() => rewardName('a'.repeat(REWARDS.nameMaxLength + 1))).toThrow(RangeError);
  });
});
