import {
  applyBossDamage,
  bossHpMax,
  bossPreview,
  canCreateBoss,
  daysTaken,
  deadlineSteal,
  deadlineWarningAt,
  editedBossHp,
  protectedHp,
  shouldWarnDeadline,
  starterQuestReward,
  stepStatPoints,
  victoryReward,
  victoryShield,
  type BossHealth,
} from '@/rules/boss';
import type { Difficulty, StatKey } from '@/rules/types';

describe('bossHpMax', () => {
  it('is 20 hit points per step', () => {
    expect(bossHpMax(8)).toBe(160);
    expect(bossHpMax(2)).toBe(40);
    expect(bossHpMax(20)).toBe(400);
  });

  it('accepts only 2 to 20 steps', () => {
    for (const steps of [1, 21, 2.5]) {
      expect(() => bossHpMax(steps)).toThrow(RangeError);
    }
  });
});

describe('applyBossDamage', () => {
  it('takes the damage of a linked mission', () => {
    expect(applyBossDamage({ hp: 160, stepsLeft: 8 }, 5)).toEqual({ hp: 155, defeated: false });
  });

  it('never lets missions take the boss below 10 × steps left', () => {
    expect(applyBossDamage({ hp: 85, stepsLeft: 8 }, 10)).toEqual({ hp: 80, defeated: false });
    expect(applyBossDamage({ hp: 80, stepsLeft: 8 }, 10)).toEqual({ hp: 80, defeated: false });
    expect(applyBossDamage({ hp: 12, stepsLeft: 1 }, 10)).toEqual({ hp: 10, defeated: false });
  });

  it('lets only the last step defeat the boss', () => {
    // Eight steps and nothing else: 20 damage each, the eighth one wins.
    let boss: BossHealth = { hp: bossHpMax(8), stepsLeft: 8 };
    const hitPoints: number[] = [];
    let defeated = false;
    while (boss.stepsLeft > 0) {
      const stepsLeft = boss.stepsLeft - 1;
      const hit = applyBossDamage({ hp: boss.hp, stepsLeft }, 20);
      hitPoints.push(hit.hp);
      defeated = hit.defeated;
      boss = { hp: hit.hp, stepsLeft };
    }
    expect(hitPoints).toEqual([140, 120, 100, 80, 60, 40, 20, 0]);
    expect(defeated).toBe(true);
  });

  it('defeats the boss with the last step even after many mission hits', () => {
    expect(applyBossDamage({ hp: 10, stepsLeft: 0 }, 20)).toEqual({ hp: 0, defeated: true });
  });

  it('never heals the boss', () => {
    expect(applyBossDamage({ hp: 15, stepsLeft: 2 }, 5)).toEqual({ hp: 15, defeated: false });
  });

  it('rejects negative or fractional values', () => {
    expect(() => applyBossDamage({ hp: 100, stepsLeft: 5 }, -5)).toThrow(RangeError);
    expect(() => applyBossDamage({ hp: 100, stepsLeft: 5 }, 2.5)).toThrow(RangeError);
    expect(() => applyBossDamage({ hp: -1, stepsLeft: 5 }, 5)).toThrow(RangeError);
    expect(() => applyBossDamage({ hp: 100, stepsLeft: 1.5 }, 5)).toThrow(RangeError);
  });
});

describe('victoryReward', () => {
  it('gives steps × 10 XP × difficulty and a fifth of it in coins', () => {
    expect(victoryReward(4, 'medium')).toEqual({ xp: 60, coins: 12 });
    expect(victoryReward(4, 'easy')).toEqual({ xp: 40, coins: 8 });
    expect(victoryReward(4, 'hard')).toEqual({ xp: 80, coins: 16 });
    expect(victoryReward(3, 'medium')).toEqual({ xp: 45, coins: 9 });
  });

  it('rejects invalid steps and difficulties', () => {
    expect(() => victoryReward(1, 'medium')).toThrow(RangeError);
    expect(() => victoryReward(4, 'epic' as Difficulty)).toThrow(RangeError);
  });
});

