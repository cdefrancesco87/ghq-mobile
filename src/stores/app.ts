import { create } from 'zustand';

import { getPhoneSettings, keepPhoneSettings } from '../db/repositories/backup';
import { closePendingDays } from '../db/repositories/closing';
import type { ActionClock } from '../db/repositories/hero';
import { archiveCompletedSingles } from '../db/repositories/missions';
import { hasProfile } from '../db/repositories/onboarding';
import type { Db } from '../db/types';
import { useHeroStore } from './hero';
import { useHighlightStore } from './highlight';
import { closeSession, getSession, openSession, shiftClock, systemClock } from './session';
import { useSettingsStore } from './settings';
import { useThemeStore } from './theme';

// The start of the app (stack-tecnologico.md, point 2; modello-dati.md, sections 7 and 8): open
// the database and apply the migrations, close the days that are pending, archive the single
// tasks done a week ago, load settings, theme
// and hero. After that every action of a screen goes through `runAction`, which refreshes the
// stores once the repository has written.

export type AppStatus = 'loading' | 'ready' | 'error';

export interface AppState {
  readonly status: AppStatus;
  /** The open database; null until the start has succeeded. */
  readonly db: Db | null;
  readonly hasProfile: boolean;
  /** Why the start failed, shown instead of starting with half the data. */
  readonly error: unknown;
  readonly reset: () => void;
}

const INITIAL = { status: 'loading', db: null, hasProfile: false, error: null } as const;

export const useAppStore = create<AppState>()((set) => ({
  ...INITIAL,
  reset: () => {
    closeSession();
    set(INITIAL);
  },
}));

export interface StartOptions {
  /** Opens the database and applies the migrations: `openAppDatabase` in the app. */
  readonly openDatabase: () => Promise<Db>;
  /** The phone clock when missing. */
  readonly clock?: () => ActionClock;
}

function loadStores(db: Db): void {
  useSettingsStore.getState().load(db);
  useThemeStore.getState().load(db);
  useHeroStore.getState().load(db);
}

/**
 * Starts the app. It never throws: a failure (for example a migration that did not apply) puts
 * the app in the `error` status, without opening a session.
 */
export async function startApp(options: StartOptions): Promise<void> {
  const clock = options.clock ?? systemClock;
  try {
    startOn(await options.openDatabase(), clock);
  } catch (error) {
    failed(error);
  }
}

/** The work of the start on an open database: pending days, old single tasks, stores, session. */
function startOn(db: Db, clock: () => ActionClock): void {
  const now = clock();
  closePendingDays(db, now);
  archiveCompletedSingles(db, now);
  loadStores(db);
  openSession({ db, clock });
  useAppStore.setState({ status: 'ready', db, hasProfile: hasProfile(db), error: null });
}

function failed(error: unknown): void {
  closeSession();
  useAppStore.setState({ status: 'error', db: null, hasProfile: false, error });
}

export interface WipeOptions {
  /** Cancels the notifications scheduled with the system; a failure does not stop the wipe. */
  readonly cancelNotifications: () => Promise<void>;
  /** Closes the database and deletes its files: `deleteAppDatabase` in the app. */
  readonly deleteDatabase: () => Promise<void> | void;
  /** Creates the new database with the migrations: `openAppDatabase` in the app. */
  readonly openDatabase: () => Promise<Db>;
  /** The phone clock when missing. */
  readonly clock?: () => ActionClock;
}

/**
 * «Elimina tutti i dati» (US-IMP-05; design-sezioni.md 10.8): cancels the notifications, closes
 * and deletes the database (the event log cannot be emptied with DELETE), opens a new empty one
 * and loads the stores from it, so the app is back at its first launch. The stores keep the old
 * values until the new database is open, so no screen draws from a closed one. It never throws:
 * true when done, false when the app is left in the `error` status.
 */
export async function wipeAllData(options: WipeOptions): Promise<boolean> {
  const clock = options.clock ?? systemClock;
  await options.cancelNotifications().catch(() => undefined);
  try {
    closeSession();
    await options.deleteDatabase();
    const db = await options.openDatabase();
    openSession({ db, clock });
    loadStores(db);
    useHighlightStore.getState().clear();
    useAppStore.setState({ status: 'ready', db, hasProfile: hasProfile(db), error: null });
    return true;
  } catch (error) {
    closeSession();
    useAppStore.setState({ status: 'error', db: null, hasProfile: false, error });
    return false;
  }
}

