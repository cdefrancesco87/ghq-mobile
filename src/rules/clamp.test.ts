import { clamp } from '@/rules/clamp';

describe('clamp', () => {
  it('returns the value when it is inside the range', () => {
    expect(clamp(25, 0, 50)).toBe(25);
  });

  it('keeps the bounds themselves', () => {
    expect(clamp(0, 0, 50)).toBe(0);
    expect(clamp(50, 0, 50)).toBe(50);
  });

  it('raises a value below the minimum', () => {
    expect(clamp(-3, 0, 50)).toBe(0);
  });

  it('lowers a value above the maximum', () => {
    expect(clamp(57, 0, 50)).toBe(50);
  });

  it('rejects a range whose minimum is above the maximum', () => {
    expect(() => clamp(5, 10, 1)).toThrow(RangeError);
  });
});
