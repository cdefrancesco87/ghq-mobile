import type { CompletionResult } from '../../db/repositories/completion';
import type { ActionClock } from '../../db/repositories/hero';
import { gameDayOf, getSetting } from '../../db/repositories/settings';
import { completeTimer, startTimer, stopTimer } from '../../db/repositories/timers';
import type { TodayView } from '../../db/repositories/todayView';
import type { Db } from '../../db/types';
import { LIVE_ACTIVITY } from '../../rules/config';
import { formatCountdown, timerEndsAt, timerRemainingMs } from '../../rules/timer';
import type { GameDay } from '../../rules/types';
import { translator } from '../notifications/texts';
import { colorsOf, widgetThemeOf, type WidgetColors } from './snapshot';

// The Live Activity of the timer of a duration mission on iPhone (design-sezioni.md 12.5;
// backlog T87): on the Lock Screen and in the Dynamic Island, the name, the time missing and the
// buttons Pausa (Riprendi when paused) and Completa; «Fatto!» for a few seconds at the end. The
// activities follow the data: after every action the app compares what runs with what is shown,
// so the play, the pause and the end in Today, a completion from a notification or a widget and
// the buttons of the activity itself all go through the same path. No React, no expo-widgets
// here: the system is behind `TimerActivityHost`, a fake one in the tests.

const MINUTE_MS = 60_000;

export type TimerActivityPhase = 'running' | 'paused' | 'done';

/** What the Live Activity draws: ready texts and colours, the widget runs without the app. */
export interface TimerActivityProps {
  readonly missionId: string;
  readonly name: string;
  readonly phase: TimerActivityPhase;
  /** The instant the whole duration would have started: the lower end of the progress bar. */
  readonly startsAt: number;
  /** The instant the running timer reaches the target (the countdown counts to it). */
  readonly endsAt: number;
  /** «08:30» while paused; empty otherwise. */
  readonly remainingText: string;
  /** The part of the target already done while paused, 0–1. */
  readonly progress: number;
  readonly texts: {
    readonly pause: string;
    readonly resume: string;
    readonly complete: string;
    readonly done: string;
    readonly paused: string;
    readonly timeUp: string;
    readonly pauseA11y: string;
    readonly resumeA11y: string;
    readonly completeA11y: string;
  };
  /** The `target` of each button, read back by `handleTimerActivityTarget`. */
  readonly targets: { readonly pause: string; readonly resume: string; readonly complete: string };
  /** The deep link of a touch on the activity: Today with the row highlighted. */
  readonly url: string;
  readonly colors: { readonly light: WidgetColors; readonly dark: WidgetColors };
}

/** The Live Activities of the system, or a fake one in the tests. */
export interface TimerActivityHost {
  /** Starts an activity and gives its id; throws when the system refuses. */
  start(props: TimerActivityProps): string;
  update(id: string, props: TimerActivityProps): Promise<void>;
  /** Ends an activity: with `props` shown until `dismissAt`, or at once when `dismissAt` is null. */
  end(id: string, props: TimerActivityProps | null, dismissAt: number | null): Promise<void>;
  /** The ids of the activities of the timer still on screen. */
  list(): readonly string[];
}

/** The state of the timer of a duration mission of today. */
export type TimerMissionState =
  | {
      readonly missionId: string;
      readonly status: 'running';
      readonly name: string;
      readonly target: number;
      readonly endsAt: number;
    }
  | {
      readonly missionId: string;
      readonly status: 'paused';
      readonly name: string;
      readonly target: number;
      readonly remainingMs: number;
    }
  | {
      readonly missionId: string;
      readonly status: 'done';
      readonly name: string;
      readonly target: number;
    }
  | { readonly missionId: string; readonly status: 'gone' };

/** The duration missions of Today and the state of their timers. */
export function timerMissionsOf(view: TodayView, now: number): TimerMissionState[] {
  return view.missions.flatMap((item): TimerMissionState[] => {
    const { mission } = item;
    if (mission.goalType !== 'duration' || mission.goalTarget === null || mission.goalTarget <= 0) {
      return [];
    }
    const base = { missionId: mission.id, name: mission.name, target: mission.goalTarget };
    if (item.state === 'done') {
      return [{ ...base, status: 'done' }];
    }
    if (item.state !== 'todo') {
      return [{ missionId: mission.id, status: 'gone' }];
    }
    const value = item.value ?? 0;
    if (item.timerStartedAt !== null) {
      return [
        {
          ...base,
          status: 'running',
          endsAt: timerEndsAt({ startedAt: item.timerStartedAt, target: base.target, value }),
        },
      ];
    }
    return [
      {
        ...base,
        status: 'paused',
        remainingMs: timerRemainingMs({ startedAt: null, target: base.target, value, now }),
      },
    ];
  });
}

