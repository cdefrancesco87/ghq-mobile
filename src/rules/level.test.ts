import { applyXp, heroLevelFromXp, titleIndex, xpToNext, type HeroLevel } from '@/rules/level';

const NEW_HERO: HeroLevel = { level: 1, xpInLevel: 0, xpTotal: 0 };

describe('xpToNext', () => {
  it('is 50 × (level + 3)', () => {
    expect(xpToNext(1)).toBe(200);
    // «Dal livello 7 all'8 servono 500 XP».
    expect(xpToNext(7)).toBe(500);
    expect(xpToNext(49)).toBe(2600);
  });

  it('rejects levels outside 1–50', () => {
    for (const level of [0, 51, 2.5, Number.NaN]) {
      expect(() => xpToNext(level)).toThrow(RangeError);
    }
  });
});

describe('heroLevelFromXp', () => {
  it('matches the table «Livelli» of xp-e-monete.md', () => {
    const table: [level: number, totalXp: number][] = [
      [2, 200],
      [5, 1100],
      [10, 3600],
      [20, 12350],
      [30, 26100],
      [50, 68600],
    ];
    for (const [level, totalXp] of table) {
      expect(heroLevelFromXp(totalXp)).toEqual({ level, xpInLevel: 0, xpTotal: totalXp });
      expect(heroLevelFromXp(totalXp - 1).level).toBe(level - 1);
    }
  });

  it('keeps the XP towards the next level', () => {
    expect(heroLevelFromXp(0)).toEqual(NEW_HERO);
    expect(heroLevelFromXp(199)).toEqual({ level: 1, xpInLevel: 199, xpTotal: 199 });
    expect(heroLevelFromXp(68599)).toEqual({ level: 49, xpInLevel: 2599, xpTotal: 68599 });
  });

  it('rejects negative or fractional XP', () => {
    for (const xpTotal of [-1, 10.5, Number.NaN]) {
      expect(() => heroLevelFromXp(xpTotal)).toThrow(RangeError);
    }
  });
});

describe('applyXp', () => {
  it('adds XP inside the same level', () => {
    expect(applyXp(NEW_HERO, 25)).toEqual({ level: 1, xpInLevel: 25, xpTotal: 25 });
  });

  it('climbs several levels at once', () => {
    expect(applyXp(NEW_HERO, 1100)).toEqual({ level: 5, xpInLevel: 0, xpTotal: 1100 });
    // Level 3 starts at 450 XP and level 4 at 750.
    const hero: HeroLevel = { level: 1, xpInLevel: 150, xpTotal: 150 };
    expect(applyXp(hero, 400)).toEqual({ level: 3, xpInLevel: 100, xpTotal: 550 });
  });

  it('goes back down when an undo takes the XP below the threshold', () => {
    const justLevelTwo: HeroLevel = { level: 2, xpInLevel: 10, xpTotal: 210 };
    expect(applyXp(justLevelTwo, -25)).toEqual({ level: 1, xpInLevel: 185, xpTotal: 185 });
    const levelFive: HeroLevel = { level: 5, xpInLevel: 0, xpTotal: 1100 };
    expect(applyXp(levelFive, -400)).toEqual({ level: 3, xpInLevel: 250, xpTotal: 700 });
  });

  it('never goes below level 1 nor below 0 XP', () => {
    const hero: HeroLevel = { level: 1, xpInLevel: 10, xpTotal: 10 };
    expect(applyXp(hero, -25)).toEqual(NEW_HERO);
  });

  it('stops at level 50, where only the total XP keeps growing', () => {
    const almostMax: HeroLevel = { level: 49, xpInLevel: 2500, xpTotal: 68500 };
    const max = applyXp(almostMax, 300);
    expect(max).toEqual({ level: 50, xpInLevel: 0, xpTotal: 68800 });
    expect(applyXp(max, 1000)).toEqual({ level: 50, xpInLevel: 0, xpTotal: 69800 });
  });

  it('stays at level 50 after an undo that keeps the XP above the threshold', () => {
    const max: HeroLevel = { level: 50, xpInLevel: 0, xpTotal: 68800 };
    expect(applyXp(max, -100)).toEqual({ level: 50, xpInLevel: 0, xpTotal: 68700 });
    expect(applyXp(max, -300)).toEqual({ level: 49, xpInLevel: 2500, xpTotal: 68500 });
  });

  it('recomputes level and XP in the level from the total XP', () => {
    const inconsistent: HeroLevel = { level: 7, xpInLevel: 3, xpTotal: 100 };
    expect(applyXp(inconsistent, 0)).toEqual({ level: 1, xpInLevel: 100, xpTotal: 100 });
  });

  it('rejects a fractional change and an invalid total', () => {
    expect(() => applyXp(NEW_HERO, 2.5)).toThrow(RangeError);
    expect(() => applyXp(NEW_HERO, Number.NaN)).toThrow(RangeError);
    expect(() => applyXp({ level: 1, xpInLevel: 0, xpTotal: -5 }, 10)).toThrow(RangeError);
  });
});

describe('titleIndex', () => {
  it('changes every 5 levels, from 0 at level 1 to 10 at level 50', () => {
    expect(titleIndex(1)).toBe(0);
    expect(titleIndex(4)).toBe(0);
    expect(titleIndex(5)).toBe(1);
    expect(titleIndex(9)).toBe(1);
    expect(titleIndex(10)).toBe(2);
    expect(titleIndex(49)).toBe(9);
    expect(titleIndex(50)).toBe(10);
  });

  it('gives the 11 titles at levels 1, 5, 10 … 50', () => {
    const firstLevels: number[] = [];
    for (let level = 1; level <= 50; level++) {
      if (level === 1 || titleIndex(level) !== titleIndex(level - 1)) {
        firstLevels.push(level);
      }
    }
    expect(firstLevels).toEqual([1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  });

  it('rejects levels outside 1–50', () => {
    for (const level of [0, 51, 1.5]) {
      expect(() => titleIndex(level)).toThrow(RangeError);
    }
  });
});
