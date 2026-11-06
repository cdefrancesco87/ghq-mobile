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

/** The clock of the phone: the UTC instant and the minutes east of UTC. */
export function systemClock(): ActionClock {
  const now = new Date();
  return { now: now.getTime(), tzOffset: -now.getTimezoneOffset() };
}

export function openSession(session: Session): void {
  current = session;
}

export function closeSession(): void {
  current = null;
}

/** The session of the app; it throws before `startApp` has opened the database. */
export function getSession(): Session {
  if (current === null) {
    throw new Error('The app has not started: the database is not open yet');
  }
  return current;
}
