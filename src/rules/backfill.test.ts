import { backfillDays, backfillDeltas, canBackfill } from '@/rules/backfill';
import { BACKFILL } from '@/rules/config';
import type { GameDay } from '@/rules/types';

const TODAY = '2026-11-13' as GameDay;

describe('backfillDeltas', () => {
  it('gives the base XP and coins, the stat points and no hit points', () => {
    expect(
      backfillDeltas({ difficulty: 'medium', statPrimary: 'strength', statSecondary: 'wisdom' }),
    ).toEqual({ xp: 25, coins: 5, hp: 0, stats: { strength: 20, wisdom: 6 }, bossDamage: 0 });
  });

  it('gives the base of each difficulty, without stats when the mission has none', () => {
    expect(backfillDeltas({ difficulty: 'easy', statPrimary: null, statSecondary: null })).toEqual({
      xp: 10,
      coins: 2,
      hp: 0,
      stats: {},
      bossDamage: 0,
    });
    expect(
      backfillDeltas({ difficulty: 'hard', statPrimary: 'discipline', statSecondary: null }),
    ).toMatchObject({ xp: 50, coins: 10 });
  });
});

describe('the window of 7 days', () => {
  it('lists the 7 days before today, the latest first', () => {
    expect(BACKFILL.maxDaysBack).toBe(7);
    expect(backfillDays(TODAY)).toEqual([
      '2026-11-12',
      '2026-11-11',
      '2026-11-10',
      '2026-11-09',
      '2026-11-08',
      '2026-11-07',
      '2026-11-06',
    ]);
  });

  it('accepts only those days: not today, not the future, not 8 days ago', () => {
    expect(canBackfill('2026-11-12' as GameDay, TODAY)).toBe(true);
    expect(canBackfill('2026-11-06' as GameDay, TODAY)).toBe(true);
    expect(canBackfill('2026-11-05' as GameDay, TODAY)).toBe(false);
    expect(canBackfill(TODAY, TODAY)).toBe(false);
    expect(canBackfill('2026-11-14' as GameDay, TODAY)).toBe(false);
  });
});
