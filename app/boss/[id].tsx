import { useLocalSearchParams } from 'expo-router';

import { BossScreen } from '@/features/bosses/BossScreen';
import { useBossView } from '@/features/bosses/useBossView';

/** The card of a boss, from Today and Obiettivi, and its trophy (design-sezioni.md 5.3). */
export default function Boss() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const view = useBossView(id);
  return view === null ? null : <BossScreen view={view} />;
}
