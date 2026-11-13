import type { ActionClock } from '../db/repositories/hero';
import type { Db } from '../db/types';

// The open database and the clock of the app, shared by the stores and by the actions of the
// screens. It lives outside the Zustand stores because it is not state to draw: it is the handle
// every action needs.

export interface Session {
  readonly db: Db;
  /** The moment of the action, read when it is needed. */
  readonly clock: () => ActionClock;
}

let current: Session | null = null;
/** Milliseconds the developer tools moved the clock forward (`advanceClock`); 0 otherwise. */
let clockShift = 0;

/** The clock of the phone: the UTC instant and the minutes east of UTC. */
export function systemClock(): ActionClock {
  const now = new Date();
  return { now: now.getTime(), tzOffset: -now.getTimezoneOffset() };
}

export function openSession(session: Session): void {
  current = session;
}

/** Closes the session; a clock moved by the developer tools goes back to the real one. */
export function closeSession(): void {
  current = null;
  clockShift = 0;
}

/**
 * Moves the clock of the session forward, for the developer tools only (`app/dev/clock.tsx`,
 * used by the Maestro flows): it lasts until the session closes or the app restarts.
 */
export function shiftClock(ms: number): void {
  clockShift += ms;
}

/** The session of the app; it throws before `startApp` has opened the database. */
export function getSession(): Session {
  if (current === null) {
    throw new Error('The app has not started: the database is not open yet');
  }
  if (clockShift === 0) {
    return current;
  }
  const { db, clock } = current;
  const shift = clockShift;
  return {
    db,
    clock: () => {
      const time = clock();
      return { ...time, now: time.now + shift };
    },
  };
}
