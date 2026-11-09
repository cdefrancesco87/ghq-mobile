import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { AccessibilityInfo, Dimensions, Pressable, StyleSheet } from 'react-native';

import type { EventRow } from '@/db/repositories/events';
import { useSettingsStore } from '@/stores/settings';

import { renderThemed } from '../../../test/render';
import { CELEBRATION_MS, CelebrationProvider, useCelebration } from './Celebration';
import { MOMENT_MAX_MS, MomentQueueProvider, useMomentQueue } from './MomentQueue';
import { addMoments, momentsFromEvents, type Moment } from './moments';
import { useReduceMotion } from './useReduceMotion';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const event = (type: EventRow['type'], id: string, fields: Partial<EventRow> = {}) =>
  ({ id, type, dXp: 0, dCoins: 0, payload: {}, ...fields }) as EventRow;

const LEVEL_UP = event('hero.level_up', 'level', { payload: { from: 4, to: 5 } });
const VICTORY = event('boss.defeated', 'boss', { dXp: 120, dCoins: 24 });
const STAGE_UP = event('companion.stage_up', 'stage', { payload: { from: 'baby', to: 'adult' } });
const BADGE = event('badge.unlocked', 'badge');

const ORIGIN = { x: 340, y: 500 };

/** Hidden from the screen reader, so the queries must be told to look at it. */
const queryEffect = () =>
  screen.queryByTestId('celebration-effect', { includeHiddenElements: true });

function setReduceMotion(value: 'on' | 'off' | 'system') {
  const { settings } = useSettingsStore.getState();
  useSettingsStore.setState({ settings: { ...settings, reduce_motion: value } });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(Haptics.impactAsync).mockClear();
  // React Native's own Jest mock: spying on it again would keep the value between tests.
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false);
  setReduceMotion('off');
});

afterEach(() => {
  jest.useRealTimers();
  useSettingsStore.getState().reset();
  jest.restoreAllMocks();
});

describe('momentsFromEvents', () => {
  it('turns only the moment events into moments', () => {
    const moments = momentsFromEvents([
      event('mission.completed', 'mission'),
      VICTORY,
      STAGE_UP,
      BADGE,
    ]);
    expect(moments).toEqual([
      { kind: 'boss_defeated', id: 'boss', xp: 120, coins: 24 },
      { kind: 'companion_stage', id: 'stage', stage: 'adult' },
      { kind: 'badge', id: 'badge' },
    ]);
  });

  it('gives a new title only when the level earns one', () => {
    expect(momentsFromEvents([LEVEL_UP])[0]).toMatchObject({ level: 5, titleIndex: 1 });
    const noTitle = event('hero.level_up', 'plain', { payload: { from: 5, to: 6 } });
    expect(momentsFromEvents([noTitle])[0]).toMatchObject({ level: 6, titleIndex: null });
  });
});

describe('addMoments', () => {
  const kinds = (queue: readonly Moment[]) => queue.map((moment) => moment.kind);

  it('puts the most important first', () => {
    const queue = addMoments([], momentsFromEvents([BADGE, STAGE_UP, VICTORY, LEVEL_UP]));
    expect(kinds(queue)).toEqual(['level_up', 'boss_defeated', 'companion_stage', 'badge']);
  });

  it('leaves the moment on screen where it is', () => {
    const queue = addMoments(momentsFromEvents([BADGE]), momentsFromEvents([STAGE_UP, LEVEL_UP]));
    expect(kinds(queue)).toEqual(['badge', 'level_up', 'companion_stage']);
  });

  it('queues the same id once when it is added twice', () => {
    const once = addMoments([], momentsFromEvents([BADGE]));
    const twice = addMoments(once, momentsFromEvents([BADGE]));
    expect(twice.map((moment) => moment.id)).toEqual(['badge']);
  });

  it('drops duplicates inside the same batch', () => {
    const queue = addMoments([], momentsFromEvents([BADGE, BADGE]));
    expect(queue.map((moment) => moment.id)).toEqual(['badge']);
  });

  it('does not queue again the moment on screen', () => {
    const queue = addMoments(momentsFromEvents([BADGE]), momentsFromEvents([BADGE, STAGE_UP]));
    expect(queue.map((moment) => moment.id)).toEqual(['badge', 'stage']);
  });

  it('keeps the order of arrival for different ids of the same kind', () => {
    const first = event('badge.unlocked', 'badge-1');
    const second = event('badge.unlocked', 'badge-2');
    const queue = addMoments(momentsFromEvents([first]), momentsFromEvents([second, BADGE]));
    expect(queue.map((moment) => moment.id)).toEqual(['badge-1', 'badge-2', 'badge']);
  });
});

