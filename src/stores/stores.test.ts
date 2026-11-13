import { eq } from 'drizzle-orm';

import { completeMission } from '@/db/repositories/completion';
import { createProfile } from '@/db/repositories/onboarding';
import { setSetting } from '@/db/repositories/settings';
import { daySummaries, heroStats, missionDays } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '../../test/db';
import { FRIDAY, at, clockAt, missionId, newGame } from '../../test/game';
import { onActionDone, runAction, startApp, useAppStore } from './app';
import { useHeroStore } from './hero';
import { useSettingsStore } from './settings';
import { useThemeStore } from './theme';

const clock = (day: number, hour: number) => () => clockAt(day, hour);

beforeEach(() => {
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

describe('startApp', () => {
  it('opens the database and loads the stores of an existing profile', async () => {
    const db = newGame(['drink_water']);
    setSetting(db, 'theme', 'cyberpunk', at(FRIDAY, 9));
    setSetting(db, 'colorblind', true, at(FRIDAY, 9));
    expect(useAppStore.getState().status).toBe('loading');

    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });

    expect(useAppStore.getState()).toMatchObject({ status: 'ready', hasProfile: true, db });
    expect(useHeroStore.getState().hero).toMatchObject({ name: 'Claudio', level: 1, hp: 50 });
    expect(Object.keys(useHeroStore.getState().stats)).toHaveLength(6);
    expect(useThemeStore.getState().theme).toBe('cyberpunk');
    expect(useSettingsStore.getState().settings).toMatchObject({
      language: 'it',
      colorblind: true,
      week_start: 1,
    });
  });

  it('is ready without a profile on the first launch, with the defaults', async () => {
    const db = createTestDb();

    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });

    expect(useAppStore.getState()).toMatchObject({ status: 'ready', hasProfile: false });
    expect(useHeroStore.getState().hero).toBeNull();
    expect(useThemeStore.getState().theme).toBe('minimal');
    expect(useSettingsStore.getState().settings.language).toBe('en');
  });

  it('closes the pending days before loading the hero', async () => {
    const db = newGame(['drink_water']);
    // Created on Friday 6 and never played: on Monday 9 the days 6, 7 and 8 are closed and the
    // hero loses the 10 points of the daily limit on each one.
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(9, 10) });

    expect(db.select().from(daySummaries).all()).toHaveLength(3);
    expect(useHeroStore.getState().hero?.hp).toBe(20);
  });

  it('shows the error and stays out of the app when the database does not open', async () => {
    const failure = new Error('migration failed');

    await startApp({ openDatabase: () => Promise.reject(failure), clock: clock(FRIDAY, 10) });

    expect(useAppStore.getState()).toMatchObject({ status: 'error', error: failure, db: null });
    expect(useHeroStore.getState().hero).toBeNull();
  });

  it('shows the error when closing the days fails', async () => {
    const db = newGame(['drink_water']);
    const failing = new Proxy(db, {
      get: (target, key) =>
        key === 'transaction'
          ? () => {
              throw new Error('boom');
            }
          : Reflect.get(target, key),
    }) as Db;

    await startApp({ openDatabase: () => Promise.resolve(failing), clock: clock(9, 10) });

    expect(useAppStore.getState()).toMatchObject({ status: 'error', db: null });
  });
});

describe('runAction', () => {
  it('refreshes the hero store after a completion', async () => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });
    expect(useHeroStore.getState().hero?.xpTotal).toBe(0);
    const id = missionId(db, 'drink_water');

    runAction((tx, { now, tzOffset }) =>
      completeMission(tx, { missionId: id, source: 'app', now, tzOffset }),
    );

    const hero = useHeroStore.getState().hero;
    expect(hero?.xpTotal).toBeGreaterThan(0);
    expect(hero?.updatedAt).toBe(at(FRIDAY, 10));
    expect(db.select().from(missionDays).where(eq(missionDays.missionId, id)).all()).toHaveLength(
      1,
    );
    const saved = db.select().from(heroStats).all();
    expect(useHeroStore.getState().stats).toEqual(
      Object.fromEntries(saved.map((row) => [row.statKey, row.points])),
    );
    expect(Object.values(useHeroStore.getState().stats).some((points) => points > 0)).toBe(true);
  });

  it('returns what the action returns', async () => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });

    expect(runAction(() => 42)).toBe(42);
  });

  it('tells the listeners after an action, not after one that throws', async () => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });
    const listener = jest.fn();
    const failing = jest.fn(() => {
      throw new Error('listener');
    });
    const stop = onActionDone(listener);
    const stopFailing = onActionDone(failing);

    expect(runAction(() => 42)).toBe(42);
    expect(listener).toHaveBeenCalledWith(db);
    expect(() =>
      runAction(() => {
        throw new Error('action');
      }),
    ).toThrow('action');
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    stopFailing();
    runAction(() => 0);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it('creates the profile at the first launch and the stores follow', async () => {
    const db = createTestDb();
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });

    runAction((tx, now) =>
      createProfile(
        tx,
        { name: 'Ada', language: 'de', theme: 'fantasy', templateKeys: ['drink_water'] },
        now,
      ),
    );

    expect(useAppStore.getState().hasProfile).toBe(true);
    expect(useHeroStore.getState().hero?.name).toBe('Ada');
    expect(useThemeStore.getState().theme).toBe('fantasy');
    expect(useSettingsStore.getState().settings.language).toBe('de');
  });

  it('leaves the stores as they are when the action fails', async () => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });
    const before = useHeroStore.getState().hero;

    expect(() =>
      runAction((tx, { now, tzOffset }) =>
        completeMission(tx, { missionId: 'nope', source: 'app', now, tzOffset }),
      ),
    ).toThrow();

    expect(useHeroStore.getState().hero).toBe(before);
  });

  it('throws when the app has not started', () => {
    expect(() => runAction(() => 1)).toThrow(/not started/);
  });
});

describe('settings and theme stores', () => {
  it('write the setting and update the store', async () => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });

    useThemeStore.getState().setTheme('lovecraft');
    useSettingsStore.getState().update('language', 'fr');

    expect(useThemeStore.getState().theme).toBe('lovecraft');
    expect(useSettingsStore.getState().settings.language).toBe('fr');
    useThemeStore.getState().load(db);
    useSettingsStore.getState().load(db);
    expect(useThemeStore.getState().theme).toBe('lovecraft');
    expect(useSettingsStore.getState().settings.language).toBe('fr');
  });

  it('keep the old value when the new one is not valid', async () => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });

    expect(() => useSettingsStore.getState().update('week_start', 3 as 1)).toThrow();

    expect(useSettingsStore.getState().settings.week_start).toBe(1);
  });
});
