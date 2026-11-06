import {
  applyHp,
  canAddToPlan,
  hpLoss,
  isFullDay,
  isPlanComplete,
  skipsLeft,
  type HpLossInput,
} from '@/rules/day';

function lossInput(overrides: Partial<HpLossInput> = {}): HpLossInput {
  return { scheduledXp: 125, missedXp: 0, isRestDay: false, gameMode: 'full', ...overrides };
}

describe('hpLoss', () => {
  it('reproduces the example of the document: 2 medium missed out of 5 cost 4 points', () => {
    expect(hpLoss(lossInput({ scheduledXp: 5 * 25, missedXp: 2 * 25 }))).toBe(4);
  });

  it('never takes more than 10 points', () => {
    expect(hpLoss(lossInput({ scheduledXp: 125, missedXp: 125 }))).toBe(10);
    expect(hpLoss(lossInput({ scheduledXp: 150, missedXp: 150 }))).toBe(10);
  });

  it('rounds the proportion once, half up', () => {
    // 1 easy out of 4 easy: 10 × 10 ÷ 40 = 2.5
    expect(hpLoss(lossInput({ scheduledXp: 40, missedXp: 10 }))).toBe(3);
    // 1 easy out of easy + medium + hard: 10 × 10 ÷ 85 ≈ 1.18
    expect(hpLoss(lossInput({ scheduledXp: 85, missedXp: 10 }))).toBe(1);
  });

  it('takes nothing when nothing was missed or nothing was due', () => {
    expect(hpLoss(lossInput({ missedXp: 0 }))).toBe(0);
    expect(hpLoss(lossInput({ scheduledXp: 0, missedXp: 0 }))).toBe(0);
  });

  it('takes nothing on a rest day', () => {
    expect(hpLoss(lossInput({ missedXp: 125, isRestDay: true }))).toBe(0);
  });

  it('takes nothing in the Essential mode', () => {
    expect(hpLoss(lossInput({ missedXp: 125, gameMode: 'essential' }))).toBe(0);
  });

  it('rejects impossible values', () => {
    expect(() => hpLoss(lossInput({ scheduledXp: 50, missedXp: 75 }))).toThrow(RangeError);
    expect(() => hpLoss(lossInput({ scheduledXp: -25 }))).toThrow(RangeError);
    expect(() => hpLoss(lossInput({ missedXp: 2.5 }))).toThrow(RangeError);
  });
});

describe('applyHp', () => {
  it('adds and removes hit points', () => {
    expect(applyHp(30, 1)).toBe(31);
    expect(applyHp(30, -4)).toBe(26);
  });

  it('never goes above 50, with a potion or the full-day bonus', () => {
    expect(applyHp(45, 10)).toBe(50);
    expect(applyHp(48, 5)).toBe(50);
    expect(applyHp(50, 1)).toBe(50);
  });

  it('never goes below 0', () => {
    expect(applyHp(3, -10)).toBe(0);
    expect(applyHp(0, -4)).toBe(0);
  });

  it('rejects values that are not integers', () => {
    expect(() => applyHp(30, 1.5)).toThrow(RangeError);
    expect(() => applyHp(Number.NaN, 1)).toThrow(RangeError);
  });
});

describe('isFullDay', () => {
  it('is true when every mission due today is done', () => {
    expect(isFullDay(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
  });

  it('is false while a mission is still to do', () => {
    expect(isFullDay(['a', 'b', 'c'], ['a', 'b'])).toBe(false);
  });

  it('ignores completions of missions that were not due today', () => {
    expect(isFullDay(['a'], ['a', 'early-task'])).toBe(true);
  });

  it('is false with no missions due', () => {
    expect(isFullDay([], [])).toBe(false);
    expect(isFullDay([], ['a'])).toBe(false);
  });
});

describe('isPlanComplete', () => {
  it('is true when every priority is done', () => {
    expect(isPlanComplete(['a', 'b'], ['b', 'x', 'a'])).toBe(true);
  });

  it('is false while a priority is still to do', () => {
    expect(isPlanComplete(['a', 'b', 'c'], ['a', 'b'])).toBe(false);
  });

  it('is false with no priorities', () => {
    expect(isPlanComplete([], ['a'])).toBe(false);
  });
});

describe('canAddToPlan', () => {
  it('accepts up to 3 priorities', () => {
    expect(canAddToPlan([])).toBe(true);
    expect(canAddToPlan(['a', 'b'])).toBe(true);
    expect(canAddToPlan(['a', 'b', 'c'])).toBe(false);
  });
});

describe('skipsLeft', () => {
  it('leaves at most 3 skips a week', () => {
    expect(skipsLeft(0)).toBe(3);
    expect(skipsLeft(2)).toBe(1);
    expect(skipsLeft(3)).toBe(0);
    expect(skipsLeft(5)).toBe(0);
  });

  it('rejects a negative or fractional count', () => {
    expect(() => skipsLeft(-1)).toThrow(RangeError);
    expect(() => skipsLeft(1.5)).toThrow(RangeError);
  });
});
