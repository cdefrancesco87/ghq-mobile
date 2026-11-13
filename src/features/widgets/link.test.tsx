import { Stack } from 'expo-router';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';

import type { Db } from '@/db/types';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { startApp } from '@/stores/app';
import { useHighlightStore } from '@/stores/highlight';
import TabsLayoutRoute from '../../../app/(tabs)/_layout';
import Goals from '../../../app/(tabs)/goals';
import Habits from '../../../app/(tabs)/habits';
import New from '../../../app/(tabs)/new';
import Profile from '../../../app/(tabs)/profile';
import Today from '../../../app/(tabs)/today';
import Index from '../../../app/index';
import { FRIDAY, clockAt, missionId, newGame, withBadgesUnlocked } from '../../../test/game';

const ROUTES = {
  index: Index,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

async function openToday(db: Db, url: string) {
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

describe('the link of a mission in the medium widget (design 12.2)', () => {
  beforeEach(() => useHighlightStore.getState().clear());

  it('opens Today with the row of the mission highlighted', async () => {
    const db = withBadgesUnlocked(newGame(['journal', 'meditation']));
    const journal = missionId(db, 'journal');
    const seen: (string | null)[] = [];
    const stop = useHighlightStore.subscribe((state) => seen.push(state.missionId));
    await openToday(db, `/today?mission=${journal}`);
    await waitFor(() => expect(seen).toContain(journal));
    stop();
  });
});
