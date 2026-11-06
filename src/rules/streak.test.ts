import {
  nextHeroStreak,
  nextMissionStreak,
  type DayOutcome,
  type Occurrence,
  type Streak,
} from '@/rules/streak';

function heroAfter(start: Streak, outcomes: DayOutcome[]): Streak {
  return outcomes.reduce(nextHeroStreak, start);
}

function missionAfter(start: Streak, occurrences: Occurrence[]): Streak {
  return occurrences.reduce(nextMissionStreak, start);
}

describe('nextHeroStreak', () => {
  it('grows by one on a day with at least one completion', () => {
    expect(nextHeroStreak({ streak: 3, best: 5 }, 'done')).toEqual({ streak: 4, best: 5 });
  });

  it('keeps the streak without growing it on a rest day', () => {
    expect(nextHeroStreak({ streak: 4, best: 6 }, 'rest')).toEqual({ streak: 4, best: 6 });
    expect(heroAfter({ streak: 0, best: 0 }, ['done', 'rest', 'done'])).toEqual({
      streak: 2,
      best: 2,
    });
  });

  it('breaks on a missed day', () => {
    expect(nextHeroStreak({ streak: 4, best: 6 }, 'missed')).toEqual({ streak: 0, best: 6 });
  });

  it('is saved by a shield on a missed day, without growing', () => {
    expect(nextHeroStreak({ streak: 4, best: 6 }, 'missed_with_shield')).toEqual({
      streak: 4,
      best: 6,
    });
  });

  it('updates the record when the streak goes beyond it', () => {
    expect(nextHeroStreak({ streak: 5, best: 5 }, 'done')).toEqual({ streak: 6, best: 6 });
    expect(heroAfter({ streak: 0, best: 2 }, ['done', 'done', 'done', 'missed', 'done'])).toEqual({
      streak: 1,
      best: 3,
    });
  });
});

describe('nextMissionStreak', () => {
  it('grows by one on a completed occurrence', () => {
    expect(nextMissionStreak({ streak: 2, best: 4 }, 'done')).toEqual({ streak: 3, best: 4 });
  });

  it('is neither broken nor grown by «Salta oggi»', () => {
    expect(nextMissionStreak({ streak: 4, best: 6 }, 'skipped')).toEqual({ streak: 4, best: 6 });
    expect(missionAfter({ streak: 0, best: 0 }, ['done', 'skipped', 'done'])).toEqual({
      streak: 2,
      best: 2,
    });
  });

  it('breaks on a missed occurrence', () => {
    expect(nextMissionStreak({ streak: 4, best: 6 }, 'missed')).toEqual({ streak: 0, best: 6 });
  });

  it('is saved by a shield on a missed occurrence, without growing', () => {
    expect(nextMissionStreak({ streak: 4, best: 6 }, 'missed_with_shield')).toEqual({
      streak: 4,
      best: 6,
    });
  });

  it('ignores the days the frequency does not schedule', () => {
    // A Monday, Wednesday, Friday habit done on all three days of the week.
    const week: Occurrence[] = [
      'done',
      'not_scheduled',
      'done',
      'not_scheduled',
      'done',
      'not_scheduled',
      'not_scheduled',
    ];
    expect(missionAfter({ streak: 0, best: 0 }, week)).toEqual({ streak: 3, best: 3 });
  });

  it('updates the record when the streak goes beyond it', () => {
    expect(missionAfter({ streak: 0, best: 1 }, ['done', 'done', 'missed'])).toEqual({
      streak: 0,
      best: 2,
    });
  });
});

describe('the shield', () => {
  it('saves both streaks on the same missed day', () => {
    const start: Streak = { streak: 9, best: 9 };
    expect(nextHeroStreak(start, 'missed_with_shield')).toEqual(start);
    expect(nextMissionStreak(start, 'missed_with_shield')).toEqual(start);
  });
});

describe('invalid input', () => {
  it('rejects negative or fractional streaks and unknown outcomes', () => {
    expect(() => nextHeroStreak({ streak: -1, best: 0 }, 'done')).toThrow(RangeError);
    expect(() => nextMissionStreak({ streak: 1.5, best: 2 }, 'done')).toThrow(RangeError);
    expect(() => nextHeroStreak({ streak: 1, best: 0.5 }, 'done')).toThrow(RangeError);
    expect(() => nextHeroStreak({ streak: 1, best: 1 }, 'skipped' as DayOutcome)).toThrow(
      RangeError,
    );
    expect(() => nextMissionStreak({ streak: 1, best: 1 }, 'rest' as Occurrence)).toThrow(
      RangeError,
    );
  });
});
