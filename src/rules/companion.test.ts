import { moodFor, stageFor, type CompanionStage, type DayCompletion } from '@/rules/companion';

function days(...pairs: [scheduledCount: number, doneCount: number][]): DayCompletion[] {
  return pairs.map(([scheduledCount, doneCount]) => ({ scheduledCount, doneCount }));
}

describe('stageFor', () => {
  it('hatches the egg at the first completion and grows up at 150', () => {
    expect(stageFor(0)).toBe('egg');
    expect(stageFor(1)).toBe('baby');
    expect(stageFor(149)).toBe('baby');
    expect(stageFor(150)).toBe('adult');
    expect(stageFor(1000)).toBe('adult');
  });

  it('never goes back a stage, even when an undo lowers the count', () => {
    expect(stageFor(0, 'baby')).toBe('baby');
    expect(stageFor(149, 'adult')).toBe('adult');
  });

  it('catches up when the count is ahead of the current stage', () => {
    expect(stageFor(150, 'egg')).toBe('adult');
  });

  it('rejects invalid counts and stages', () => {
    expect(() => stageFor(-1)).toThrow(RangeError);
    expect(() => stageFor(2.5)).toThrow(RangeError);
    expect(() => stageFor(3, 'dragon' as CompanionStage)).toThrow(RangeError);
  });
});

describe('moodFor', () => {
  it('is happy above 70% of the missions of the last 3 days', () => {
    expect(moodFor(days([4, 3], [3, 3], [3, 2]))).toBe('happy'); // 8 of 10
    expect(moodFor(days([50, 36], [25, 18], [25, 17]))).toBe('happy'); // 71 of 100
  });

  it('is normal exactly at 70% and exactly at 30%', () => {
    expect(moodFor(days([4, 3], [3, 2], [3, 2]))).toBe('normal'); // 7 of 10
    expect(moodFor(days([4, 1], [3, 1], [3, 1]))).toBe('normal'); // 3 of 10
    expect(moodFor(days([10, 5], [10, 5], [10, 5]))).toBe('normal'); // 50%
  });

  it('is sad below 30%', () => {
    expect(moodFor(days([4, 1], [3, 1], [3, 0]))).toBe('sad'); // 2 of 10
    expect(moodFor(days([50, 15], [25, 7], [25, 7]))).toBe('sad'); // 29 of 100
  });

  it('is normal when no mission was due', () => {
    expect(moodFor([])).toBe('normal');
    expect(moodFor(days([0, 0], [0, 0], [0, 0]))).toBe('normal');
  });

  it('counts only the last 3 days', () => {
    // The first, empty day is older than 3 days and does not count.
    expect(moodFor(days([5, 0], [4, 4], [3, 3], [3, 3]))).toBe('happy');
  });

  it('rejects impossible days', () => {
    expect(() => moodFor(days([2, 3]))).toThrow(RangeError);
    expect(() => moodFor(days([-1, 0]))).toThrow(RangeError);
    expect(() => moodFor(days([3, 1.5]))).toThrow(RangeError);
  });
});
