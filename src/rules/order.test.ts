import { MISSION_ORDER } from '@/rules/config';
import { orderBetween } from '@/rules/order';

describe('orderBetween', () => {
  it('puts a row halfway between its two neighbours', () => {
    expect(orderBetween(1, 2)).toBe(1.5);
    expect(orderBetween(1.5, 2)).toBe(1.75);
  });

  it('puts a row one step before the first or after the last', () => {
    expect(orderBetween(null, 3)).toBe(3 - MISSION_ORDER.step);
    expect(orderBetween(3, null)).toBe(3 + MISSION_ORDER.step);
  });

  it('starts from one step in an empty list', () => {
    expect(orderBetween(null, null)).toBe(MISSION_ORDER.step);
  });

  it('says there is no room left when the neighbours are too close', () => {
    expect(orderBetween(1, 1 + MISSION_ORDER.minGap / 2)).toBeNull();
    expect(orderBetween(2, 2)).toBeNull();
  });

  it('rejects neighbours in the wrong order', () => {
    expect(() => orderBetween(3, 1)).toThrow(RangeError);
  });
});
