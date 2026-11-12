import { Redirect } from 'expo-router';

import { OnboardingFlow } from '@/features/onboarding/OnboardingFlow';
import { useAppStore } from '@/stores/app';

/** The first launch; once the profile exists the app goes on to Today. */
export default function Onboarding() {
  const hasProfile = useAppStore((state) => state.hasProfile);
  return hasProfile ? <Redirect href="/today" /> : <OnboardingFlow />;
}
