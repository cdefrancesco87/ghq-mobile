import { ArchivedGoalsScreen } from '@/features/bosses/ArchivedGoalsScreen';
import { useGoalsView } from '@/features/bosses/useGoalsView';

/** The archived goals, from the menu «Altro» of Obiettivi (design-sezioni.md 5.1). */
export default function GoalsArchived() {
  const view = useGoalsView();
  return view === null ? null : <ArchivedGoalsScreen view={view} />;
}