/** The texts and colours shared by the activities, in the language and theme of the settings. */
export interface TimerActivityLook {
  readonly texts: (name: string) => TimerActivityProps['texts'];
  readonly colors: TimerActivityProps['colors'];
}

export function timerActivityLookOf(db: Db): TimerActivityLook {
  const t = translator(getSetting(db, 'language'));
  const theme = widgetThemeOf(getSetting(db, 'theme'));
  return {
    texts: (name) => ({
      pause: t('widgets.timer.pause'),
      resume: t('widgets.timer.resume'),
      complete: t('widgets.timer.complete'),
      done: t('widgets.timer.done'),
      paused: t('widgets.timer.paused'),
      timeUp: t('widgets.timer.timeUp'),
      pauseA11y: t('widgets.timer.pauseA11y', { name }),
      resumeA11y: t('widgets.timer.resumeA11y', { name }),
      completeA11y: t('widgets.timer.completeA11y', { name }),
    }),
    colors: { light: colorsOf(theme.light.colors), dark: colorsOf(theme.dark.colors) },
  };
}

const ACTIONS = { p: 'pause', r: 'resume', c: 'complete' } as const;
export type TimerActivityAction = (typeof ACTIONS)[keyof typeof ACTIONS];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `la|<p|r|c>|<mission>|<day>`: the `target` of a button of the activity. */
export function encodeActivityTarget(
  action: TimerActivityAction,
  missionId: string,
  day: GameDay,
): string {
  return ['la', action[0], missionId, day].join('|');
}

export function decodeActivityTarget(
  value: string,
): { action: TimerActivityAction; missionId: string; day: GameDay } | null {
  const parts = value.split('|');
  if (parts.length !== 4 || parts[0] !== 'la') {
    return null;
  }
  const action = ACTIONS[parts[1] as keyof typeof ACTIONS];
  if (action === undefined || parts[2] === '' || !DAY.test(parts[3])) {
    return null;
  }
  return { action, missionId: parts[2], day: parts[3] as GameDay };
}

type ShownState = Extract<TimerMissionState, { status: 'running' | 'paused' | 'done' }>;

export function timerActivityProps(
  state: ShownState,
  day: GameDay,
  look: TimerActivityLook,
  now: number,
): TimerActivityProps {
  const targetMs = state.target * MINUTE_MS;
  const endsAt =
    state.status === 'running'
      ? state.endsAt
      : state.status === 'paused'
        ? now + state.remainingMs
        : now;
  return {
    missionId: state.missionId,
    name: state.name,
    phase: state.status,
    startsAt: endsAt - targetMs,
    endsAt,
    remainingText: state.status === 'paused' ? formatCountdown(state.remainingMs) : '',
    progress: state.status === 'paused' ? 1 - state.remainingMs / targetMs : 1,
    texts: look.texts(state.name),
    targets: {
      pause: encodeActivityTarget('pause', state.missionId, day),
      resume: encodeActivityTarget('resume', state.missionId, day),
      complete: encodeActivityTarget('complete', state.missionId, day),
    },
    url: `ghq:///today?mission=${encodeURIComponent(state.missionId)}`,
    colors: look.colors,
  };
}

/** What changes on screen: a paused activity drawn again later is the same. */
function shownKey(props: TimerActivityProps): string {
  const { startsAt, endsAt, ...rest } = props;
  return JSON.stringify(props.phase === 'paused' ? rest : { ...rest, startsAt, endsAt });
}

export interface TimerActivitySyncInput {
  readonly day: GameDay;
  readonly now: number;
  readonly missions: readonly TimerMissionState[];
  readonly look: TimerActivityLook;
  /** iPhone starts an activity only with the app in the foreground. */
  readonly canStart: boolean;
}

interface Tracked {
  readonly id: string;
  readonly day: GameDay;
  readonly key: string;
}

/**
 * Keeps the Live Activities in line with the timers: a timer that runs gets an activity (started
 * only from the play, with the app open), a pause shows «In pausa» and Riprendi, a mission done
 * shows «Fatto!» for `LIVE_ACTIVITY.doneDismissMs` and closes, a mission skipped, deleted or of
 * another day closes at once. The activities left by an earlier run of the app are closed at the
 * first sync: the running timers get a new one.
 */
