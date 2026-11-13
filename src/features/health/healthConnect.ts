import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

import type { HealthMetric, HealthWindow } from '../../rules/health';
import type { HealthPermission, HealthSource } from './source';

// Health Connect with react-native-health-connect. The background reading has its own permission
// (Android 15): it is asked together with the metric, and without it only the app reads.

const RECORDS = {
  steps: 'Steps',
  active_minutes: 'ExerciseSession',
  sleep_hours: 'SleepSession',
} as const;

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

let ready: Promise<boolean> | null = null;

/** The client is created once; false when Health Connect is missing or must be updated. */
function connect(): Promise<boolean> {
  if (ready === null) {
    const attempt = (async () => {
      try {
        if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE) {
          return false;
        }
        return await initialize();
      } catch {
        return false;
      }
    })();
    ready = attempt;
    // A failure is tried again next time: Health Connect may be installed meanwhile.
    void attempt.then((ok) => {
      if (!ok && ready === attempt) {
        ready = null;
      }
    });
  }
  return ready;
}

async function granted(metric: HealthMetric): Promise<boolean> {
  const permissions = await getGrantedPermissions();
  return permissions.some(
    (permission) => permission.accessType === 'read' && permission.recordType === RECORDS[metric],
  );
}

async function readMetric(metric: HealthMetric, window: HealthWindow): Promise<number> {
  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: new Date(window.start).toISOString(),
    endTime: new Date(window.end).toISOString(),
  };
  switch (metric) {
    case 'steps':
      return (await aggregateRecord({ recordType: 'Steps', timeRangeFilter })).COUNT_TOTAL;
    case 'active_minutes': {
      const result = await aggregateRecord({ recordType: 'ExerciseSession', timeRangeFilter });
      return result.EXERCISE_DURATION_TOTAL.inSeconds / SECONDS_PER_MINUTE;
    }
    case 'sleep_hours': {
      const result = await aggregateRecord({ recordType: 'SleepSession', timeRangeFilter });
      return result.SLEEP_DURATION_TOTAL / SECONDS_PER_HOUR;
    }
  }
}

export const healthConnect: HealthSource = {
  platform: 'health_connect',
  permission: async (metric): Promise<HealthPermission> => {
    try {
      if (!(await connect())) {
        return 'unavailable';
      }
      return (await granted(metric)) ? 'granted' : 'denied';
    } catch {
      return 'unavailable';
    }
  },
  requestPermission: async (metric): Promise<HealthPermission> => {
    try {
      if (!(await connect())) {
        return 'unavailable';
      }
      await requestPermission([
        { accessType: 'read', recordType: RECORDS[metric] },
        { accessType: 'read', recordType: 'BackgroundAccessPermission' },
      ]);
      return (await granted(metric)) ? 'granted' : 'denied';
    } catch {
      return 'unavailable';
    }
  },
  read: async (metric, window) => {
    try {
      return (await connect()) ? await readMetric(metric, window) : null;
    } catch {
      return null;
    }
  },
};
