import { BadgesScreen } from '@/features/profile/BadgesScreen';
import { useBadgesView } from '@/features/profile/useProfileView';

/** Every badge, from «Vedi tutti» of the Profile (design-sezioni.md 9.6). */
export default function Badges() {
  const view = useBadgesView();
  return view === null ? null : <BadgesScreen view={view} />;
}