describe('bossPreview', () => {
  it('shows the hit points and the reward of a new boss (design-sezioni.md 5.2)', () => {
    expect(bossPreview(8, 'medium')).toEqual({ hp: 160, xp: 120, coins: 24 });
    expect(bossPreview(2, 'easy')).toEqual({ hp: 40, xp: 20, coins: 4 });
    expect(bossPreview(20, 'hard')).toEqual({ hp: 400, xp: 400, coins: 80 });
  });

  it('has no preview with too few or too many steps', () => {
    expect(bossPreview(0, 'medium')).toBeNull();
    expect(bossPreview(1, 'medium')).toBeNull();
    expect(bossPreview(21, 'medium')).toBeNull();
  });
});

describe('deadlineSteal', () => {
  it('steals 10% of the coins, at most 500', () => {
    expect(deadlineSteal(300)).toBe(30);
    expect(deadlineSteal(8000)).toBe(500);
    expect(deadlineSteal(5000)).toBe(500);
    expect(deadlineSteal(4999)).toBe(499);
  });

  it('rounds down and steals nothing from an empty purse', () => {
    expect(deadlineSteal(35)).toBe(3);
    expect(deadlineSteal(0)).toBe(0);
  });

  it('rejects negative or fractional coins', () => {
    expect(() => deadlineSteal(-10)).toThrow(RangeError);
    expect(() => deadlineSteal(10.5)).toThrow(RangeError);
  });
});

describe('shouldWarnDeadline', () => {
  it('warns 3 days before the deadline, only once', () => {
    expect(shouldWarnDeadline('2026-11-07', '2026-11-10', false)).toBe(true);
    expect(shouldWarnDeadline('2026-11-07', '2026-11-10', true)).toBe(false);
  });

  it('does not warn earlier', () => {
    expect(shouldWarnDeadline('2026-11-06', '2026-11-10', false)).toBe(false);
  });

  it('still warns once in the last days if the app was not opened 3 days before', () => {
    expect(shouldWarnDeadline('2026-11-09', '2026-11-10', false)).toBe(true);
    expect(shouldWarnDeadline('2026-11-10', '2026-11-10', false)).toBe(true);
  });

  it('does not warn after the deadline or without a deadline', () => {
    expect(shouldWarnDeadline('2026-11-11', '2026-11-10', false)).toBe(false);
    expect(shouldWarnDeadline('2026-11-07', null, false)).toBe(false);
  });
});

describe('canCreateBoss', () => {
  it('allows at most 3 active bosses', () => {
    expect(canCreateBoss(0)).toBe(true);
    expect(canCreateBoss(2)).toBe(true);
    expect(canCreateBoss(3)).toBe(false);
  });

  it('rejects a negative or fractional count', () => {
    expect(() => canCreateBoss(-1)).toThrow(RangeError);
    expect(() => canCreateBoss(1.5)).toThrow(RangeError);
  });
});

describe('stepStatPoints', () => {
  it('gives 10 points to the boss stat at every step', () => {
    expect(stepStatPoints('wisdom')).toEqual({ wisdom: 10 });
  });

  it('gives nothing when the boss has no stat', () => {
    expect(stepStatPoints(null)).toEqual({});
  });

  it('rejects an unknown stat', () => {
    expect(() => stepStatPoints('luck' as StatKey)).toThrow(RangeError);
  });
});

describe('starterQuestReward', () => {
  it('gives the XP missing to level 2 and the coins of a potion', () => {
    expect(starterQuestReward({ level: 1, xpInLevel: 0 })).toEqual({ xp: 200, coins: 50 });
    expect(starterQuestReward({ level: 1, xpInLevel: 35 })).toEqual({ xp: 165, coins: 50 });
  });

  it('gives no XP to a hero already at level 2 or above', () => {
    expect(starterQuestReward({ level: 2, xpInLevel: 10 })).toEqual({ xp: 0, coins: 50 });
    expect(starterQuestReward({ level: 7, xpInLevel: 0 })).toEqual({ xp: 0, coins: 50 });
  });
});

