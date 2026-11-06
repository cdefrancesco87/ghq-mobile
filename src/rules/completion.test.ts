import {
  completionDeltas,
  measurableProgress,
  roundXp,
  streakMultiplier,
  type CompletionInput,
} from '@/rules/completion';

function input(overrides: Partial<CompletionInput> = {}): CompletionInput {
  return {
    difficulty: 'medium',
    heroStreak: 0,
    exhausted: false,
    statPrimary: 'strength',
    statSecondary: 'wisdom',
    ...overrides,
  };
}

describe('completionDeltas', () => {
  it('gives the rewards of the three difficulties', () => {
    expect(completionDeltas(input({ difficulty: 'easy' }))).toEqual({
      xp: 10,
      coins: 2,
      hp: 1,
      stats: { strength: 10, wisdom: 3 },
      bossDamage: 2,
    });
    expect(completionDeltas(input({ difficulty: 'medium' }))).toEqual({
      xp: 25,
      coins: 5,
      hp: 1,
      stats: { strength: 20, wisdom: 6 },
      bossDamage: 5,
    });
    expect(completionDeltas(input({ difficulty: 'hard' }))).toEqual({
      xp: 50,
      coins: 10,
      hp: 1,
      stats: { strength: 30, wisdom: 9 },
      bossDamage: 10,
    });
  });

  it('applies the streak multiplier at 7, 30 and 100 days, rounding once at the end', () => {
    const xpWithStreak = (heroStreak: number) => completionDeltas(input({ heroStreak })).xp;
    expect(xpWithStreak(6)).toBe(25);
    expect(xpWithStreak(7)).toBe(28); // 27.5
    expect(xpWithStreak(29)).toBe(28);
    expect(xpWithStreak(30)).toBe(30);
    expect(xpWithStreak(99)).toBe(30);
    expect(xpWithStreak(100)).toBe(33); // 32.5
  });

  it('never applies the streak multiplier to coins, stat points or boss damage', () => {
    const deltas = completionDeltas(input({ difficulty: 'hard', heroStreak: 100 }));
    expect(deltas).toEqual({
      xp: 65,
      coins: 10,
      hp: 1,
      stats: { strength: 30, wisdom: 9 },
      bossDamage: 10,
    });
  });

  it('halves only the XP on the exhausted day', () => {
    expect(completionDeltas(input({ difficulty: 'easy', exhausted: true })).xp).toBe(5);
    expect(completionDeltas(input({ difficulty: 'hard', exhausted: true })).xp).toBe(25);
    expect(completionDeltas(input({ exhausted: true }))).toEqual({
      xp: 13, // 12.5
      coins: 5,
      hp: 1,
      stats: { strength: 20, wisdom: 6 },
      bossDamage: 5,
    });
    // 25 × 1.1 × 0.5 = 13.75
    expect(completionDeltas(input({ exhausted: true, heroStreak: 7 })).xp).toBe(14);
  });

  it('gives no stat points without a primary stat', () => {
    expect(completionDeltas(input({ statPrimary: null, statSecondary: null })).stats).toEqual({});
  });

  it('rejects a secondary stat equal to the primary and an invalid streak', () => {
    expect(() => completionDeltas(input({ statSecondary: 'strength' }))).toThrow(RangeError);
    expect(() => completionDeltas(input({ heroStreak: -1 }))).toThrow(RangeError);
    expect(() => completionDeltas(input({ heroStreak: 2.5 }))).toThrow(RangeError);
  });
});

describe('streakMultiplier', () => {
  it('follows the thresholds of xp-e-monete.md', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(6)).toBe(1);
    expect(streakMultiplier(7)).toBe(1.1);
    expect(streakMultiplier(29)).toBe(1.1);
    expect(streakMultiplier(30)).toBe(1.2);
    expect(streakMultiplier(99)).toBe(1.2);
    expect(streakMultiplier(100)).toBe(1.3);
    expect(streakMultiplier(365)).toBe(1.3);
  });
});

describe('roundXp', () => {
  it('rounds half up without the floating-point noise of decimal products', () => {
    expect(roundXp(12.5)).toBe(13);
    expect(roundXp(12.49)).toBe(12);
    // 25 × 1.1 is 27.500000000000004 in JavaScript.
    expect(roundXp(25 * 1.1)).toBe(28);
    // 50 × 1.15 is 57.49999999999999 in JavaScript: a plain Math.round would give 57.
    expect(roundXp(50 * 1.15)).toBe(58);
  });
});

describe('measurableProgress', () => {
  it('goes from partial to done, and then beyond without new rewards', () => {
    expect(measurableProgress({ value: 1.5, step: 0.25, target: 2 })).toEqual({
      value: 1.75,
      done: false,
      completesNow: false,
    });
    expect(measurableProgress({ value: 1.75, step: 0.25, target: 2 })).toEqual({
      value: 2,
      done: true,
      completesNow: true,
    });
    expect(measurableProgress({ value: 2, step: 0.25, target: 2 })).toEqual({
      value: 2.25,
      done: true,
      completesNow: false,
    });
  });

  it('completes once even when a step jumps over the target', () => {
    expect(measurableProgress({ value: 18, step: 5, target: 20 })).toEqual({
      value: 23,
      done: true,
      completesNow: true,
    });
  });

  it('reaches the target exactly with decimal steps', () => {
    let value = 0;
    let completions = 0;
    for (let tap = 0; tap < 10; tap++) {
      const progress = measurableProgress({ value, step: 0.1, target: 1 });
      value = progress.value;
      completions += progress.completesNow ? 1 : 0;
    }
    expect(value).toBe(1);
    expect(completions).toBe(1);
  });

  it('rejects invalid values', () => {
    expect(() => measurableProgress({ value: -1, step: 1, target: 2 })).toThrow(RangeError);
    expect(() => measurableProgress({ value: 0, step: 0, target: 2 })).toThrow(RangeError);
    expect(() => measurableProgress({ value: 0, step: -1, target: 2 })).toThrow(RangeError);
    expect(() => measurableProgress({ value: 0, step: 1, target: 0 })).toThrow(RangeError);
    expect(() => measurableProgress({ value: Number.NaN, step: 1, target: 2 })).toThrow(RangeError);
  });
});