describe('useReduceMotion', () => {
  function Probe() {
    return useReduceMotion() ? <Pressable testID="reduced" /> : null;
  }

  it('follows the phone when the setting says so', async () => {
    setReduceMotion('system');
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await renderThemed(<Probe />);
    expect(screen.getByTestId('reduced')).toBeTruthy();
  });

  it('lets the setting of the app win over the phone', async () => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true);
    await renderThemed(<Probe />);
    expect(screen.queryByTestId('reduced')).toBeNull();
    await act(async () => setReduceMotion('on'));
    expect(screen.getByTestId('reduced')).toBeTruthy();
  });

  it('hears when the phone changes', async () => {
    setReduceMotion('system');
    let listener: (enabled: boolean) => void = () => undefined;
    jest.mocked(AccessibilityInfo.addEventListener).mockImplementationOnce((_, handler) => {
      listener = handler as (enabled: boolean) => void;
      return { remove: jest.fn() } as never;
    });
    await renderThemed(<Probe />);
    expect(screen.queryByTestId('reduced')).toBeNull();
    await act(async () => listener(true));
    expect(screen.getByTestId('reduced')).toBeTruthy();
  });
});

describe('useCelebration', () => {
  const onTouch = jest.fn();

  function Tap({ coins = 8 }: { coins?: number }) {
    const { celebrate } = useCelebration();
    return (
      <Pressable
        testID="tap"
        onPress={() => {
          celebrate({ xp: 25, coins, origin: ORIGIN });
          onTouch(jest.mocked(Haptics.impactAsync).mock.calls.length);
        }}
      />
    );
  }

  const renderTap = (coins?: number) =>
    renderThemed(
      <CelebrationProvider>
        <Tap coins={coins} />
      </CelebrationProvider>,
    );

  it('starts in the same cycle as the touch, without any timer passing', async () => {
    await renderTap();
    onTouch.mockClear();
    await fireEvent.press(screen.getByTestId('tap'));
    expect(onTouch).toHaveBeenCalledWith(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(screen.getByTestId('celebration-chip')).toBeTruthy();
    expect(queryEffect()).toBeTruthy();
    expect(screen.getAllByTestId('celebration-coin')).toHaveLength(3);
  });

  it('says what was earned, also to the screen reader', async () => {
    await renderTap();
    await fireEvent.press(screen.getByTestId('tap'));
    expect(screen.getByText('+25 XP · +8')).toBeTruthy();
    expect(screen.getByTestId('celebration-chip').props.accessibilityLabel).toBe(
      '+25 XP, +8 Monete',
    );
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('+25 XP, +8 Monete');
  });

  it('puts the gain beside the control, as in the mockup D08', async () => {
    await renderTap();
    await fireEvent.press(screen.getByTestId('tap'));
    const style = StyleSheet.flatten(screen.getByTestId('celebration-chip').props.style);
    expect(style).toMatchObject({
      top: ORIGIN.y,
      right: Dimensions.get('window').width - ORIGIN.x + 14,
    });
  });

  it('flies no coins when there are none', async () => {
    await renderTap(0);
    await fireEvent.press(screen.getByTestId('tap'));
    expect(screen.queryByTestId('celebration-coin')).toBeNull();
    expect(screen.getByText('+25 XP')).toBeTruthy();
  });

  it('goes away by itself, and each touch has its own', async () => {
    await renderTap();
    await fireEvent.press(screen.getByTestId('tap'));
    await act(async () => jest.advanceTimersByTime(CELEBRATION_MS / 2));
    await fireEvent.press(screen.getByTestId('tap'));
    expect(screen.getAllByTestId('celebration-chip')).toHaveLength(2);
    await act(async () => jest.advanceTimersByTime(CELEBRATION_MS / 2));
    expect(screen.getAllByTestId('celebration-chip')).toHaveLength(1);
    await act(async () => jest.advanceTimersByTime(CELEBRATION_MS / 2));
    expect(screen.queryByTestId('celebration-chip')).toBeNull();
  });

  it('with «Riduci movimento» keeps the gain and the vibration, without effect and coins', async () => {
    setReduceMotion('on');
    await renderTap();
    await fireEvent.press(screen.getByTestId('tap'));
    expect(screen.getByTestId('celebration-chip')).toBeTruthy();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(queryEffect()).toBeNull();
    expect(screen.queryByTestId('celebration-coin')).toBeNull();
  });

  it.each(['minimal-chiaro', 'arcade', 'fantasy', 'cyberpunk', 'lovecraft'] as const)(
    'draws the sign of the %s theme',
    async (theme) => {
      await renderThemed(
        <CelebrationProvider>
          <Tap />
        </CelebrationProvider>,
        { theme },
      );
      await fireEvent.press(screen.getByTestId('tap'));
      expect(queryEffect()).toBeTruthy();
    },
  );

  it('throws outside its provider', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(renderThemed(<Tap />)).rejects.toThrow('CelebrationProvider');
  });
});