export interface RestoreOptions {
  /** Cancels the notifications of the old data; a failure does not stop the restore. */
  readonly cancelNotifications: () => Promise<void>;
  /**
   * Closes the database and puts the one of the backup in its place, keeping the old one aside:
   * `replaceAppDatabase` in the app.
   */
  readonly replaceDatabase: () => void;
  /** Brings back the old database: `putBackPreviousAppDatabase` in the app. */
  readonly putBackPrevious: () => void;
  /** Deletes the old database: `dropPreviousAppDatabase` in the app. */
  readonly dropPrevious: () => void;
  /** Opens the database and applies the migrations: `openAppDatabase` in the app. */
  readonly openDatabase: () => Promise<Db>;
  /** The clock of the session when missing. */
  readonly clock?: () => ActionClock;
}

/**
 * `restored`: the data of the backup are in place. `failed`: they did not open (or migrate), the
 * data of the phone are back as they were. `error`: not even those opened, the app is in the
 * `error` status.
 */
export type RestoreOutcome = 'restored' | 'failed' | 'error';

/**
 * Ripristina (US-IMP-03; design-sezioni.md 10.8): the database of a backup takes the place of the
 * one of the phone, is migrated if it comes from an older app, and starts like the app does
 * (pending days closed, stores loaded), so the next screen is Today with the restored data. The
 * backup state and the device id stay those of this phone. If the restored data do not open, the
 * old ones come back. It needs a started session; after that it never throws.
 */
export async function restoreAllData(options: RestoreOptions): Promise<RestoreOutcome> {
  const session = getSession();
  const clock = options.clock ?? session.clock;
  const phone = getPhoneSettings(session.db);
  await options.cancelNotifications().catch(() => undefined);
  closeSession();
  let db: Db;
  try {
    options.replaceDatabase();
    db = await options.openDatabase();
    keepPhoneSettings(db, phone, clock().now);
  } catch {
    try {
      options.putBackPrevious();
      startOn(await options.openDatabase(), clock);
      return 'failed';
    } catch (error) {
      failed(error);
      return 'error';
    }
  }
  try {
    options.dropPrevious();
  } catch {
    // The old file only takes space: the next restore or «Elimina tutti i dati» removes it.
  }
  try {
    startOn(db, clock);
    useHighlightStore.getState().clear();
    return 'restored';
  } catch (error) {
    failed(error);
    return 'error';
  }
}

const MS_PER_DAY = 86_400_000;
/** The longest move of `advanceClock`, in days. */
const MAX_CLOCK_DAYS = 31;

/**
 * Developer tool for the Maestro flows (`app/dev/clock.tsx`): moves the clock of the session
 * forward by whole days (1 to 31; any other value moves it by 1) and closes the days left behind,
 * as the next start would do, so a flow can reach a state that needs a day change (a missed day
 * that costs health).
 */
export function advanceClock(days: number): void {
  const whole = Number.isInteger(days) && days >= 1 && days <= MAX_CLOCK_DAYS ? days : 1;
  shiftClock(whole * MS_PER_DAY);
  runAction((db, clock) => {
    closePendingDays(db, clock);
    archiveCompletedSingles(db, clock);
  });
}

type ActionListener = (db: Db) => void;

const actionListeners = new Set<ActionListener>();

/**
 * Calls `listener` after every action that succeeded, for work that follows the data (the
 * reminders). Returns the function that stops listening.
 */
export function onActionDone(listener: ActionListener): () => void {
  actionListeners.add(listener);
  return () => {
    actionListeners.delete(listener);
  };
}

/**
 * Runs an action of a repository with the database and the clock of the app, then refreshes the
 * stores. If the action throws, the database did not change and the stores stay as they are.
 */
export function runAction<T>(action: (db: Db, clock: ActionClock) => T): T {
  const { db, clock } = getSession();
  const result = action(db, clock());
  loadStores(db);
  useAppStore.setState({ hasProfile: hasProfile(db) });
  for (const listener of actionListeners) {
    try {
      listener(db);
    } catch {
      // The action is already saved: a listener that fails must not make it look failed.
    }
  }
  return result;
}
