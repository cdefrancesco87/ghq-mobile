import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { useProfileView } from '@/features/profile/useProfileView';

/** Profilo, the last tab of the bar (design-sezioni.md 9.1). */
export default function Profile() {
  const view = useProfileView();
  return view === null ? null : <ProfileScreen view={view} />;
}
