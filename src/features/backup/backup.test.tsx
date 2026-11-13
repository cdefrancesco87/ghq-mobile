import { Stack } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { Dimensions } from 'react-native';

import { completeMission } from '@/db/repositories/completion';
import { getDeviceId, getSetting } from '@/db/repositories/settings';
import { events, hero, missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { BACKUP_DATA_FILE, BACKUP_SUMMARY_FILE, writeBackup } from '@/features/backup/backupFile';
import { backUpAndRecord } from '@/features/backup/backupService';
import { createMemoryCloudStore, type MemoryCloudStore } from '@/features/backup/cloudStore';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { startApp, useAppStore } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { getSession } from '@/stores/session';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import TabsLayoutRoute from '../../../app/(tabs)/_layout';
import Goals from '../../../app/(tabs)/goals';
import Habits from '../../../app/(tabs)/habits';
import New from '../../../app/(tabs)/new';
import Profile from '../../../app/(tabs)/profile';
import Today from '../../../app/(tabs)/today';
import Index from '../../../app/index';
import Onboarding from '../../../app/onboarding';
import BackupRoute from '../../../app/settings/backup';
import SettingsRoute from '../../../app/settings/index';
import { serializeTestDb } from '../../../test/db';
import { FRIDAY, clockAt, missionId, newGame } from '../../../test/game';

// Backup e ripristino (T57) with a cloud in memory. The database file is a fake that holds one
// database: a restore puts the database of the backup in its place.

const mockCancelAll = jest.fn();
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: () => Promise.resolve({ granted: true, status: 'granted' }),
  requestPermissionsAsync: () => Promise.resolve({ granted: true, status: 'granted' }),
  cancelAllScheduledNotificationsAsync: () => mockCancelAll(),
  dismissAllNotificationsAsync: () => Promise.resolve(),
}));

/** The newest schema of the app: a backup above it comes from a newer app. */
const APP_SCHEMA = 2_000_000_000_000;

const mockFiles: { db: Db | null; previous: Db | null; openFails: boolean } = {
  db: null,
  previous: null,
  openFails: false,
};
jest.mock('@/db/client', () => {
  const testDb = jest.requireActual('../../../test/db');
  return {
    appSchemaVersion: () => 2_000_000_000_000,
    serializeAppDatabase: (db: Db) => testDb.serializeTestDb(db),
    replaceAppDatabase: (bytes: Uint8Array) => {
      mockFiles.previous = mockFiles.db;
      mockFiles.db = testDb.openTestDbFrom(bytes);
    },
    putBackPreviousAppDatabase: () => {
      mockFiles.db = mockFiles.previous;
      mockFiles.previous = null;
    },
    dropPreviousAppDatabase: () => {
      mockFiles.previous = null;
    },
    openAppDatabase: () => {
      if (mockFiles.openFails) {
        mockFiles.openFails = false;
        return Promise.reject(new Error('migration failed'));
      }
      mockFiles.db ??= testDb.createTestDb();
      return Promise.resolve(mockFiles.db);
    },
    deleteAppDatabase: () => {
      mockFiles.db = null;
    },
  };
});

const mockCloud: { store: MemoryCloudStore | null } = { store: null };
jest.mock('@/features/backup/cloudStorage', () => ({
  createAppCloudStore: () => mockCloud.store,
}));
const mockSyncTask = jest.fn();
jest.mock('@/features/backup/backgroundBackup', () => ({
  syncAutoBackupTask: (auto: boolean) => mockSyncTask(auto),
}));

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  onboarding: Onboarding,
  'settings/index': SettingsRoute,
  'settings/backup': BackupRoute,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

const cloud = () => mockCloud.store!;

async function open(db: Db, url = '/settings/backup') {
  mockFiles.db = db;
  await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(FRIDAY, 12) });
  const i18n = await createI18n('it');
  await renderRouter(
    {
      ...ROUTES,
      _layout: () => (
        <AppProviders i18n={i18n}>
          <Stack screenOptions={{ headerShown: false }} />
        </AppProviders>
      ),
    },
    { initialUrl: url },
  );
  await screen.findByTestId(url === '/settings' ? 'settings-screen' : 'backup-screen');
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));

