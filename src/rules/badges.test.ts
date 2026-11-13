import { BADGES } from '@/rules/config';
import {
  badgeProgress,
  checkBadges,
  NO_PROGRESS,
  type BadgeDefinition,
  type BadgeMetrics,
} from '@/rules/badges';

const DEFINITIONS: readonly BadgeDefinition[] = [
  { key: 'first_step', metric: 'completions', target: 1 },
  { key: 'streak_7', metric: 'streakBest', target: 7 },
  { key: 'streak_30', metric: 'streakBest', target: 30 },
  { key: 'boss_1', metric: 'bossesDefeated', target: 1 },
];

const metrics = (values: Partial<BadgeMetrics>): BadgeMetrics => ({ ...NO_PROGRESS, ...values });

describe('badgeProgress', () => {
  it('counts towards the target and stops there', () => {
    expect(badgeProgress(DEFINITIONS[2], metrics({ streakBest: 23 }))).toEqual({
      current: 23,
      target: 30,
      reached: false,
    });
    expect(badgeProgress(DEFINITIONS[1], metrics({ streakBest: 12 }))).toEqual({
      current: 7,
      target: 7,
      reached: true,
    });
  });

  it('never goes below 0', () => {
    expect(badgeProgress(DEFINITIONS[0], metrics({ completions: -2 })).current).toBe(0);
  });
});

describe('checkBadges', () => {
  it('unlocks the badges whose condition is met, in the order of the content', () => {
    expect(
      checkBadges(DEFINITIONS, metrics({ completions: 3, streakBest: 7, bossesDefeated: 1 }), []),
    ).toEqual(['first_step', 'streak_7', 'boss_1']);
  });

  it('never unlocks a badge twice', () => {
    expect(
      checkBadges(DEFINITIONS, metrics({ completions: 3, streakBest: 31 }), [
        'first_step',
        'streak_7',
      ]),
    ).toEqual(['streak_30']);
  });

  it('unlocks nothing at the start', () => {
    expect(checkBadges(DEFINITIONS, NO_PROGRESS, [])).toEqual([]);
  });

  it('gives a whole, positive number of coins', () => {
    expect(Number.isInteger(BADGES.coins)).toBe(true);
    expect(BADGES.coins).toBeGreaterThan(0);
  });
});
