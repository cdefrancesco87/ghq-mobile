import { Platform } from 'react-native';

import { pendingTargets } from './actions';
import type { WidgetHost } from './sync';
import type { TimerActivityHost, TimerActivityProps } from './timerActivity';

// The widgets of the system through expo-widgets. The module is loaded on first use, so the
// screens, the tests and a build without the native module (Expo Go, the web) keep working: there
// the widgets are simply absent.

type WidgetModule = typeof import('./GhqWidgets');
type ExpoWidgets = typeof import('expo-widgets');

let widgetModule: WidgetModule | null | undefined;
let expoWidgets: ExpoWidgets | null | undefined;

function loadWidgets(): WidgetModule | null {
  if (widgetModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      widgetModule = require('./GhqWidgets') as WidgetModule;
    } catch {
      widgetModule = null;
    }
  }
  return widgetModule;
}

function loadExpoWidgets(): ExpoWidgets | null {
  if (expoWidgets === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      expoWidgets = require('expo-widgets') as ExpoWidgets;
    } catch {
      expoWidgets = null;
    }
  }
  return expoWidgets;
}

/** The two widgets of the phone; null where expo-widgets is not available. */
export function systemWidgetHost(): WidgetHost | null {
  const loaded = loadWidgets();
  const small = loaded?.smallWidget ?? null;
  const medium = loaded?.mediumWidget ?? null;
  if (small === null || medium === null) {
    return null;
  }
  return {
    update: (snapshot) => {
      small.updateSnapshot(snapshot);
      medium.updateSnapshot(snapshot);
    },
    readPending: async () => {
      // On Android the touches reach the app only as events (`onWidgetTouch`): the props the
      // widget keeps cannot be read back.
      if (Platform.OS !== 'ios') {
        return [];
      }
      const entries = [...(await small.getTimeline()), ...(await medium.getTimeline())];
      return pendingTargets(entries.map((entry) => entry.props));
    },
  };
}

/** Calls `listener` with the target of every touch on a widget while the app runs. */
export function onWidgetTouch(listener: (target: string) => void): () => void {
  const widgets = loadExpoWidgets();
  if (widgets === null) {
    return () => undefined;
  }
  try {
    const subscription = widgets.addUserInteractionListener((event) => listener(event.target));
    return () => subscription.remove();
  } catch {
    return () => undefined;
  }
}

type TimerActivityModule = typeof import('./GhqTimerActivity');
let timerActivityModule: TimerActivityModule | null | undefined;

function loadTimerActivity(): TimerActivityModule | null {
  if (timerActivityModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      timerActivityModule = require('./GhqTimerActivity') as TimerActivityModule;
    } catch {
      timerActivityModule = null;
    }
  }
  return timerActivityModule;
}

/**
 * The Live Activities of the timers (design 12.5; backlog T87), on iPhone only; null elsewhere
 * and where expo-widgets is not available (Android, the web, Expo Go).
 */
export function systemTimerActivityHost(): TimerActivityHost | null {
  const factory = loadTimerActivity()?.timerActivity ?? null;
  if (factory === null || Platform.OS !== 'ios') {
    return null;
  }
  const find = (id: string) => factory.getInstances().find((activity) => activity.getId() === id);
  // Past the end the system shows the activity as stale: the layout then says «Tempo finito».
  const staleOf = (props: TimerActivityProps) =>
    props.phase === 'running' ? new Date(props.endsAt) : undefined;
  return {
    start: (props) => factory.start(props, props.url, staleOf(props)).getId(),
    update: async (id, props) => {
      await find(id)?.update(props, staleOf(props));
    },
    end: async (id, props, dismissAt) => {
      await find(id)?.end(
        dismissAt === null ? 'immediate' : { after: new Date(dismissAt) },
        props ?? undefined,
      );
    },
    list: () => factory.getInstances().map((activity) => activity.getId()),
  };
}
