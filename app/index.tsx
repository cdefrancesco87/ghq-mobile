import { Redirect } from 'expo-router';

import { useAppStore } from '@/stores/app';

/** The entrance: the first launch goes to the profile creation, afterwards to Today. */
export default function Index() {
  const hasProfile = useAppStore((state) => state.hasProfile);
  // TEMPORARY, only on chore/t34-device-test: opens the test screen without a deep link. The tests
  // of the navigation still see the real entrance.
  if (__DEV__ && process.env.NODE_ENV !== 'test') {
    return <Redirect href="/dev/components" />;
  }
  return <Redirect href={hasProfile ? '/today' : '/onboarding'} />;
}
