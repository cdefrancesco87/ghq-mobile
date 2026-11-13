import { eq } from 'drizzle-orm';
import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, waitFor, within } from 'expo-router/testing-library';

import { unseenNotificationCount } from '@/db/repositories/appNotifications';
import { updateMission } from '@/db/repositories/missions';
import { appNotifications, missionDays, scheduledReminders } from '@/db/schema';
import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { startApp } from '@/stores/app';
import TabsLayoutRoute from '../../../app/(tabs)/_layout';
import Goals from '../../../app/(tabs)/goals';
import Habits from '../../../app/(tabs)/habits';
import New from '../../../app/(tabs)/new';
import Profile from '../../../app/(tabs)/profile';
import Today from '../../../app/(tabs)/today';
import Index from '../../../app/index';
import { FRIDAY, at, clockAt, missionId, newGame, withBadgesUnlocked } from '../../../test/game';

const mockSetBadgeCount = jest.fn((_count: number) => Promise.resolve(true));
jest.mock('expo-notifications', () => ({
  ...jest.requireActual('expo-notifications'),
  setBadgeCountAsync: (count: number) => mockSetBadgeCount(count),
}));

const ROUTES = {
  index: Index,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

/** A game with two missions, a reminder of each already shown and the summary of yesterday. */
function setUp(): Db {
  const db = withBadgesUnlocked(newGame(['journal', 'healthy_meal'], 5));
  const journal = missionId(db, 'journal');
  const meal = missionId(db, 'healthy_meal');
  updateMission(db, journal, { name: 'Journal' }, clockAt(5, 9));
  updateMission(db, meal, { name: 'Meal' }, clockAt(5, 9));
  db.insert(scheduledReminders)
    .values([
      { osId: 'os-1', missionId: journal, gameDay: '2026-11-06', fireAt: at(FRIDAY, 9) },
      { osId: 'os-2', missionId: meal, gameDay: '2026-11-06', fireAt: at(FRIDAY, 8) },
    ])
    .run();
  db.insert(appNotifications)
    .values({
      id: 'summary:2026-11-05',
      kind: 'summary',
      params: { title: "Com'è andata oggi?", body: 'Ti mancano 2 abitudini.' },
      createdAt: at(5, 21),
      seenAt: at(5, 22),
    })
    .run();
  return db;
}

async function openToday(db: Db, url = '/today?notifications=1') {
  await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(FRIDAY, 10) });
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
  await screen.findByTestId('today-screen');
}

beforeEach(() => {
  mockSetBadgeCount.mockClear();
});

describe('Notifiche recenti (design 11.7, 12.1)', () => {
  it('opens from the widget with the unseen ones, the newest first, with time and Complete', async () => {
    const db = setUp();
    await openToday(db);
    const sheet = await screen.findByTestId('recent-notifications');
    expect(within(sheet).getByText('Notifiche recenti')).toBeTruthy();
    expect(screen.getByTestId('recent-notifications-unseen')).toHaveTextContent('2 non viste');
    const rows = within(sheet)
      .getAllByTestId(/^recent-notification-(reminder|summary)/)
      .map((row) => row.props.testID as string);
    expect(rows).toEqual([
      'recent-notification-reminder:os-1',
      'recent-notification-reminder:os-2',
      'recent-notification-summary:2026-11-05',
    ]);
    expect(screen.getByTestId('recent-notification-reminder:os-1')).toHaveTextContent(
      /Journal.*9:00/,
    );
    expect(screen.getByTestId('recent-notification-summary:2026-11-05')).toHaveTextContent(
      /Com'è andata oggi\?.*ieri/,
    );
    expect(screen.getByTestId('recent-notification-complete-reminder:os-1')).toHaveProp(
      'accessibilityLabel',
      'Completa Journal',
    );
    expect(screen.queryByTestId('recent-notification-complete-summary:2026-11-05')).toBeNull();
  });

  it('completes a mission from the sheet', async () => {
    const db = setUp();
    await openToday(db);
    await fireEvent.press(await screen.findByTestId('recent-notification-complete-reminder:os-2'));
    const row = db
      .select()
      .from(missionDays)
      .where(eq(missionDays.missionId, missionId(db, 'healthy_meal')))
      .get();
    expect(row?.status).toBe('done');
    await waitFor(() =>
      expect(screen.queryByTestId('recent-notification-complete-reminder:os-2')).toBeNull(),
    );
    expect(screen.getByTestId('recent-notification-reminder:os-2')).toHaveTextContent(/Fatta/);
  });

  it('marks them as seen and clears the badge once closed', async () => {
    const db = setUp();
    await openToday(db);
    expect(unseenNotificationCount(db, at(FRIDAY, 10))).toBe(2);
    await fireEvent.press(await screen.findByTestId('recent-notifications-backdrop'));
    expect(unseenNotificationCount(db, at(FRIDAY, 10))).toBe(0);
    expect(mockSetBadgeCount).toHaveBeenCalledWith(0);
  });

  it('stays closed without unseen notifications or without the request', async () => {
    const db = setUp();
    db.delete(scheduledReminders).run();
    await openToday(db);
    expect(screen.queryByTestId('recent-notifications-unseen')).toBeNull();

    const other = setUp();
    await openToday(other, '/today');
    expect(screen.queryByTestId('recent-notifications-unseen')).toBeNull();
  });
});
