import { FULL_DAY } from '@/rules/config';
import { toGameDay } from '@/rules/gameDay';
import type { Deltas } from '@/rules/types';
import { bonusesToRevert, canUndo, revertDeltas, type DayBonusState } from '@/rules/undo';

const ROME_WINTER = 60;

describe('canUndo', () => {
  it('allows the undo until the day change and refuses it after', () => {
    const completedAt = Date.UTC(2026, 10, 6, 22, 0); // 23:00 on 6 November in Rome
    const eventDay = toGameDay(completedAt, ROME_WINTER, '06:00');
    const beforeChange = toGameDay(Date.UTC(2026, 10, 7, 4, 59), ROME_WINTER, '06:00'); // 05:59
    const afterChange = toGameDay(Date.UTC(2026, 10, 7, 5, 0), ROME_WINTER, '06:00'); // 06:00
    expect(canUndo(eventDay, beforeChange)).toBe(true);
    expect(canUndo(eventDay, afterChange)).toBe(false);
  });

  it('refuses events of other game days', () => {
    expect(canUndo('2026-11-05', '2026-11-06')).toBe(false);
    // After a flight west the game day can move back: the event is not of today.
    expect(canUndo('2026-11-07', '2026-11-06')).toBe(false);
  });

  it('rejects invalid days', () => {
    expect(() => canUndo('2026-02-30', '2026-03-02')).toThrow(RangeError);
  });
});

describe('revertDeltas', () => {
  const completion: Deltas = { xp: 28, coins: 5, hp: 1, stats: { strength: 20, wisdom: 6 } };

  it('gives the opposite changes', () => {
    expect(revertDeltas(completion)).toEqual({
      xp: -28,
      coins: -5,
      hp: -1,
      stats: { strength: -20, wisdom: -6 },
    });
  });

  it('keeps zero as zero', () => {
    expect(revertDeltas({ xp: 0, coins: 0, hp: 0, stats: {} })).toEqual({
      xp: 0,
      coins: 0,
      hp: 0,
      stats: {},
    });
  });

  it('gives back the original changes when applied twice', () => {
    expect(revertDeltas(revertDeltas(completion))).toEqual(completion);
  });

  it('rejects values that are not numbers', () => {
    expect(() => revertDeltas({ ...completion, xp: Number.NaN })).toThrow(RangeError);
    expect(() =>
      revertDeltas({ ...completion, stats: { strength: Number.POSITIVE_INFINITY } }),
    ).toThrow(RangeError);
  });
});

describe('bonusesToRevert', () => {
  function state(overrides: Partial<DayBonusState> = {}): DayBonusState {
    return {
      scheduled: ['a', 'b', 'c'],
      plan: ['a'],
      doneAfterUndo: ['a', 'b', 'c'],
      given: ['bonus.full_day', 'bonus.plan'],
      ...overrides,
    };
  }

  it('takes back the full-day and plan bonuses when the undo reopens the day', () => {
    const toRevert = bonusesToRevert(state({ doneAfterUndo: ['b', 'c'] }));
    expect(toRevert).toEqual(['bonus.full_day', 'bonus.plan']);
    // The full-day bonus is reverted with the opposite of its changes.
    const fullDay: Deltas = { xp: 0, coins: FULL_DAY.bonusCoins, hp: FULL_DAY.bonusHp, stats: {} };
    expect(revertDeltas(fullDay)).toEqual({ xp: 0, coins: -10, hp: -5, stats: {} });
  });

  it('keeps the plan bonus when the undone mission was not a priority', () => {
    expect(bonusesToRevert(state({ doneAfterUndo: ['a', 'c'] }))).toEqual(['bonus.full_day']);
  });

  it('takes back nothing when the day is still complete', () => {
    // The undone completion was of a task that was not due today.
    expect(bonusesToRevert(state())).toEqual([]);
  });

  it('takes back only the bonuses that were given', () => {
    expect(bonusesToRevert(state({ doneAfterUndo: ['b'], given: [] }))).toEqual([]);
    expect(bonusesToRevert(state({ doneAfterUndo: ['b'], given: ['bonus.plan'] }))).toEqual([
      'bonus.plan',
    ]);
  });
});