/** A hero «Claudio» who completed two missions on Friday 6. */
function playedGame(): Db {
  const db = newGame(['drink_water', 'healthy_meal', 'run']);
  completeMission(db, {
    missionId: missionId(db, 'drink_water'),
    source: 'app',
    ...clockAt(6, 10),
  });
  completeMission(db, { missionId: missionId(db, 'run'), source: 'app', ...clockAt(6, 11) });
  return db;
}

/** A backup of `db` made on Tuesday 3 at 06:12 in Rome. */
function backUpEarlier(db: Db, schemaVersion: number | null = 1) {
  return writeBackup({
    cloud: cloud(),
    database: serializeTestDb(db),
    schemaVersion,
    counts: { missions: 3, level: 2 },
    now: Date.UTC(2026, 10, 3, 5, 12),
  });
}

beforeEach(async () => {
  // Jest starts with a font scale of 2: the layout with very large text.
  await act(async () => {
    Dimensions.set({
      window: { width: 390, height: 844, scale: 3, fontScale: 1 },
      screen: { width: 390, height: 844, scale: 3, fontScale: 1 },
    });
  });
  mockCancelAll.mockReset().mockResolvedValue(undefined);
  mockSyncTask.mockReset();
  mockFiles.db = null;
  mockFiles.previous = null;
  mockFiles.openFails = false;
  mockCloud.store = createMemoryCloudStore('icloud');
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

describe('the row Backup of the Settings', () => {
  it('says where and when, and opens Backup e ripristino', async () => {
    const db = newGame(['meditation']);
    await backUpAndRecord(
      db,
      { cloud: cloud(), serialize: serializeTestDb },
      Date.UTC(2026, 10, 5, 5, 12),
    );
    await open(db, '/settings');

    expect(screen.getByTestId('settings-backup-value')).toHaveTextContent('ieri alle 6:12');
    expect(screen.getByTestId('settings-backup-caption')).toHaveTextContent('iCloud');
    await press('settings-backup');
    expect(await screen.findByTestId('backup-screen')).toBeOnTheScreen();
  });

  it('is found by the search with the words of its page', async () => {
    await open(newGame(['meditation']), '/settings');
    await fireEvent.changeText(screen.getByTestId('settings-search'), 'elimina');
    expect(screen.getByTestId('settings-backup')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-theme')).toBeNull();
  });
});

describe('Backup e ripristino', () => {
  it('starts with no backup and the automatic backup off', async () => {
    await open(newGame(['meditation']));
    expect(screen.getByText('Backup e ripristino')).toBeOnTheScreen();
    expect(screen.getByTestId('backup-provider-value')).toHaveTextContent('iCloud');
    expect(screen.getByTestId('backup-last-value')).toHaveTextContent('Nessun backup ancora');
    expect(screen.getByTestId('backup-auto')).toHaveProp('value', false);
    expect(screen.queryByTestId('backup-error')).toBeNull();
  });

  it('makes a backup now and shows when', async () => {
    await open(playedGame());
    await press('backup-now');

    await waitFor(() =>
      expect(screen.getByTestId('backup-last-value')).toHaveTextContent('oggi alle 12:00'),
    );
    expect([...cloud().files.keys()].sort()).toEqual(
      [BACKUP_DATA_FILE, BACKUP_SUMMARY_FILE].sort(),
    );
    expect(getSetting(getSession().db, 'backup')).toMatchObject({
      lastBackupAt: clockAt(FRIDAY, 12).now,
      lastError: null,
    });
  });

  it('explains a failed backup in one line, and «Riprova» tries again', async () => {
    await open(newGame(['meditation']));
    cloud().failNext = 'no_space';
    await press('backup-now');

    expect(await screen.findByTestId('backup-error')).toBeOnTheScreen();
    expect(screen.getByText('Backup non riuscito')).toBeOnTheScreen();
    expect(screen.getByTestId('backup-error-line')).toHaveTextContent(
      'Spazio iCloud esaurito. Libera spazio e riprova.',
    );
    expect(screen.getByTestId('backup-last-value')).toHaveTextContent('Nessun backup ancora');

    await press('backup-retry');
    await waitFor(() => expect(screen.queryByTestId('backup-error')).toBeNull());
    expect(screen.getByTestId('backup-last-value')).toHaveTextContent('oggi alle 12:00');
  });

  it('turns the daily automatic backup on and off with the task of the system', async () => {
    await open(newGame(['meditation']));
    await fireEvent(screen.getByTestId('backup-auto'), 'valueChange', true);

    expect(getSetting(getSession().db, 'backup').auto).toBe(true);
    expect(screen.getByTestId('backup-auto')).toHaveProp('value', true);
    expect(mockSyncTask).toHaveBeenLastCalledWith(true);

    await fireEvent(screen.getByTestId('backup-auto'), 'valueChange', false);
    expect(getSetting(getSession().db, 'backup').auto).toBe(false);
    expect(mockSyncTask).toHaveBeenLastCalledWith(false);
  });
});

describe('Ripristina', () => {
  it('shows date, missions and level, then replaces the data and opens Today', async () => {
    const before = playedGame();
    await backUpEarlier(before);
    const phone = newGame(['meditation']);
    const deviceId = getDeviceId(phone, clockAt(FRIDAY, 9).now);
    await open(phone);

    await press('backup-restore');
    expect(await screen.findByTestId('backup-restore-preview')).toBeOnTheScreen();
    expect(screen.getByText('Fatto il 3 novembre alle 6:12')).toBeOnTheScreen();
    expect(screen.getByText('3 missioni · livello 2')).toBeOnTheScreen();
    expect(screen.getByText('Sostituirà i dati di questo telefono.')).toBeOnTheScreen();

    await press('backup-restore-confirm');
    await waitFor(() => expect(screen).toHavePathname('/today'));
    expect(screen.queryByTestId('backup-screen')).toBeNull();
    expect(screen.queryByTestId('backup-restore-sheet')).toBeNull();

    const { db } = getSession();
    expect(db).not.toBe(phone);
    expect(db.select().from(hero).get()?.name).toBe('Claudio');
    expect(
      db
        .select()
        .from(missions)
        .all()
        .map((row) => row.id),
    ).toEqual(
      before
        .select()
        .from(missions)
        .all()
        .map((row) => row.id),
    );
    // The log of the backup, then the days closed since then (Friday 6 to Friday 6: none).
    expect(db.select().from(events).all()).toEqual(before.select().from(events).all());
    expect(getDeviceId(db, clockAt(FRIDAY, 13).now)).toBe(deviceId);
    expect(useHeroStore.getState().hero).toMatchObject({ name: 'Claudio' });
    expect(mockCancelAll).toHaveBeenCalledTimes(1);
  });

  it('says when there is no backup', async () => {
    await open(newGame(['meditation']));
    await press('backup-restore');
    expect(await screen.findByTestId('backup-restore-none')).toHaveTextContent(
      'Nessun backup su iCloud. Fanne uno dal telefono di prima, poi riprova.',
    );
  });

  it('refuses a backup of a newer app, with no «Riprova»', async () => {
    await backUpEarlier(playedGame(), APP_SCHEMA + 1);
    await open(newGame(['meditation']));
    await press('backup-restore');

    expect(await screen.findByTestId('backup-restore-error')).toHaveTextContent(
      "Questo backup viene da una versione più nuova dell'app. Aggiorna l'app e riprova.",
    );
    expect(screen.queryByTestId('backup-restore-retry')).toBeNull();
    expect(screen.queryByTestId('backup-restore-confirm')).toBeNull();
  });

  it('explains a cloud that does not answer, and «Riprova» looks again', async () => {
    await backUpEarlier(playedGame());
    await open(newGame(['meditation']));
    cloud().failNext = 'offline';
    await press('backup-restore');

    expect(await screen.findByTestId('backup-restore-error')).toHaveTextContent(
      'Nessuna connessione a iCloud. Controlla la rete e riprova.',
    );
    await press('backup-restore-retry');
    expect(await screen.findByTestId('backup-restore-preview')).toBeOnTheScreen();
  });

  it('keeps the data of the phone when the backup does not open', async () => {
    await backUpEarlier(playedGame());
    const phone = newGame(['meditation']);
    await open(phone);
    await press('backup-restore');
    await screen.findByTestId('backup-restore-preview');

    mockFiles.openFails = true;
    await press('backup-restore-confirm');

    expect(await screen.findByTestId('backup-restore-error')).toHaveTextContent(
      'Il backup non si è aperto: i dati di questo telefono non sono cambiati.',
    );
    expect(getSession().db).toBe(phone);
    expect(getSession().db.select().from(missions).all()).toHaveLength(1);
    expect(screen).toHavePathname('/settings/backup');
  });
});
