import { parseAmount, suggestIncrement } from './measurable';

describe('suggestIncrement', () => {
  it('proposes about an eighth of the target, rounded to a handy number', () => {
    expect(suggestIncrement(2, false)).toBe(0.25);
    expect(suggestIncrement(2000, true)).toBe(250);
    expect(suggestIncrement(10000, true)).toBe(1000);
    expect(suggestIncrement(30, true)).toBe(5);
    expect(suggestIncrement(5, false)).toBe(0.5);
  });

  it('never goes below 1 for whole units such as pages or times', () => {
    expect(suggestIncrement(3, true)).toBe(1);
    expect(suggestIncrement(1, true)).toBe(1);
  });

  it('never goes above the target', () => {
    expect(suggestIncrement(0.1, false)).toBeLessThanOrEqual(0.1);
  });

  it('gives null for a missing or wrong target', () => {
    expect(suggestIncrement(0, false)).toBeNull();
    expect(suggestIncrement(Number.NaN, true)).toBeNull();
  });
});

describe('parseAmount', () => {
  it('reads dots and commas as the decimal separator', () => {
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount(' 0.25 ')).toBe(0.25);
    expect(parseAmount('250')).toBe(250);
  });

  it('gives null for empty, zero, negative or wrong values', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('-2')).toBeNull();
    expect(parseAmount('2a')).toBeNull();
    expect(parseAmount('1,2,3')).toBeNull();
  });
});
