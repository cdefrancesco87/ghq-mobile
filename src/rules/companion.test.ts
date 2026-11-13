import {
  companionName,
  growthOf,
  moodFor,
  moodWindowOf,
  raisedMood,
  stageFor,
  storedCompanionName,
  type CompanionStage,
  type DayCompletion,
} from '@/rules/companion';

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

  it('is happy when at least one mission is completed today, whatever the last 3 days show', () => {
    expect(moodFor([], 1)).toBe('happy');
    expect(moodFor([], 5)).toBe('happy');
    // Would be sad from last 3 days alone (2 of 10 = 20%), but today has a completion.
    expect(moodFor(days([4, 1], [3, 1], [3, 0]), 1)).toBe('happy');
    expect(moodFor(days([4, 1], [3, 0], [3, 0]), 1)).toBe('happy'); // 1 of 10
  });

  it('falls back to the last 3 days when nothing is completed today', () => {
    expect(moodFor(days([4, 3], [3, 3], [3, 2]), 0)).toBe('happy');
    expect(moodFor(days([4, 1], [3, 1], [3, 0]), 0)).toBe('sad');
    expect(moodFor(days([10, 5], [10, 5], [10, 5]), 0)).toBe('normal');
  });

  it('goes up one level with a gift today, until the change of day (US-COMP-04)', () => {
    expect(moodFor(days([4, 1], [3, 1], [3, 0]), 0, true)).toBe('normal');
    expect(moodFor(days([10, 5], [10, 5], [10, 5]), 0, true)).toBe('happy');
    expect(moodFor(days([4, 3], [3, 3], [3, 2]), 0, true)).toBe('happy');
    expect(moodFor([], 0, true)).toBe('happy');
    expect(moodFor(days([4, 1], [3, 1], [3, 0]), 1, true)).toBe('happy');
  });

  it('rejects impossible days', () => {
    expect(() => moodFor(days([2, 3]))).toThrow(RangeError);
    expect(() => moodFor(days([-1, 0]))).toThrow(RangeError);
    expect(() => moodFor(days([3, 1.5]))).toThrow(RangeError);
  });
});

describe('moodWindowOf', () => {
  it('sums the missions of the last 3 closed days with the share in percent', () => {
    expect(moodWindowOf(days([5, 0], [4, 1], [3, 1], [3, 0]))).toEqual({
      days: 3,
      scheduled: 10,
      done: 2,
      percent: 20,
    });
  });

  it('rounds the percent for the text, while the mood uses the exact share', () => {
    // 2 of 3 = 66.7%: shown as 67.
    expect(moodWindowOf(days([3, 2])).percent).toBe(67);
    // 29.6%: shown as 30, but still sad.
    const window = days([250, 74]);
    expect(moodWindowOf(window).percent).toBe(30);
    expect(moodFor(window)).toBe('sad');
  });

  it('has no percent when no mission was due', () => {
    expect(moodWindowOf([])).toEqual({ days: 3, scheduled: 0, done: 0, percent: null });
    expect(moodWindowOf(days([0, 0], [0, 0])).percent).toBeNull();
  });

  it('rejects impossible days', () => {
    expect(() => moodWindowOf(days([2, 3]))).toThrow(RangeError);
  });

  it('skips the days of general pause, going back to the last 3 days not paused (choice 23)', () => {
    const paused = { scheduledCount: 4, doneCount: 0, isPaused: true };
    const window = [...days([2, 2], [2, 2], [2, 2]), paused, paused, paused, paused];
    expect(moodWindowOf(window)).toEqual({ days: 3, scheduled: 6, done: 6, percent: 100 });
    expect(moodFor(window)).toBe('happy');
    // A sad window before the pause stays sad without a completion today, happy with one.
    const sad = [...days([2, 0], [2, 0], [2, 0]), paused];
    expect(moodFor(sad)).toBe('sad');
    expect(moodFor(sad, 1)).toBe('happy');
    // Only paused days: no mission due in the window.
    expect(moodFor([paused, paused, paused])).toBe('normal');
  });
});

describe('growthOf', () => {
  it('counts the egg towards its first completion', () => {
    expect(growthOf('egg', 0)).toEqual({
      stageNumber: 1,
      stageCount: 3,
      done: 0,
      target: 1,
      left: 1,
    });
  });

  it('counts the puppy towards the adult stage', () => {
    expect(growthOf('baby', 87)).toEqual({
      stageNumber: 2,
      stageCount: 3,
      done: 87,
      target: 150,
      left: 63,
    });
    expect(growthOf('baby', 149).left).toBe(1);
  });

  it('shows the adult fully grown', () => {
    expect(growthOf('adult', 212)).toEqual({
      stageNumber: 3,
      stageCount: 3,
      done: 212,
      target: null,
      left: 0,
    });
  });

  it('never counts below zero or beyond the target when an undo lowered the total', () => {
    // A puppy stays a puppy after the undo of its first completion.
    expect(growthOf('baby', 0)).toMatchObject({ done: 0, left: 150 });
    expect(growthOf('egg', 3)).toMatchObject({ done: 1, left: 0 });
  });

  it('rejects impossible totals', () => {
    expect(() => growthOf('baby', -1)).toThrow(RangeError);
    expect(() => growthOf('baby', 1.5)).toThrow(RangeError);
    expect(() => growthOf('teen' as CompanionStage, 3)).toThrow(RangeError);
  });
});

describe('companionName', () => {
  it('uses the name chosen by the user in every theme', () => {
    expect(companionName('Fiocco', 'Cloudy')).toBe('Fiocco');
    expect(companionName('Fiocco', 'Pixel')).toBe('Fiocco');
  });

  it('follows the theme while the name is the default one', () => {
    expect(companionName(null, 'Cloudy')).toBe('Cloudy');
    expect(companionName(null, 'Pixel')).toBe('Pixel');
  });
});

describe('storedCompanionName', () => {
  it('keeps the typed name without the spaces around it', () => {
    expect(storedCompanionName('  Fiocco ', 'Cloudy')).toBe('Fiocco');
  });

  it('goes back to the default of the theme when the name is empty or the default one', () => {
    expect(storedCompanionName('   ', 'Cloudy')).toBeNull();
    expect(storedCompanionName('', 'Cloudy')).toBeNull();
    expect(storedCompanionName(' Cloudy ', 'Cloudy')).toBeNull();
  });

  it('accepts up to 20 characters and refuses longer names', () => {
    expect(storedCompanionName('A'.repeat(20), 'Cloudy')).toBe('A'.repeat(20));
    expect(() => storedCompanionName('A'.repeat(21), 'Cloudy')).toThrow(RangeError);
  });
});

describe('raisedMood', () => {
  it('raises the mood by one level, never above happy', () => {
    expect(raisedMood('sad')).toBe('normal');
    expect(raisedMood('normal')).toBe('happy');
    expect(raisedMood('happy')).toBe('happy');
  });
});
