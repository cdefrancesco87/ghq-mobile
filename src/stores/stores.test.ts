import { eq } from 'drizzle-orm';

import { completeMission } from '@/db/repositories/completion';
import { createProfile } from '@/db/repositories/onboarding';
import { recordBackupDone, setAutoBackup } from '@/db/repositories/backup';
import { getDeviceId, getSetting, setSetting } from '@/db/repositories/settings';
import { daySummaries, heroStats, missionDays } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '../../test/db';
import { FRIDAY, at, clockAt, missionId, newGame } from '../../test/game';
import {
  advanceClock,
  onActionDone,
  restoreAllData,
  runAction,
  startApp,
  useAppStore,
  wipeAllData,
  type RestoreOptions,
} from './app';
import { useHeroStore } from './hero';
import { useHighlightStore } from './highlight';
import { getSession } from './session';
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

describe('wipeAllData', () => {
  async function startedGame() {
    const db = newGame(['drink_water']);
    setSetting(db, 'theme', 'cyberpunk', at(FRIDAY, 9));
    setSetting(db, 'language', 'fr', at(FRIDAY, 9));
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });
    return db;
  }

  it('cancels the notifications, deletes the database and starts again from the first launch', async () => {
    await startedGame();
    useHighlightStore.getState().highlight('mission-1');
    const steps: string[] = [];
    const fresh = createTestDb();

    const done = await wipeAllData({
      cancelNotifications: async () => {
        steps.push('cancel');
      },
      deleteDatabase: () => {
        steps.push('delete');
        // The old database is closed: no action may reach it any more.
        expect(() => getSession()).toThrow(/not started/);
      },
      openDatabase: async () => {
        steps.push('open');
        return fresh;
      },
      clock: clock(FRIDAY, 11),
    });

    expect(done).toBe(true);
    expect(steps).toEqual(['cancel', 'delete', 'open']);
    expect(useAppStore.getState()).toMatchObject({ status: 'ready', db: fresh, hasProfile: false });
    expect(getSession().db).toBe(fresh);
    expect(useHeroStore.getState()).toMatchObject({ hero: null, stats: {}, companionName: null });
    expect(useThemeStore.getState().theme).toBe('minimal');
    expect(useSettingsStore.getState().settings.language).toBe('en');
    expect(useHighlightStore.getState().missionId).toBeNull();
    // The actions run on the new database.
    runAction((db, now) =>
      createProfile(
        db,
        { name: 'Ada', language: 'it', theme: 'minimal', templateKeys: ['drink_water'] },
        now,
      ),
    );
    expect(useHeroStore.getState().hero).toMatchObject({ name: 'Ada', level: 1 });
  });

  it('goes on when the notifications cannot be cancelled', async () => {
    await startedGame();

    const done = await wipeAllData({
      cancelNotifications: () => Promise.reject(new Error('no permission')),
      deleteDatabase: () => undefined,
      openDatabase: () => Promise.resolve(createTestDb()),
      clock: clock(FRIDAY, 11),
    });

    expect(done).toBe(true);
    expect(useAppStore.getState()).toMatchObject({ status: 'ready', hasProfile: false });
  });

  it('shows the error when the database cannot be deleted or opened again', async () => {
    await startedGame();
    const failure = new Error('disk full');

    const done = await wipeAllData({
      cancelNotifications: () => Promise.resolve(),
      deleteDatabase: () => undefined,
      openDatabase: () => Promise.reject(failure),
    });

    expect(done).toBe(false);
    expect(useAppStore.getState()).toMatchObject({ status: 'error', db: null, error: failure });
    expect(() => getSession()).toThrow(/not started/);
  });
});

