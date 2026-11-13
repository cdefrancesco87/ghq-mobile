import type { HealthMetric, HealthWindow } from '../../rules/health';

// One interface of ours over Apple Salute and Health Connect (stack-tecnologico.md, point 7):
// the app, the background task and the editor talk only to this, the tests to a fake one.

/**
 * `granted`: the data can be read. `denied`: the user said no. `not_asked`: never asked on this
 * phone (a restored backup). `unavailable`: no health data on this phone (no Health Connect, an
 * iPad), or the system did not answer.
 */
export type HealthPermission = 'granted' | 'denied' | 'not_asked' | 'unavailable';

/** Apple Salute on iPhone, Health Connect on Android. */
export type HealthPlatform = 'apple' | 'health_connect';

export interface HealthSource {
  /** Null on a phone without health data: the row «Collega a Salute» says so. */
  readonly platform: HealthPlatform | null;
  /** The permission for a metric, without asking. */
  permission(metric: HealthMetric): Promise<HealthPermission>;
  /** Asks the system permission for a metric: only from the row of the editor (design 12.7). */
  requestPermission(metric: HealthMetric): Promise<HealthPermission>;
  /**
   * The total of a metric in a window: steps, minutes of activity or hours asleep. Null when it
   * cannot be read (no permission, no data source); it never throws.
   */
  read(metric: HealthMetric, window: HealthWindow): Promise<number | null>;
}

/** A phone without health data. */
export const NO_HEALTH: HealthSource = {
  platform: null,
  permission: async () => 'unavailable',
  requestPermission: async () => 'unavailable',
  read: async () => null,
};
