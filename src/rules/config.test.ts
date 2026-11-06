import {
  BOSS,
  COMPANION,
  DAY_PLAN,
  DIFFICULTY_VALUES,
  FULL_DAY,
  HERO_LEVELS,
  HP,
  MOOD,
  SHOP,
  SKIPS,
  STATS,
  STREAK_MULTIPLIERS,
} from '@/rules/config';
import { DIFFICULTIES, STAT_KEYS, type Difficulty } from '@/rules/types';

// Each case copies one table (or one list of rules) of docs/riferimenti and compares it with
// config.ts: a value changed in only one of the two places makes the test fail.

/** Total XP needed to go from level 1 to `level`. */
function totalXpFor(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n++) {
    total += HERO_LEVELS.xpToNextFactor * (n + HERO_LEVELS.xpToNextOffset);
  }
  return total;
}

/** Total points needed to take a stat from level 0 to `level`. */
function totalStatPointsFor(level: number): number {
  let total = 0;
  for (let n = 0; n < level; n++) {
    total += STATS.pointsToNextFactor * (n + STATS.pointsToNextOffset);
  }
  return total;
}

describe('game configuration', () => {
  it('matches «Ricompense per missione» in analisi-funzionale.md, «Regole di gioco»', () => {
    // The «Vita tolta se mancata» column is replaced by the «Vita» rule, so it is not configured.
    expect(DIFFICULTY_VALUES.easy).toMatchObject({ xp: 10, coins: 2, bossDamage: 2 });
    expect(DIFFICULTY_VALUES.medium).toMatchObject({ xp: 25, coins: 5, bossDamage: 5 });
    expect(DIFFICULTY_VALUES.hard).toMatchObject({ xp: 50, coins: 10, bossDamage: 10 });
  });

  it('matches «Quanti XP vale una missione» in xp-e-monete.md, section 1', () => {
    expect(DIFFICULTY_VALUES.easy).toMatchObject({ xp: 10, coins: 2 });
    expect(DIFFICULTY_VALUES.medium).toMatchObject({ xp: 25, coins: 5 });
    expect(DIFFICULTY_VALUES.hard).toMatchObject({ xp: 50, coins: 10 });
  });

  it('has the «Valori di difficoltà» of xp-e-monete.md, section 4', () => {
    // XP, coins and boss damage for every difficulty, plus the daily cap on lost hit points.
    expect(Object.keys(DIFFICULTY_VALUES)).toEqual([...DIFFICULTIES]);
    for (const difficulty of DIFFICULTIES) {
      expect(DIFFICULTY_VALUES[difficulty]).toEqual({
        xp: expect.any(Number),
        coins: expect.any(Number),
        bossDamage: expect.any(Number),
        statPoints: expect.any(Number),
      });
    }
    expect(HP.dailyLossMax).toBe(10);
  });

  it('matches «Livelli» in xp-e-monete.md, section 1', () => {
    // «Dal livello 7 all'8 servono 500 XP».
    expect(HERO_LEVELS.xpToNextFactor * (7 + HERO_LEVELS.xpToNextOffset)).toBe(500);
    const table: [level: number, totalXp: number][] = [
      [2, 200],
      [5, 1100],
      [10, 3600],
      [20, 12350],
      [30, 26100],
      [50, 68600],
    ];
    for (const [level, totalXp] of table) {
      expect(totalXpFor(level)).toBe(totalXp);
    }
    expect(HERO_LEVELS.max).toBe(50);
    // «Il titolo dell'eroe cambia ogni 5 livelli».
    expect(HERO_LEVELS.titleEveryLevels).toBe(5);
  });

  it('matches «Come si spendono» in xp-e-monete.md, section 2', () => {
    expect(SHOP.potion).toEqual({ price: 50, hp: 10 });
    expect(HP.max).toBe(50);
    expect(SHOP.shield).toEqual({ price: 100, maxOwned: 2 });
  });

  it('matches «Le sei statistiche» in statistiche-eroe.md, with the keys of modello-dati.md', () => {
    // Forza, Costituzione, Intelligenza, Saggezza, Carisma, Disciplina.
    expect(STAT_KEYS).toEqual([
      'strength',
      'constitution',
      'intelligence',
      'wisdom',
      'charisma',
      'discipline',
    ]);
  });

  it('matches «Guadagno di punti» in statistiche-eroe.md', () => {
    const table: [difficulty: Difficulty, primary: number, secondary: number][] = [
      ['easy', 10, 3],
      ['medium', 20, 6],
      ['hard', 30, 9],
    ];
    for (const [difficulty, primary, secondary] of table) {
      expect(DIFFICULTY_VALUES[difficulty].statPoints).toBe(primary);
      // «30%, per difetto»
      expect(Math.floor(primary * STATS.secondaryShare)).toBe(secondary);
    }
    expect(STATS.bossStepPoints).toBe(10);
  });

  it('matches «Curva dei livelli» in statistiche-eroe.md', () => {
    const table: [level: number, pointsToEnter: number, totalPoints: number][] = [
      [1, 100, 100],
      [2, 200, 300],
      [3, 300, 600],
      [5, 500, 1500],
      [10, 1000, 5500],
      [15, 1500, 12000],
      [20, 2000, 21000],
    ];
    for (const [level, pointsToEnter, totalPoints] of table) {
      const fromLevel = level - 1;
      expect(STATS.pointsToNextFactor * (fromLevel + STATS.pointsToNextOffset)).toBe(pointsToEnter);
      expect(totalStatPointsFor(level)).toBe(totalPoints);
    }
    expect(STATS.levelMax).toBe(10);
  });

  it('matches the bonuses in xp-e-monete.md, section 1, and in «Regole di gioco»', () => {
    expect(DAY_PLAN).toEqual({ maxPriorities: 3, bonusXp: 25 });
    expect(FULL_DAY).toEqual({ bonusCoins: 10, bonusHp: 5 });
    expect(STREAK_MULTIPLIERS).toEqual([
      { fromDays: 7, multiplier: 1.1 },
      { fromDays: 30, multiplier: 1.2 },
      { fromDays: 100, multiplier: 1.3 },
    ]);
  });

  it('matches «Vita» in «Regole di gioco»', () => {
    expect(HP).toEqual({
      max: 50,
      dailyLossMax: 10,
      perCompletion: 1,
      exhaustedXpMultiplier: 0.5,
      // «torna al 25% di quella massima (13 su 50, arrotondato per eccesso)»
      afterExhaustion: 13,
    });
    expect(FULL_DAY.bonusHp).toBe(5);
    expect(SHOP.potion.hp).toBe(10);
  });

  it('matches «Boss» in «Regole di gioco» and the deadline rules in xp-e-monete.md', () => {
    expect(BOSS).toEqual({
      hpPerStep: 20,
      stepDamage: 20,
      minHpPerRemainingStep: 10,
      difficultyMultiplier: { easy: 1, medium: 1.5, hard: 2 },
      victoryXpPerStep: 10,
      // «monete pari a un quinto degli XP»
      victoryXpPerCoin: 5,
      deadlineStealShare: 0.1,
      deadlineStealMax: 500,
      deadlineWarningDays: 3,
      // analisi-funzionale.md, section 5: «massimo 3 in contemporanea», «passi ordinati (da 2 a 20)».
      maxActive: 3,
      minSteps: 2,
      maxSteps: 20,
    });
  });

  it('matches «Compagno» in «Regole di gioco»', () => {
    expect(COMPANION).toEqual({ puppyAtCompletions: 1, adultAtCompletions: 150 });
    expect(MOOD).toEqual({ windowDays: 3, happyAbove: 0.7, sadBelow: 0.3 });
  });

  it('matches «Salta oggi» in xp-e-monete.md, «Quando si ottengono»', () => {
    expect(SKIPS.maxPerMissionPerWeek).toBe(3);
  });

  it('matches «Freccia di forma» in statistiche-eroe.md', () => {
    expect(STATS).toMatchObject({
      formWindowDays: 30,
      formChangeThreshold: 0.1,
      formHiddenFirstDays: 30,
    });
  });
});