describe('MomentQueue', () => {
  function Feed({ events }: { events: readonly EventRow[] }) {
    const { enqueue } = useMomentQueue();
    useEffect(() => enqueue(events), [enqueue, events]);
    return null;
  }

  const ALL = [BADGE, STAGE_UP, VICTORY, LEVEL_UP];

  const renderQueue = (events: readonly EventRow[], theme?: 'fantasy') =>
    renderThemed(
      <MomentQueueProvider>
        <Feed events={events} />
      </MomentQueueProvider>,
      { theme },
    );

  it('shows the moments from the most important, one at a time', async () => {
    await renderQueue(ALL);
    expect(screen.getByTestId('moment-level_up')).toBeTruthy();
    expect(screen.queryByTestId('moment-boss_defeated')).toBeNull();
    await fireEvent.press(screen.getByTestId('moment-backdrop'));
    expect(screen.getByTestId('moment-boss_defeated')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('moment-backdrop'));
    expect(screen.getByTestId('moment-companion_stage')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('moment-backdrop'));
    expect(screen.getByTestId('moment-badge')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('moment-backdrop'));
    expect(screen.queryByTestId('moment-badge')).toBeNull();
  });

  it.each(['moment-backdrop', 'moment-skip', 'moment-continue'])(
    'moves on with one touch on %s',
    async (id) => {
      await renderQueue([LEVEL_UP, BADGE]);
      await fireEvent.press(screen.getByTestId(id));
      expect(screen.queryByTestId('moment-level_up')).toBeNull();
      expect(screen.getByTestId('moment-badge')).toBeTruthy();
    },
  );

  it('moves on by itself at 2.5 seconds, each moment with its own time', async () => {
    await renderQueue([LEVEL_UP, BADGE]);
    await act(async () => jest.advanceTimersByTime(MOMENT_MAX_MS - 1));
    expect(screen.getByTestId('moment-level_up')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(1));
    expect(screen.getByTestId('moment-badge')).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(MOMENT_MAX_MS));
    expect(screen.queryByTestId('moment-badge')).toBeNull();
  });

  it('does not open for events that bring no moment', async () => {
    await renderQueue([event('mission.completed', 'mission')]);
    expect(screen.queryByTestId('moment-backdrop')).toBeNull();
  });

  it('writes the level with the new title in the lexicon of the theme', async () => {
    await renderQueue([LEVEL_UP], 'fantasy');
    expect(screen.getByText('Rango 5!')).toBeTruthy();
    expect(screen.getByText('Nuovo titolo: Cavaliere')).toBeTruthy();
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Rango 5!. Nuovo titolo: Cavaliere',
    );
  });

  it('draws the emblem of a badge in a circle', async () => {
    await renderQueue([BADGE]);
    const style = StyleSheet.flatten(screen.getByTestId('moment-icon-emblem').props.style);
    expect(style.borderRadius).toBe(style.width / 2);
  });

  it('writes the victory with the rewards in the lexicon of the theme', async () => {
    await renderQueue([VICTORY], 'fantasy');
    expect(screen.getByText('Vittoria!')).toBeTruthy();
    expect(screen.getByText('+120 Esperienza · +24 Oro')).toBeTruthy();
  });

  it('writes the companion that has grown', async () => {
    await renderQueue([STAGE_UP]);
    expect(screen.getByText('Cloudy è cresciuto!')).toBeTruthy();
    expect(screen.getByText('Ora è un adulto')).toBeTruthy();
  });

  it('throws confetti for a victory, none with «Riduci movimento»', async () => {
    await renderQueue([VICTORY]);
    expect(screen.getAllByTestId('moment-particle')).toHaveLength(8);
    await fireEvent.press(screen.getByTestId('moment-continue'));
    await act(async () => setReduceMotion('on'));
    await renderQueue([VICTORY]);
    expect(screen.getByTestId('moment-boss_defeated')).toBeTruthy();
    expect(screen.queryByTestId('moment-particle')).toBeNull();
  });
});
