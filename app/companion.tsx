import { CompanionScreen } from '@/features/companion/CompanionScreen';
import { useCompanionView } from '@/features/companion/useCompanionView';

/** The companion sheet, from the hero card in Today and from the Profile (design-sezioni.md 6.1). */
export default function Companion() {
  const view = useCompanionView();
  return view === null ? null : <CompanionScreen view={view} />;
}
