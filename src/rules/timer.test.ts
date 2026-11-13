import { elapsedMinutes, formatCountdown, timerEndsAt, timerRemainingMs } from './timer';

const MINUTE = 60_000;

describe('timerEndsAt', () => {
  it('ends when the minutes still missing from the target have passed', () => {
    expect(timerEndsAt({ startedAt: 1000, target: 10, value: 0 })).toBe(1000 + 10 * MINUTE);
    expect(timerEndsAt({ startedAt: 1000, target: 10, value: 2.5 })).toBe(1000 + 7.5 * MINUTE);
  });

  it('ends at once when the target is already reached', () => {
    expect(timerEndsAt({ startedAt: 1000, target: 10, value: 12 })).toBe(1000);
  });
});

describe('timerRemainingMs', () => {
  it('counts down from the minutes missing, while running', () => {
    const input = { startedAt: 0, target: 10, value: 4 };
    expect(timerRemainingMs({ ...input, now: 0 })).toBe(6 * MINUTE);
    expect(timerRemainingMs({ ...input, now: 90_000 })).toBe(6 * MINUTE - 90_000);
  });

  it('gives the minutes missing when stopped, and never less than zero', () => {
    expect(timerRemainingMs({ startedAt: null, target: 10, value: 4, now: 999 })).toBe(6 * MINUTE);
    expect(timerRemainingMs({ startedAt: 0, target: 10, value: 0, now: 11 * MINUTE })).toBe(0);
    expect(timerRemainingMs({ startedAt: MINUTE, target: 10, value: 0, now: 0 })).toBe(10 * MINUTE);
  });
});

describe('elapsedMinutes', () => {
  it('gives the minutes since the start with two decimals', () => {
    expect(elapsedMinutes(0, 90_000)).toBe(1.5);
    expect(elapsedMinutes(0, 61_000)).toBe(1.02);
    expect(elapsedMinutes(0, 0)).toBe(0);
  });

  it('never counts a clock that went back', () => {
    expect(elapsedMinutes(5000, 1000)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it('writes minutes and seconds, rounding the seconds up', () => {
    expect(formatCountdown(10 * MINUTE)).toBe('10:00');
    expect(formatCountdown(65_000)).toBe('01:05');
    expect(formatCountdown(64_200)).toBe('01:05');
    expect(formatCountdown(0)).toBe('00:00');
  });

  it('adds the hours beyond an hour', () => {
    expect(formatCountdown(90 * MINUTE)).toBe('1:30:00');
  });
});
