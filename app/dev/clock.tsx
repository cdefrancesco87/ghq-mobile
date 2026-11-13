import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { advanceClock } from '@/stores/app';

// Moves the clock of the app forward by `days` whole days and goes back to the entrance. It
// exists only in development builds, for the Maestro flows (`ghq://dev/clock?days=1`), and it
// lasts until the app restarts. In English, like the rest of the developer tools.

export default function DevClock() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <DevClockMove />;
}

function DevClockMove() {
  const { days } = useLocalSearchParams<{ days?: string }>();
  const router = useRouter();
  const moved = useRef(false);

  useEffect(() => {
    // The effect can run twice in development: the clock moves once.
    if (moved.current) {
      return;
    }
    moved.current = true;
    advanceClock(Number(days ?? 1));
    router.replace('/');
  }, [days, router]);

  return null;
}
