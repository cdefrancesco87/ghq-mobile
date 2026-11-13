import { create } from 'zustand';

import { closePendingDays } from '../db/repositories/closing';
import type { ActionClock } from '../db/repositories/hero';
import { archiveCompletedSingles } from '../db/repositories/missions';
import { hasProfile } from '../db/repositories/onboarding';
import type { Db } from '../db/types';
import { useHeroStore } from './hero';
import { closeSession, getSession, openSession, systemClock } from './session';
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
    const db = await options.openDatabase();
    const now = clock();
    closePendingDays(db, now);
    archiveCompletedSingles(db, now);
    loadStores(db);
    openSession({ db, clock });
    useAppStore.setState({ status: 'ready', db, hasProfile: hasProfile(db), error: null });
  } catch (error) {
    closeSession();
    useAppStore.setState({ status: 'error', db: null, hasProfile: false, error });
  }
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
