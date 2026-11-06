import { formArrow, statLevel, statPoints, statPointsToNext } from '@/rules/stats';
import type { Difficulty, StatKey } from '@/rules/types';

describe('statPoints', () => {
  it('gives 10, 20 or 30 points to the primary stat and 30% rounded down to the secondary', () => {
    expect(statPoints('easy', 'strength', 'constitution')).toEqual({
      strength: 10,
      constitution: 3,
    });
    // The `d_stats` example of modello-dati.md.
    expect(statPoints('medium', 'strength', 'wisdom')).toEqual({ strength: 20, wisdom: 6 });
    expect(statPoints('hard', 'intelligence', 'discipline')).toEqual({
      intelligence: 30,
      discipline: 9,
    });
  });

  it('gives points only to the primary stat when there is no secondary', () => {
    expect(statPoints('hard', 'charisma', null)).toEqual({ charisma: 30 });
  });

  it('gives no points without a primary stat', () => {
    expect(statPoints('medium', null, null)).toEqual({});
    expect(statPoints('medium', null, 'wisdom')).toEqual({});
  });

  it('rejects a secondary stat equal to the primary', () => {
    expect(() => statPoints('medium', 'strength', 'strength')).toThrow(RangeError);
  });

  it('rejects unknown stats and difficulties', () => {
    expect(() => statPoints('medium', 'luck' as StatKey, null)).toThrow(RangeError);
    expect(() => statPoints('medium', 'strength', 'luck' as StatKey)).toThrow(RangeError);
    expect(() => statPoints('epic' as Difficulty, 'strength', null)).toThrow(RangeError);
  });
});

describe('statPointsToNext', () => {
  it('is 100 × (level + 1)', () => {
    expect(statPointsToNext(0)).toBe(100);
    expect(statPointsToNext(1)).toBe(200);
    expect(statPointsToNext(4)).toBe(500);
    expect(statPointsToNext(9)).toBe(1000);
  });

  it('rejects levels outside 0–10', () => {
    for (const level of [-1, 11, 1.5]) {
      expect(() => statPointsToNext(level)).toThrow(RangeError);
    }
  });
});

describe('statLevel', () => {
  it('matches the table «Punti totali» of statistiche-eroe.md', () => {
    const table: [level: number, totalPoints: number][] = [
      [1, 100],
      [2, 300],
      [3, 600],
      [5, 1500],
      [10, 5500],
    ];
    for (const [level, totalPoints] of table) {
      expect(statLevel(totalPoints)).toBe(level);
      expect(statLevel(totalPoints - 1)).toBe(level - 1);
    }
  });

  it('starts from level 0', () => {
    expect(statLevel(0)).toBe(0);
  });

  it('stops at level 10 while the points keep adding up', () => {
    // Rows 15 and 20 of the table only matter for a higher cap.
    expect(statLevel(12000)).toBe(10);
    expect(statLevel(21000)).toBe(10);
  });

  it('rejects negative or fractional points', () => {
    for (const points of [-1, 2.5, Number.NaN]) {
      expect(() => statLevel(points)).toThrow(RangeError);
    }
  });
});

describe('formArrow', () => {
  it('points up with at least 10% more points than the 30 days before', () => {
    expect(formArrow(110, 100, 60)).toBe('up');
    expect(formArrow(33, 30, 60)).toBe('up');
  });

  it('points down with at least 10% fewer points', () => {
    expect(formArrow(90, 100, 60)).toBe('down');
    expect(formArrow(27, 30, 60)).toBe('down');
  });

  it('shows nothing for smaller changes, just inside the 10% borders', () => {
    expect(formArrow(109, 100, 60)).toBeNull();
    expect(formArrow(91, 100, 60)).toBeNull();
    expect(formArrow(32, 30, 60)).toBeNull();
    expect(formArrow(28, 30, 60)).toBeNull();
    expect(formArrow(100, 100, 60)).toBeNull();
  });

  it('handles periods without points', () => {
    expect(formArrow(0, 0, 60)).toBeNull();
    expect(formArrow(5, 0, 60)).toBe('up');
    expect(formArrow(0, 50, 60)).toBe('down');
  });

  it('is hidden during the first 30 days of use', () => {
    expect(formArrow(110, 100, 1)).toBeNull();
    expect(formArrow(110, 100, 30)).toBeNull();
    expect(formArrow(110, 100, 31)).toBe('up');
  });

  it('rejects invalid values', () => {
    expect(() => formArrow(-1, 10, 60)).toThrow(RangeError);
    expect(() => formArrow(10, 2.5, 60)).toThrow(RangeError);
    expect(() => formArrow(10, 10, 0)).toThrow(RangeError);
    expect(() => formArrow(10, 10, 1.5)).toThrow(RangeError);
  });
});