describe('protectedHp', () => {
  it('is 10 hit points per step left, the part that only the last step can take', () => {
    expect(protectedHp({ hp: 100, stepsLeft: 5 })).toBe(50);
    expect(protectedHp({ hp: 160, stepsLeft: 8 })).toBe(80);
    expect(protectedHp({ hp: 12, stepsLeft: 1 })).toBe(10);
  });

  it('is never more than the hit points left', () => {
    expect(protectedHp({ hp: 30, stepsLeft: 5 })).toBe(30);
  });

  it('is nothing for a defeated boss', () => {
    expect(protectedHp({ hp: 0, stepsLeft: 0 })).toBe(0);
  });

  it('accepts only non-negative integers', () => {
    expect(() => protectedHp({ hp: -1, stepsLeft: 2 })).toThrow(RangeError);
    expect(() => protectedHp({ hp: 40, stepsLeft: 1.5 })).toThrow(RangeError);
  });
});

describe('editedBossHp', () => {
  it('adds or takes away 20 hit points for every step to do, keeping the damage dealt', () => {
    // 4 steps, 1 done and 15 damage from the missions: 80 − 20 − 15 = 45 hit points.
    expect(editedBossHp({ hp: 45, stepsLeft: 3 }, 4, 100)).toBe(65);
    expect(editedBossHp({ hp: 45, stepsLeft: 3 }, 2, 60)).toBe(25);
  });

  it('changes nothing when the steps to do stay the same', () => {
    expect(editedBossHp({ hp: 45, stepsLeft: 3 }, 3, 80)).toBe(45);
  });

  it('never goes below the protected part nor above the maximum', () => {
    // 3 steps to do at the floor (30): one taken away leaves 2 steps, floor 20.
    expect(editedBossHp({ hp: 30, stepsLeft: 3 }, 2, 40)).toBe(20);
    expect(editedBossHp({ hp: 60, stepsLeft: 3 }, 4, 70)).toBe(70);
  });

  it('refuses values that are not non-negative integers', () => {
    expect(() => editedBossHp({ hp: -1, stepsLeft: 2 }, 2, 40)).toThrow(RangeError);
    expect(() => editedBossHp({ hp: 40, stepsLeft: 2 }, 1.5, 40)).toThrow(RangeError);
  });
});

describe('deadlineWarningAt', () => {
  it('is 09:00 local time 3 days before the deadline', () => {
    // UTC+1: 09:00 local is 08:00 UTC.
    expect(new Date(deadlineWarningAt('2026-11-12', 60)).toISOString()).toBe(
      '2026-11-09T08:00:00.000Z',
    );
    // UTC-5 across the end of a month.
    expect(new Date(deadlineWarningAt('2026-12-02', -300)).toISOString()).toBe(
      '2026-11-29T14:00:00.000Z',
    );
  });
});

describe('daysTaken', () => {
  it('counts the days from the creation to the victory, at least 1', () => {
    expect(daysTaken('2026-08-01', '2026-08-15')).toBe(14);
    expect(daysTaken('2026-08-01', '2026-08-02')).toBe(1);
    expect(daysTaken('2026-08-01', '2026-08-01')).toBe(1);
  });
});

describe('victoryShield', () => {
  it('gives a shield while the hero owns fewer than 2', () => {
    expect(victoryShield(0)).toEqual({ shield: 1, coins: 0 });
    expect(victoryShield(1)).toEqual({ shield: 1, coins: 0 });
  });

  it('gives 100 coins instead with 2 shields already', () => {
    expect(victoryShield(2)).toEqual({ shield: 0, coins: 100 });
  });

  it('refuses a negative or fractional number of shields', () => {
    expect(() => victoryShield(-1)).toThrow(RangeError);
    expect(() => victoryShield(1.5)).toThrow(RangeError);
  });
});
