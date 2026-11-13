import type { HealthMetric, HealthWindow } from '@/rules/health';
import type { HealthPermission, HealthSource } from '@/features/health/source';

/** A fake Apple Salute or Health Connect: permissions and readings set by the test. */
export interface FakeHealthSource extends HealthSource {
  /** The permission of each metric; `granted` when missing. */
  permissions: Partial<Record<HealthMetric, HealthPermission>>;
  /** The answer of the next requests; the permission is kept as the new one. */
  answers: Partial<Record<HealthMetric, HealthPermission>>;
  /** The reading of each metric; null when it cannot be read. */
  readings: Partial<Record<HealthMetric, number | null>>;
  readonly requested: HealthMetric[];
  readonly reads: { metric: HealthMetric; window: HealthWindow }[];
}

export function createFakeHealthSource(
  platform: HealthSource['platform'] = 'apple',
): FakeHealthSource {
  const source: FakeHealthSource = {
    platform,
    permissions: {},
    answers: {},
    readings: {},
    requested: [],
    reads: [],
    permission: async (metric) => source.permissions[metric] ?? 'granted',
    requestPermission: async (metric) => {
      source.requested.push(metric);
      const answer = source.answers[metric] ?? 'granted';
      source.permissions[metric] = answer;
      return answer;
    },
    read: async (metric, window) => {
      source.reads.push({ metric, window });
      if ((source.permissions[metric] ?? 'granted') !== 'granted') {
        return null;
      }
      return source.readings[metric] ?? null;
    },
  };
  return source;
}