export function createTimerActivities(host: TimerActivityHost) {
  const tracked = new Map<string, Tracked>();
  let cleaned = false;

  const safely = async (call: () => Promise<void>) => {
    try {
      await call();
    } catch {
      // The person closed the activity, or the system refused: nothing else to do.
    }
  };

  const sync = async (input: TimerActivitySyncInput): Promise<void> => {
    if (!cleaned) {
      cleaned = true;
      let left: readonly string[] = [];
      try {
        left = host.list();
      } catch {
        left = [];
      }
      for (const id of left) {
        await safely(() => host.end(id, null, null));
      }
    }
    const byMission = new Map(input.missions.map((state) => [state.missionId, state]));

    for (const [missionId, entry] of [...tracked]) {
      const state = entry.day === input.day ? byMission.get(missionId) : undefined;
      if (state === undefined || state.status === 'gone') {
        tracked.delete(missionId);
        await safely(() => host.end(entry.id, null, null));
        continue;
      }
      const props = timerActivityProps(state, input.day, input.look, input.now);
      if (state.status === 'done') {
        tracked.delete(missionId);
        await safely(() => host.end(entry.id, props, input.now + LIVE_ACTIVITY.doneDismissMs));
        continue;
      }
      const key = shownKey(props);
      if (key !== entry.key) {
        tracked.set(missionId, { ...entry, key });
        await safely(() => host.update(entry.id, props));
      }
    }

    if (!input.canStart) {
      return;
    }
    for (const state of input.missions) {
      if (state.status !== 'running' || tracked.has(state.missionId)) {
        continue;
      }
      const props = timerActivityProps(state, input.day, input.look, input.now);
      try {
        tracked.set(state.missionId, {
          id: host.start(props),
          day: input.day,
          key: shownKey(props),
        });
      } catch {
        // Live Activities turned off in the Settings of the phone: the timer runs as before.
      }
    }
  };

  /**
   * Ends every activity on screen, those of this run and those left by an earlier one: no
   * profile (before the first launch, after «Elimina tutti i dati») has a timer to show.
   */
  const endAll = async (): Promise<void> => {
    cleaned = true;
    tracked.clear();
    let left: readonly string[] = [];
    try {
      left = host.list();
    } catch {
      left = [];
    }
    for (const id of left) {
      await safely(() => host.end(id, null, null));
    }
  };

  return { sync, endAll };
}

export type TimerActivities = ReturnType<typeof createTimerActivities>;

/** What a button of the activity did. */
export interface TimerActivityOutcome {
  /** `ignored`: not a target of the activity, or of another day; `failed`: refused. */
  readonly outcome: 'ignored' | 'failed' | 'paused' | 'resumed' | 'completed';
  readonly missionId: string | null;
  /** The completion or the minutes saved, when something was written. */
  readonly result: CompletionResult | null;
  /** The new end of a resumed timer, for its notification. */
  readonly endsAt: number | null;
}

const IGNORED: TimerActivityOutcome = {
  outcome: 'ignored',
  missionId: null,
  result: null,
  endsAt: null,
};

/**
 * A touch on Pausa, Riprendi or Completa of the activity (design 12.5): the pause saves the
 * minutes counted like the pause of Today, Riprendi starts the timer again, Completa completes
 * the mission with the minutes missing. A touch of a day before is ignored.
 */
export function handleTimerActivityTarget(
  db: Db,
  value: string,
  clock: ActionClock,
): TimerActivityOutcome {
  const target = decodeActivityTarget(value);
  if (target === null) {
    return IGNORED;
  }
  if (target.day !== gameDayOf(clock.now, clock.tzOffset, getSetting(db, 'day_change'))) {
    return IGNORED;
  }
  const input = { missionId: target.missionId, now: clock.now, tzOffset: clock.tzOffset };
  const base = { missionId: target.missionId, result: null, endsAt: null };
  try {
    switch (target.action) {
      case 'pause':
        return { ...base, outcome: 'paused', result: stopTimer(db, input) };
      case 'resume':
        return { ...base, outcome: 'resumed', endsAt: startTimer(db, input).endsAt };
      case 'complete':
        return { ...base, outcome: 'completed', result: completeTimer(db, input) };
    }
  } catch {
    return { ...base, outcome: 'failed' };
  }
}
