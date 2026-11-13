import {
  absentDays,
  dailyVariant,
  eveningSituation,
  isStreakRecord,
  pickVariant,
  rememberVariants,
  taleGroup,
  taleSituation,
  voiceOf,
  type TaleInput,
} from '@/rules/tale';

const BASE: TaleInput = {
  today: '2026-11-13',
  pausedToday: false,
  yesterday: { scheduled: 5, done: 3, restDay: false },
  lastOpenDay: '2026-11-12',
  pauseEndedYesterday: false,
  bossDefeatedYesterday: false,
  streakRecord: false,
  gameMode: 'full',
};

describe('taleSituation', () => {
  it('tells a full, partial and empty day', () => {
    expect(taleSituation({ ...BASE, yesterday: { scheduled: 5, done: 5, restDay: false } })).toBe(
      'fullDay',
    );
    expect(taleSituation(BASE)).toBe('partialDay');
    expect(taleSituation({ ...BASE, yesterday: { scheduled: 5, done: 0, restDay: false } })).toBe(
      'emptyDay',
    );
  });

  it('counts more completions than expected as a full day', () => {
    expect(taleSituation({ ...BASE, yesterday: { scheduled: 2, done: 3, restDay: false } })).toBe(
      'fullDay',
    );
  });

  it('tells a rest day', () => {
    expect(taleSituation({ ...BASE, yesterday: { scheduled: 0, done: 0, restDay: true } })).toBe(
      'restDay',
    );
  });

  it('follows the priorities of design 6.14', () => {
    const all: TaleInput = {
      ...BASE,
      lastOpenDay: '2026-11-09',
      pauseEndedYesterday: true,
      bossDefeatedYesterday: true,
      streakRecord: true,
      yesterday: { scheduled: 5, done: 5, restDay: false },
    };
    expect(taleSituation(all)).toBe('pauseReturn');
    expect(taleSituation({ ...all, pauseEndedYesterday: false })).toBe('absence');
    expect(taleSituation({ ...all, pauseEndedYesterday: false, lastOpenDay: '2026-11-12' })).toBe(
      'streakRecord',
    );
    expect(
      taleSituation({
        ...all,
        pauseEndedYesterday: false,
        lastOpenDay: '2026-11-12',
        streakRecord: false,
      }),
    ).toBe('bossDefeated');
  });

  it('starts the absence at 2 whole days without opening', () => {
    expect(taleSituation({ ...BASE, lastOpenDay: '2026-11-11' })).toBe('partialDay');
    expect(taleSituation({ ...BASE, lastOpenDay: '2026-11-10' })).toBe('absence');
    expect(taleSituation({ ...BASE, lastOpenDay: null })).toBe('partialDay');
  });

  it('never tells of a boss defeated in the Essential mode', () => {
    expect(taleSituation({ ...BASE, bossDefeatedYesterday: true, gameMode: 'essential' })).toBe(
      'partialDay',
    );
    expect(taleSituation({ ...BASE, bossDefeatedYesterday: true })).toBe('bossDefeated');
  });

  it('stays silent on the first day, during the pause and after a day with nothing expected', () => {
    expect(taleSituation({ ...BASE, yesterday: null })).toBeNull();
    expect(taleSituation({ ...BASE, pausedToday: true })).toBeNull();
    expect(taleSituation({ ...BASE, pausedToday: true, pauseEndedYesterday: true })).toBeNull();
    expect(
      taleSituation({ ...BASE, yesterday: { scheduled: 0, done: 0, restDay: false } }),
    ).toBeNull();
  });
});

describe('absentDays', () => {
  it('counts the whole days between the last opening and today', () => {
    expect(absentDays('2026-11-12', '2026-11-13')).toBe(0);
    expect(absentDays('2026-11-10', '2026-11-13')).toBe(2);
    expect(absentDays(null, '2026-11-13')).toBe(0);
  });
});

