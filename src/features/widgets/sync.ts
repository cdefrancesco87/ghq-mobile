import { unseenNotificationCount } from '../../db/repositories/appNotifications';
import type { ActionClock } from '../../db/repositories/hero';
import { hasProfile } from '../../db/repositories/onboarding';
import { getSetting } from '../../db/repositories/settings';
import { getTodayView } from '../../db/repositories/todayView';
import type { Db } from '../../db/types';
import { handleWidgetTarget, type WidgetOutcome } from './actions';
import { buildWidgetSnapshot, widgetThemeOf, type WidgetSnapshot } from './snapshot';
import { widgetTextsOf } from './texts';

// Keeps the widgets in line with the data (design-sezioni.md 12.2, 12.3): first the touches the
// widgets recorded while the app was not listening, then the new snapshot in the shared storage.

/** The widgets of the system, or a fake one in the tests. */
export interface WidgetHost {
  /** Writes the snapshot of both widgets, with an empty list of touches. */
  update(snapshot: WidgetSnapshot): void;
  /** The touches the widgets recorded and the app did not read yet. */
  readPending(): Promise<readonly string[]>;
}

export interface WidgetSyncOptions {
  /** Very large system text (design 12.10). */
  readonly largeText?: boolean;
  /**
   * Runs the completion of a touch: `runAction` in the app, so badges and stores follow; a plain
   * call in the tests.
   */
  readonly act?: <T>(action: (db: Db, clock: ActionClock) => T) => T;
}

export interface WidgetSyncResult {
  /** What happened to every touch read from the widgets. */
  readonly outcomes: readonly WidgetOutcome[];
  /** The snapshot written; null before the first launch is finished. */
  readonly snapshot: WidgetSnapshot | null;
}

export async function syncWidgets(
  db: Db,
  host: WidgetHost,
  clock: () => ActionClock,
  options: WidgetSyncOptions = {},
): Promise<WidgetSyncResult> {
  if (!hasProfile(db)) {
    return { outcomes: [], snapshot: null };
  }
  const act = options.act ?? ((action) => action(db, clock()));
  const outcomes = (await host.readPending()).map((target) =>
    act((actionDb, now) => handleWidgetTarget(actionDb, target, now)),
  );
  const now = clock();
  const snapshot = buildWidgetSnapshot(
    getTodayView(db, now),
    widgetThemeOf(getSetting(db, 'theme')),
    getSetting(db, 'game_mode'),
    {
      unseen: unseenNotificationCount(db, now.now),
      texts: widgetTextsOf(db),
      generation: now.now.toString(36),
      largeText: options.largeText,
    },
  );
  host.update(snapshot);
  return { outcomes, snapshot };
}
