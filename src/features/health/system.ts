import { Platform } from 'react-native';

import { appleHealth } from './appleHealth';
import { healthConnect } from './healthConnect';
import { NO_HEALTH, type HealthSource } from './source';

// The health source of this phone; the tests put a fake one in its place.

let current: HealthSource | null = null;

function systemHealthSource(): HealthSource {
  switch (Platform.OS) {
    case 'ios':
      return appleHealth;
    case 'android':
      return healthConnect;
    default:
      return NO_HEALTH;
  }
}

export function healthSource(): HealthSource {
  current ??= systemHealthSource();
  return current;
}

/** Tests only: a fake source, or null for that of the phone. */
export function setHealthSource(source: HealthSource | null): void {
  current = source;
}
