import { Platform } from 'react-native';

import { pendingTargets } from './actions';
import type { WidgetHost } from './sync';

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
