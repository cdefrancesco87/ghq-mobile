import { Redirect } from 'expo-router';

import { useAppStore } from '@/stores/app';

/** The entrance: the first launch goes to the profile creation, afterwards to Today. */
export default function Index() {
  const hasProfile = useAppStore((state) => state.hasProfile);
  return <Redirect href={hasProfile ? '/today' : '/onboarding'} />;
}
