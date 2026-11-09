import { Stack } from 'expo-router';
import { act, cleanup, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { AccessibilityInfo, BackHandler, Dimensions, StyleSheet } from 'react-native';

import { getLanguage, getSetting, setSetting } from '@/db/repositories/settings';
import { hasProfile, loadOnboardingDraft, saveOnboardingDraft } from '@/db/repositories/onboarding';
import { missions } from '@/db/schema';
import type { Db } from '@/db/types';
import { UNDO_TOAST_MS } from '@/features/shared/UndoToast';
import { AppProviders } from '@/features/shell/AppProviders';
import { createI18n } from '@/i18n';
import { startApp, useAppStore } from '@/stores/app';
import { useHeroStore } from '@/stores/hero';
import { useSettingsStore } from '@/stores/settings';
import { useThemeStore } from '@/stores/theme';
import { THEMES, type ThemeKey } from '@/theme/themes';
import TabsLayoutRoute from '../../../app/(tabs)/_layout';
import Goals from '../../../app/(tabs)/goals';
import Habits from '../../../app/(tabs)/habits';
import New from '../../../app/(tabs)/new';
import Profile from '../../../app/(tabs)/profile';
import Today from '../../../app/(tabs)/today';
import Index from '../../../app/index';
import Onboarding from '../../../app/onboarding';
import { createTestDb } from '../../../test/db';
import { FRIDAY, clockAt } from '../../../test/game';

// The phone is in Italian here (CLAUDE.md, choice 19).
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'it', languageTag: 'it-IT' }],
}));

const mockGetPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: () => mockRequestPermissions(),
}));

const ROUTES: Record<string, ComponentType> = {
  index: Index,
  onboarding: Onboarding,
  '(tabs)/_layout': TabsLayoutRoute,
  '(tabs)/today': Today,
  '(tabs)/habits': Habits,
  '(tabs)/new': New,
  '(tabs)/goals': Goals,
  '(tabs)/profile': Profile,
};

const NOW = clockAt(FRIDAY, 10).now;
const LIMIT = 'Massimo 5: potrai aggiungerne altre dopo';

async function openApp(db: Db) {
  await startApp({ openDatabase: () => Promise.resolve(db), clock: () => clockAt(FRIDAY, 10) });
  const i18n = await createI18n(useSettingsStore.getState().settings.language);
  await renderRouter(
    {
      ...ROUTES,
      _layout: () => (
        <AppProviders i18n={i18n}>
          <Stack screenOptions={{ headerShown: false }} />
        </AppProviders>
      ),
    },
    { initialUrl: '/' },
  );
}

function startAt(db: Db, step: 1 | 2 | 3 | 4 | 5, name = 'Claudio'): void {
  saveOnboardingDraft(db, { ...loadOnboardingDraft(db), step, name }, NOW);
}

const press = (testID: string) => fireEvent.press(screen.getByTestId(testID));

function backgroundOf(testID: string): unknown {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style).backgroundColor;
}

function expectBackground(theme: ThemeKey): void {
  expect(backgroundOf('onboarding-step')).toBe(THEMES[theme].colors.background);
}

beforeEach(() => {
  mockGetPermissions.mockReset().mockResolvedValue({ granted: false });
  mockRequestPermissions.mockReset().mockResolvedValue({ granted: true });
  useAppStore.getState().reset();
  useHeroStore.getState().reset();
  useSettingsStore.getState().reset();
  useThemeStore.getState().reset();
});