describe('isStreakRecord (choice 26)', () => {
  it('fires on the day the streak first goes above the record it started under', () => {
    expect(isStreakRecord([1, 2, 3, 0, 1, 2, 3, 4])).toBe(true);
  });

  it('does not fire again on the following days of the same streak', () => {
    expect(isStreakRecord([1, 2, 3, 0, 1, 2, 3, 4, 5])).toBe(false);
  });

  it('needs a record of at least 3 days', () => {
    expect(isStreakRecord([1, 2, 0, 1, 2, 3])).toBe(false);
  });

  it('does not fire for the very first streak, which has no record to beat', () => {
    expect(isStreakRecord([1, 2, 3, 4])).toBe(false);
  });

  it('keeps the streak through days that keep it without growing', () => {
    expect(isStreakRecord([1, 2, 3, 0, 1, 2, 2, 3, 3, 4])).toBe(true);
    expect(isStreakRecord([1, 2, 3, 0, 1, 2, 3, 4, 4])).toBe(false);
  });

  it('is false without a closed day', () => {
    expect(isStreakRecord([])).toBe(false);
  });
});

describe('pickVariant', () => {
  const keys = ['tale.cloudy.fullDay.happy.1', 'tale.cloudy.fullDay.happy.2'];
  const five = [1, 2, 3, 4, 5].map((n) => `tale.cloudy.fullDay.happy.${n}`);

  it('picks at random among the variants', () => {
    expect(pickVariant(keys, [], () => 0)).toBe(keys[0]);
    expect(pickVariant(keys, [], () => 0.99)).toBe(keys[1]);
  });

  it('never repeats the last 3 used for the same situation and voice', () => {
    const recent = [five[0], five[2], 'tale.pixel.fullDay.happy.4', five[4]];
    for (const random of [0, 0.3, 0.6, 0.99]) {
      expect([five[1], five[3]]).toContain(pickVariant(five, recent, () => random));
    }
  });

  it('counts the other moods of the same situation as recent too', () => {
    const recent = ['tale.cloudy.fullDay.sad.1', 'tale.cloudy.fullDay.normal.1', five[0]];
    expect(pickVariant(five, recent, () => 0)).toBe(five[1]);
  });

  it('takes the least recently used when all are recent', () => {
    expect(pickVariant(keys, [keys[1], keys[0]], () => 0)).toBe(keys[1]);
    expect(pickVariant(keys, [keys[0], keys[1]], () => 0)).toBe(keys[0]);
  });

  it('works with any number of variants, one included, and none', () => {
    expect(pickVariant([keys[0]], [keys[0]], () => 0.5)).toBe(keys[0]);
    expect(pickVariant([], [], () => 0)).toBeNull();
  });
});

describe('rememberVariants', () => {
  it('adds the keys at the end and keeps the last 3 of each group', () => {
    const a = (n: number) => `tale.cloudy.fullDay.happy.${n}`;
    const b = 'tale.cloudy.encouragement.happy.1';
    expect(rememberVariants([a(1), a(2), a(3)], [a(4), b])).toEqual([a(2), a(3), a(4), b]);
    expect(rememberVariants([a(1), a(2)], [a(1)])).toEqual([a(2), a(1)]);
  });
});

describe('taleGroup', () => {
  it('is the voice and the situation of a key', () => {
    expect(taleGroup('tale.lumin.absence.sad.2')).toBe('tale.lumin.absence');
    expect(taleGroup('tale.lumin.allDone.1')).toBe('tale.lumin.allDone');
  });
});

describe('eveningSituation', () => {
  it('tells 0, some and all the missions done', () => {
    expect(eveningSituation(0, 5)).toBe('noneDone');
    expect(eveningSituation(2, 5)).toBe('someLeft');
    expect(eveningSituation(5, 5)).toBe('allDone');
    expect(eveningSituation(0, 0)).toBeNull();
  });
});

describe('dailyVariant', () => {
  it('keeps one variant for a whole day and changes it with the day', () => {
    const keys = ['a', 'b', 'c'];
    expect(dailyVariant(keys, '2026-11-13')).toBe(dailyVariant(keys, '2026-11-13'));
    expect(dailyVariant(keys, '2026-11-14')).not.toBe(dailyVariant(keys, '2026-11-13'));
    expect(dailyVariant([], '2026-11-13')).toBeNull();
  });
});

describe('voiceOf', () => {
  it('gives each theme the voice of its companion', () => {
    expect(voiceOf('arcade')).toBe('pixel');
    expect(voiceOf('fantasy')).toBe('rocky');
    expect(voiceOf('cyberpunk')).toBe('glitchy');
    expect(voiceOf('lovecraft')).toBe('lumin');
    expect(voiceOf('minimal')).toBe('cloudy');
    expect(voiceOf('minimal-scuro')).toBe('cloudy');
  });
});
