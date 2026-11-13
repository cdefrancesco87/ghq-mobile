import {
  AuthorizationRequestStatus,
  CategoryValueSleepAnalysis,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  queryCategorySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

import { sleepHoursOf, type HealthMetric, type HealthWindow } from '../../rules/health';
import type { HealthPermission, HealthSource } from './source';

// Apple Salute with @kingstinct/react-native-healthkit. HealthKit never tells an app whether the
// reading was refused: a refused permission reads as no data, so «denied» is only an answer of
// the request that failed.

const STEPS = 'HKQuantityTypeIdentifierStepCount';
const EXERCISE = 'HKQuantityTypeIdentifierAppleExerciseTime';
const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';

const TYPES = { steps: STEPS, active_minutes: EXERCISE, sleep_hours: SLEEP } as const;

const ASLEEP: readonly number[] = [
  CategoryValueSleepAnalysis.asleepUnspecified,
  CategoryValueSleepAnalysis.asleepCore,
  CategoryValueSleepAnalysis.asleepDeep,
  CategoryValueSleepAnalysis.asleepREM,
];

function dateFilter(window: HealthWindow) {
  return { date: { startDate: new Date(window.start), endDate: new Date(window.end) } };
}

async function readMetric(metric: HealthMetric, window: HealthWindow): Promise<number> {
  if (metric === 'sleep_hours') {
    const samples = await queryCategorySamples(SLEEP, { limit: 0, filter: dateFilter(window) });
    return sleepHoursOf(
      samples
        .filter((sample) => ASLEEP.includes(sample.value))
        .map((sample) => ({
          start: new Date(sample.startDate).getTime(),
          end: new Date(sample.endDate).getTime(),
        })),
      window,
    );
  }
  const stats = await queryStatisticsForQuantity(TYPES[metric], ['cumulativeSum'], {
    filter: dateFilter(window),
    unit: metric === 'steps' ? 'count' : 'min',
  });
  return stats.sumQuantity?.quantity ?? 0;
}

export const appleHealth: HealthSource = {
  platform: 'apple',
  permission: async (metric): Promise<HealthPermission> => {
    try {
      if (!isHealthDataAvailable()) {
        return 'unavailable';
      }
      const status = await getRequestStatusForAuthorization({ toRead: [TYPES[metric]] });
      return status === AuthorizationRequestStatus.unnecessary ? 'granted' : 'not_asked';
    } catch {
      return 'unavailable';
    }
  },
  requestPermission: async (metric): Promise<HealthPermission> => {
    try {
      if (!isHealthDataAvailable()) {
        return 'unavailable';
      }
      return (await requestAuthorization({ toRead: [TYPES[metric]] })) ? 'granted' : 'denied';
    } catch {
      return 'unavailable';
    }
  },
  read: async (metric, window) => {
    try {
      return isHealthDataAvailable() ? await readMetric(metric, window) : null;
    } catch {
      return null;
    }
  },
};