describe('first launch', () => {
  it('goes through the five steps to Today, with the profile and 3 missions', async () => {
    const db = createTestDb();
    await openApp(db);

    expect(await screen.findByRole('header', { name: 'Scegli la lingua' })).toBeOnTheScreen();
    await press('onboarding-continue');

    expect(
      await screen.findByRole('header', { name: 'Come si chiama il tuo eroe?' }),
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('onboarding-name'), 'Claudio');
    await press('onboarding-continue');

    expect(await screen.findByRole('header', { name: 'Scegli il tema' })).toBeOnTheScreen();
    await press('onboarding-continue');

    expect(
      await screen.findByRole('header', {
        name: 'Scegli da 1 a 5 missioni per iniziare',
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Continua · 3 di 5')).toBeOnTheScreen();
    await press('onboarding-continue');

    expect(await screen.findByRole('header', { name: 'Vuoi i promemoria?' })).toBeOnTheScreen();
    await press('onboarding-enable-notifications');

    expect(await screen.findByRole('header', { name: 'Oggi' })).toBeOnTheScreen();
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(hasProfile(db)).toBe(true);
    const created = db.select().from(missions).all();
    expect(created.map((mission) => mission.templateKey).sort()).toEqual([
      'drink_water',
      'meditation',
      'read_pages',
    ]);
    expect(created.find((mission) => mission.templateKey === 'meditation')?.name).toBe(
      'Meditazione 10 min',
    );
    expect(getSetting(db, 'theme')).toBe('minimal');
    expect(getLanguage(db, [])).toBe('it');
  });

  it('announces every step and shows its segments', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const db = createTestDb();
    startAt(db, 2);
    await openApp(db);

    expect(
      await screen.findByRole('progressbar', { name: "Passo 2 di 5, nome dell'eroe" }),
    ).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith("Passo 2 di 5, nome dell'eroe");
    expect(screen.getAllByTestId('onboarding-segment-on')).toHaveLength(2);
    expect(screen.getAllByTestId('onboarding-segment-off')).toHaveLength(3);
    announce.mockRestore();
  });

  it('has no back arrow on the first step, and no «Salta» on the first two', async () => {
    const db = createTestDb();
    await openApp(db);
    await screen.findByRole('header', { name: 'Scegli la lingua' });

    expect(screen.queryByTestId('onboarding-back')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding-skip')).not.toBeOnTheScreen();

    await press('onboarding-continue');
    await screen.findByRole('header', { name: 'Come si chiama il tuo eroe?' });
    expect(screen.getByTestId('onboarding-back')).toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding-skip')).not.toBeOnTheScreen();
  });

  it('goes back with the arrow and with the back button of Android', async () => {
    const addListener = jest.spyOn(BackHandler, 'addEventListener');
    const db = createTestDb();
    startAt(db, 3);
    await openApp(db);
    await screen.findByRole('header', { name: 'Scegli il tema' });

    await press('onboarding-back');
    await screen.findByRole('header', { name: 'Come si chiama il tuo eroe?' });

    const handler = addListener.mock.calls.at(-1)?.[1];
    await act(async () => {
      expect(handler?.({} as never)).toBe(true);
    });
    expect(await screen.findByRole('header', { name: 'Scegli la lingua' })).toBeOnTheScreen();
    addListener.mockRestore();
  });
});

describe('language step', () => {
  it('preselects the language of the phone and changes the texts at once', async () => {
    const db = createTestDb();
    await openApp(db);
    await screen.findByRole('header', { name: 'Scegli la lingua' });
    expect(screen.getByTestId('onboarding-language-it')).toBeSelected();

    await press('onboarding-language-en');

    expect(await screen.findByRole('header', { name: 'Choose your language' })).toBeOnTheScreen();
    expect(screen.getByText('Continue')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-language-en')).toBeSelected();
    expect(getLanguage(db, [])).toBe('en');
  });
});

describe('name step', () => {
  it('keeps «Continua» off with an empty name, and says why', async () => {
    const db = createTestDb();
    startAt(db, 2, '');
    await openApp(db);
    await screen.findByRole('header', { name: 'Come si chiama il tuo eroe?' });

    const button = screen.getByTestId('onboarding-continue');
    expect(button).toBeDisabled();
    expect(button.props.accessibilityHint).toBe("Scrivi il nome dell'eroe per continuare");

    await fireEvent.changeText(screen.getByTestId('onboarding-name'), '   ');
    expect(screen.getByTestId('onboarding-continue')).toBeDisabled();

    await fireEvent.changeText(screen.getByTestId('onboarding-name'), 'Claudio');
    expect(screen.getByTestId('onboarding-continue')).toBeEnabled();
  });

  it('swings the egg, but not with «Riduci movimento»', async () => {
    const rotationOfEgg = () =>
      StyleSheet.flatten(screen.getByTestId('onboarding-egg').props.style).transform?.[0];

    const db = createTestDb();
    startAt(db, 2);
    await openApp(db);
    await screen.findByRole('header', { name: 'Come si chiama il tuo eroe?' });
    expect(rotationOfEgg()).toEqual({ rotate: '-6deg' });

    cleanup();
    useAppStore.getState().reset();
    setSetting(db, 'reduce_motion', 'on', NOW);
    await openApp(db);
    await screen.findByRole('header', { name: 'Come si chiama il tuo eroe?' });
    expect(rotationOfEgg()).toEqual({ rotate: '0deg' });
  });

  it('stops the name at 20 characters', async () => {
    const db = createTestDb();
    startAt(db, 2, '');
    await openApp(db);
    await screen.findByRole('header', { name: 'Come si chiama il tuo eroe?' });

    await fireEvent.changeText(screen.getByTestId('onboarding-name'), 'x'.repeat(25));

    expect(screen.getByTestId('onboarding-name').props.value).toHaveLength(20);
    expect(loadOnboardingDraft(db).name).toHaveLength(20);
  });
});

describe('theme step', () => {
  it('uses Minimal on steps 1 and 2 and the chosen theme from step 3', async () => {
    const db = createTestDb();
    saveOnboardingDraft(db, { ...loadOnboardingDraft(db), step: 2, theme: 'fantasy' }, NOW);
    await openApp(db);
    await screen.findByRole('header', { name: 'Come si chiama il tuo eroe?' });
    expectBackground('minimal-chiaro');

    await fireEvent.changeText(screen.getByTestId('onboarding-name'), 'Claudio');
    await press('onboarding-continue');

    await screen.findByRole('header', { name: 'Scegli il tema' });
    expectBackground('fantasy');
  });

  it('changes the theme of the whole screen with the card in the centre', async () => {
    const db = createTestDb();
    startAt(db, 3);
    await openApp(db);
    await screen.findByRole('header', { name: 'Scegli il tema' });
    expect(screen.getByTestId('theme-card-minimal')).toBeSelected();
    expect(screen.getByTestId('theme-mode-automatic')).toBeOnTheScreen();

    await fireEvent.scroll(screen.getByTestId('theme-carousel'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 0 },
        contentSize: { width: 2000, height: 340 },
        layoutMeasurement: { width: 390, height: 340 },
      },
    });

    expectBackground('arcade');
    expect(screen.getByTestId('theme-card-arcade')).toBeSelected();
    expect(screen.queryByTestId('theme-mode-automatic')).not.toBeOnTheScreen();
    expect(loadOnboardingDraft(db).theme).toBe('arcade');
  });

  it('does not choose the cards a tap passes on its way to the centre', async () => {
    const db = createTestDb();
    startAt(db, 3);
    await openApp(db);
    await screen.findByRole('header', { name: 'Scegli il tema' });
    const carousel = screen.getByTestId('theme-carousel');
    const interval = Math.round(Dimensions.get('window').width * 0.65) + 12;
    const scrollTo = (x: number) =>
      fireEvent.scroll(carousel, {
        nativeEvent: {
          contentOffset: { x, y: 0 },
          contentSize: { width: 5 * interval, height: 340 },
          layoutMeasurement: { width: interval, height: 340 },
        },
      });

    await press('theme-card-fantasy');
    expect(loadOnboardingDraft(db).theme).toBe('fantasy');

    await scrollTo(3 * interval);
    await scrollTo(2 * interval);
    expect(loadOnboardingDraft(db).theme).toBe('fantasy');

    await scrollTo(interval);
    expect(loadOnboardingDraft(db).theme).toBe('fantasy');

    // The tap has arrived: scrolling chooses again.
    await scrollTo(2 * interval);
    expect(loadOnboardingDraft(db).theme).toBe('cyberpunk');
  });

  it('shows the name just written, the egg and two sample missions in every card', async () => {
    const db = createTestDb();
    startAt(db, 3);
    await openApp(db);
    await screen.findByRole('header', { name: 'Scegli il tema' });

    expect(screen.getByText('Ciao, Claudio')).toBeOnTheScreen();
    expect(screen.getByText('Salve, Claudio')).toBeOnTheScreen();
    expect(screen.getAllByText("Bevi 2 litri d'acqua")).toHaveLength(5);
    expect(screen.getAllByText('Leggi 20 pagine')).toHaveLength(5);
    expect(
      screen.getByLabelText('Tema Fantasy: pergamena, colori caldi, compagno Rocky'),
    ).toBeOnTheScreen();
  });

  describe('space of the sections', () => {
    const SLOTS = [
      'onboarding-title',
      'theme-caption-name',
      'theme-caption-tone',
      'theme-modes',
    ] as const;
    const minHeightOf = (testID: string): unknown =>
      StyleSheet.flatten(screen.getByTestId(testID).props.style).minHeight;

    async function setFontScale(fontScale: number) {
      await act(async () => {
        Dimensions.set({
          window: { width: 390, height: 844, scale: 3, fontScale },
          screen: { width: 390, height: 844, scale: 3, fontScale },
        });
      });
    }

    afterEach(() => setFontScale(1));

    async function slotsAt(theme: ThemeKey): Promise<unknown[]> {
      const db = createTestDb();
      saveOnboardingDraft(db, { ...loadOnboardingDraft(db), step: 3, name: 'Claudio', theme }, NOW);
      await openApp(db);
      await screen.findByRole('header', { name: 'Scegli il tema' });
      const heights = SLOTS.map(minHeightOf);
      await cleanup();
      return heights;
    }

    it('keeps the same height in every theme, so that nothing moves', async () => {
      const minimal = await slotsAt('minimal-chiaro');
      expect(minimal.every((height) => typeof height === 'number' && height > 0)).toBe(true);
      for (const theme of ['arcade', 'fantasy', 'cyberpunk', 'lovecraft'] as const) {
        expect(await slotsAt(theme)).toEqual(minimal);
      }
    });

    it('grows with the text size of the system', async () => {
      const normal = await slotsAt('arcade');
      await setFontScale(1.5);
      const large = await slotsAt('arcade');
      expect(large).toEqual(normal.map((height) => (height as number) * 1.5));
    });

    it('does not keep a height for the title of the other steps', async () => {
      const db = createTestDb();
      startAt(db, 2);
      await openApp(db);
      await screen.findByRole('header', { name: 'Come si chiama il tuo eroe?' });
      expect(minHeightOf('onboarding-title')).toBeUndefined();
    });
  });

  it('fixes Minimal to light or dark with the chips', async () => {
    const db = createTestDb();
    startAt(db, 3);
    await openApp(db);
    await screen.findByRole('header', { name: 'Scegli il tema' });

    await press('theme-mode-dark');

    expectBackground('minimal-scuro');
    expect(screen.getByTestId('theme-mode-dark')).toBeSelected();
    expect(loadOnboardingDraft(db).theme).toBe('minimal-scuro');
  });

  it('with «Salta» goes back to the default theme', async () => {
    const db = createTestDb();
    saveOnboardingDraft(
      db,
      { ...loadOnboardingDraft(db), step: 3, name: 'C', theme: 'arcade' },
      NOW,
    );
    await openApp(db);
    await screen.findByRole('header', { name: 'Scegli il tema' });

    await press('onboarding-skip');

    await screen.findByText('Continua · 3 di 5');
    expect(loadOnboardingDraft(db).theme).toBe('minimal');
  });
});

describe('missions step', () => {
  it('starts with the 3 recommended templates and refuses the sixth', async () => {
    const db = createTestDb();
    startAt(db, 4);
    await openApp(db);
    await screen.findByText('Continua · 3 di 5');
    expect(screen.getByTestId('onboarding-template-drink_water')).toBeChecked();

    await press('onboarding-template-healthy_meal');
    await press('onboarding-template-bed_by_eleven');
    expect(screen.getByText('Continua · 5 di 5')).toBeOnTheScreen();
    expect(screen.queryByText(LIMIT)).not.toBeOnTheScreen();

    await press('onboarding-template-run');

    expect(screen.getByText(LIMIT)).toBeOnTheScreen();
    expect(screen.getByText('Continua · 5 di 5')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-template-run')).not.toBeChecked();
    expect(loadOnboardingDraft(db).templateKeys).toHaveLength(5);
  });

  describe('number on the categories', () => {
    const badgeOf = (category: string) =>
      screen.queryByTestId(`onboarding-category-${category}-badge`);

    it('counts the chosen templates of each category, and shows none at zero', async () => {
      const db = createTestDb();
      saveOnboardingDraft(
        db,
        {
          ...loadOnboardingDraft(db),
          step: 4,
          name: 'Claudio',
          templateKeys: ['drink_water', 'run', 'read_pages'],
        },
        NOW,
      );
      await openApp(db);
      await screen.findByText('Continua · 3 di 5');

      expect(within(badgeOf('health')!).getByText('2')).toBeOnTheScreen();
      expect(within(badgeOf('mind')!).getByText('1')).toBeOnTheScreen();
      expect(badgeOf('work_study')).not.toBeOnTheScreen();
      expect(badgeOf('home')).not.toBeOnTheScreen();
    });

    it('follows the choices, also of a category that is not the one open', async () => {
      const db = createTestDb();
      saveOnboardingDraft(
        db,
        {
          ...loadOnboardingDraft(db),
          step: 4,
          name: 'Claudio',
          templateKeys: ['drink_water', 'read_pages'],
        },
        NOW,
      );
      await openApp(db);
      await screen.findByText('Continua · 2 di 5');

      await press('onboarding-template-run');
      expect(within(badgeOf('health')!).getByText('2')).toBeOnTheScreen();

      // The choices of the other categories stay in the list.
      await press('onboarding-template-read_pages');
      expect(badgeOf('mind')).not.toBeOnTheScreen();
    });

    it('is red, overlaps the corner and leaves room not to be clipped by the list', async () => {
      const db = createTestDb();
      saveOnboardingDraft(
        db,
        { ...loadOnboardingDraft(db), step: 4, name: 'Claudio', theme: 'fantasy' },
        NOW,
      );
      await openApp(db);
      await screen.findByText('Continua · 3 di 5');

      const style = StyleSheet.flatten(badgeOf('health')!.props.style);
      expect(style.backgroundColor).toBe(THEMES.fantasy.colors.dangerText);
      expect(style.position).toBe('absolute');
      expect(style.top).toBeLessThan(0);
      expect(style.right).toBeLessThan(0);
      const room = StyleSheet.flatten(
        screen.getByTestId('onboarding-categories').props.contentContainerStyle,
      ).paddingTop;
      expect(room).toBeGreaterThanOrEqual(-style.top);
    });

    it('is read with the name of the category', async () => {
      const db = createTestDb();
      saveOnboardingDraft(
        db,
        {
          ...loadOnboardingDraft(db),
          step: 4,
          name: 'Claudio',
          templateKeys: ['drink_water', 'run'],
        },
        NOW,
      );
      await openApp(db);
      await screen.findByText('Continua · 2 di 5');

      expect(screen.getByRole('button', { name: 'Salute, selezionate: 2' })).toBeOnTheScreen();
    });
  });

  describe('notice of the limit', () => {
    async function refuseSixth(theme: ThemeKey = 'minimal-chiaro') {
      const db = createTestDb();
      saveOnboardingDraft(
        db,
        {
          ...loadOnboardingDraft(db),
          step: 4,
          name: 'Claudio',
          theme,
          templateKeys: ['drink_water', 'read_pages', 'healthy_meal', 'bed_by_eleven', 'steps'],
        },
        NOW,
      );
      await openApp(db);
      await screen.findByText(/5 di 5/);
      jest.useFakeTimers();
      await press('onboarding-template-run');
    }

    afterEach(() => jest.useRealTimers());

    it('goes away by itself after 5 seconds, with nothing to press', async () => {
      await refuseSixth();

      expect(within(screen.getByTestId('undo-toast')).getByText(LIMIT)).toBeOnTheScreen();
      expect(screen.queryByTestId('undo-toast-undo')).not.toBeOnTheScreen();

      await act(async () => jest.advanceTimersByTime(UNDO_TOAST_MS - 1));
      expect(screen.getByText(LIMIT)).toBeOnTheScreen();

      await act(async () => jest.advanceTimersByTime(1));
      expect(screen.queryByText(LIMIT)).not.toBeOnTheScreen();
    });

    it('takes the theme chosen in the flow', async () => {
      await refuseSixth('arcade');

      expect(StyleSheet.flatten(screen.getByText(LIMIT).props.style).color).toBe(
        THEMES.arcade.colors.background,
      );
    });

    it('does not follow on to the next step', async () => {
      await refuseSixth();

      await press('onboarding-continue');

      expect(screen.queryByText(LIMIT)).not.toBeOnTheScreen();
    });
  });

  it('shows the templates of a category and the choices of the others', async () => {
    const db = createTestDb();
    startAt(db, 4);
    await openApp(db);
    await screen.findByText('Continua · 3 di 5');
    expect(screen.getByTestId('onboarding-template-gym')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-template-meditation')).toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding-template-journal')).not.toBeOnTheScreen();

    await press('onboarding-category-mind');

    expect(screen.getByTestId('onboarding-template-journal')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-template-drink_water')).toBeOnTheScreen();
    expect(screen.queryByTestId('onboarding-template-gym')).not.toBeOnTheScreen();
  });

  it('keeps «Continua» off with no template; «Salta» leaves the recommended ones', async () => {
    const db = createTestDb();
    startAt(db, 4);
    await openApp(db);
    await screen.findByText('Continua · 3 di 5');

    await press('onboarding-template-drink_water');
    await press('onboarding-template-read_pages');
    await press('onboarding-template-meditation');

    const button = screen.getByTestId('onboarding-continue');
    expect(button).toBeDisabled();
    expect(button.props.accessibilityHint).toBe('Scegli almeno una missione per continuare');

    await press('onboarding-skip');

    await screen.findByRole('header', { name: 'Vuoi i promemoria?' });
    expect(loadOnboardingDraft(db).templateKeys).toEqual([
      'drink_water',
      'read_pages',
      'meditation',
    ]);
  });

  it('writes the title with the lexicon of the theme', async () => {
    const db = createTestDb();
    saveOnboardingDraft(
      db,
      { ...loadOnboardingDraft(db), step: 4, name: 'C', theme: 'fantasy' },
      NOW,
    );
    await openApp(db);

    expect(
      await screen.findByRole('header', { name: 'Scegli da 1 a 5 imprese per iniziare' }),
    ).toBeOnTheScreen();
  });
});

describe('notifications step', () => {
  it('goes on to Today without notices when the permission is refused', async () => {
    mockRequestPermissions.mockResolvedValue({ granted: false });
    const db = createTestDb();
    startAt(db, 5);
    await openApp(db);
    await screen.findByRole('header', { name: 'Vuoi i promemoria?' });

    await press('onboarding-enable-notifications');

    expect(await screen.findByRole('header', { name: 'Oggi' })).toBeOnTheScreen();
    expect(mockRequestPermissions).toHaveBeenCalledTimes(1);
    expect(hasProfile(db)).toBe(true);
  });

  it('goes on to Today when the request fails', async () => {
    mockRequestPermissions.mockRejectedValue(new Error('no permission module'));
    const db = createTestDb();
    startAt(db, 5);
    await openApp(db);
    await screen.findByRole('header', { name: 'Vuoi i promemoria?' });

    await press('onboarding-enable-notifications');

    expect(await screen.findByRole('header', { name: 'Oggi' })).toBeOnTheScreen();
    expect(hasProfile(db)).toBe(true);
  });

  it.each(['onboarding-not-now', 'onboarding-skip'])(
    'with %s does not ask for the permission',
    async (testID) => {
      const db = createTestDb();
      startAt(db, 5);
      await openApp(db);
      await screen.findByRole('header', { name: 'Vuoi i promemoria?' });

      await press(testID);

      expect(await screen.findByRole('header', { name: 'Oggi' })).toBeOnTheScreen();
      expect(mockRequestPermissions).not.toHaveBeenCalled();
      expect(hasProfile(db)).toBe(true);
    },
  );
});

describe('resuming', () => {
  it('starts again from step 4 with the choices made, after a new mount', async () => {
    const db = createTestDb();
    await openApp(db);
    await screen.findByRole('header', { name: 'Scegli la lingua' });
    await press('onboarding-continue');
    await screen.findByRole('header', { name: 'Come si chiama il tuo eroe?' });
    await fireEvent.changeText(screen.getByTestId('onboarding-name'), 'Claudio');
    await press('onboarding-continue');
    await screen.findByRole('header', { name: 'Scegli il tema' });
    await press('theme-card-fantasy');
    await press('onboarding-continue');
    await screen.findByText('Continua · 3 di 5');
    await press('onboarding-template-healthy_meal');
    expect(screen.getByText('Continua · 4 di 5')).toBeOnTheScreen();

    // The app closes halfway and opens again on the same database.
    cleanup();
    useAppStore.getState().reset();
    useSettingsStore.getState().reset();
    useThemeStore.getState().reset();
    await openApp(db);

    expect(await screen.findByText('Continua · 4 di 5')).toBeOnTheScreen();
    expect(screen.getByTestId('onboarding-template-healthy_meal')).toBeChecked();
    expectBackground('fantasy');

    await press('onboarding-continue');
    await screen.findByRole('header', { name: 'Vuoi i promemoria?' });
    await press('onboarding-not-now');

    expect(await screen.findByRole('header', { name: 'Oggi' })).toBeOnTheScreen();
    expect(db.select().from(missions).all()).toHaveLength(4);
    expect(getSetting(db, 'theme')).toBe('fantasy');
    expect(useHeroStore.getState().hero?.name).toBe('Claudio');
  });
});