describe('restoreAllData', () => {
  /** The phone: a hero «Claudio» in Cyberpunk with the automatic backup on. */
  async function phone() {
    const db = newGame(['drink_water']);
    setSetting(db, 'theme', 'cyberpunk', at(FRIDAY, 9));
    setAutoBackup(db, true, at(FRIDAY, 9));
    recordBackupDone(db, at(FRIDAY, 9));
    getDeviceId(db, at(FRIDAY, 9));
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });
    return db;
  }

  /** The data of the backup: a hero «Ada» in Arcade, made on Wednesday 4. */
  function backup() {
    const db = createTestDb();
    createProfile(
      db,
      { name: 'Ada', language: 'it', theme: 'arcade', templateKeys: ['drink_water', 'run'] },
      clockAt(4, 9),
    );
    return db;
  }

  function options(overrides: Partial<RestoreOptions>, steps: string[] = []): RestoreOptions {
    return {
      cancelNotifications: async () => void steps.push('cancel'),
      replaceDatabase: () => void steps.push('replace'),
      putBackPrevious: () => void steps.push('putBack'),
      dropPrevious: () => void steps.push('drop'),
      openDatabase: async () => {
        steps.push('open');
        return backup();
      },
      clock: clock(FRIDAY, 11),
      ...overrides,
    };
  }

  it('starts on the restored data, keeping the backup state and device id of the phone', async () => {
    const old = await phone();
    useHighlightStore.getState().highlight('mission-1');
    const restored = backup();
    const steps: string[] = [];

    const outcome = await restoreAllData(
      options({ openDatabase: async () => (steps.push('open'), restored) }, steps),
    );

    expect(outcome).toBe('restored');
    expect(steps).toEqual(['cancel', 'replace', 'open', 'drop']);
    expect(useAppStore.getState()).toMatchObject({
      status: 'ready',
      db: restored,
      hasProfile: true,
    });
    expect(getSession().db).toBe(restored);
    expect(useHeroStore.getState().hero).toMatchObject({ name: 'Ada' });
    expect(useThemeStore.getState().theme).toBe('arcade');
    expect(useHighlightStore.getState().missionId).toBeNull();
    expect(getSetting(restored, 'backup')).toEqual(getSetting(old, 'backup'));
    expect(getDeviceId(restored, at(FRIDAY, 12))).toBe(getDeviceId(old, at(FRIDAY, 12)));
    // A backup of some days ago: the days since then are closed, as at a start.
    expect(
      restored
        .select()
        .from(daySummaries)
        .all()
        .map((row) => row.gameDay),
    ).toEqual(expect.arrayContaining(['2026-11-04', '2026-11-05']));
  });

  it('brings back the data of the phone when the restored ones do not open', async () => {
    const old = await phone();
    const steps: string[] = [];
    let opens = 0;

    const outcome = await restoreAllData(
      options(
        {
          openDatabase: async () => {
            steps.push('open');
            opens += 1;
            if (opens === 1) {
              throw new Error('migration failed');
            }
            return old;
          },
        },
        steps,
      ),
    );

    expect(outcome).toBe('failed');
    expect(steps).toEqual(['cancel', 'replace', 'open', 'putBack', 'open']);
    expect(useAppStore.getState()).toMatchObject({ status: 'ready', db: old });
    expect(useHeroStore.getState().hero).toMatchObject({ name: 'Claudio' });
  });

  it('shows the error when not even the data of the phone open again', async () => {
    await phone();
    const failure = new Error('disk full');

    const outcome = await restoreAllData(
      options({ replaceDatabase: () => undefined, openDatabase: () => Promise.reject(failure) }),
    );

    expect(outcome).toBe('error');
    expect(useAppStore.getState()).toMatchObject({ status: 'error', db: null, error: failure });
  });
});

describe('advanceClock', () => {
  it('moves the clock forward and closes the day left behind, as a start would', async () => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });

    advanceClock(1);

    expect(getSession().clock().now).toBe(at(FRIDAY + 1, 10));
    // Friday closed with its mission missed: the 10 points of the daily limit.
    expect(db.select().from(daySummaries).all()).toHaveLength(1);
    expect(useHeroStore.getState().hero?.hp).toBe(40);
  });

  it('adds up the moves and ends with the session', async () => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });

    advanceClock(1);
    advanceClock(2);
    expect(getSession().clock().now).toBe(at(FRIDAY + 3, 10));
    expect(db.select().from(daySummaries).all()).toHaveLength(3);

    useAppStore.getState().reset();
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });
    expect(getSession().clock().now).toBe(at(FRIDAY, 10));
  });

  it.each([0, -2, 1.5, Number.NaN, 32])('moves the clock by one day for %p days', async (days) => {
    const db = newGame(['drink_water']);
    await startApp({ openDatabase: () => Promise.resolve(db), clock: clock(FRIDAY, 10) });

    advanceClock(days);

    expect(getSession().clock().now).toBe(at(FRIDAY + 1, 10));
  });
});
