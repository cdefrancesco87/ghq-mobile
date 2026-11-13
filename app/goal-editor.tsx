import { useLocalSearchParams } from 'expo-router';

import { BossEditor } from '@/features/bosses/BossEditor';

/**
 * The creation of a boss, at full height (design-sezioni.md 5.2); with `bossId`, «Modifica» (5.3);
 * with `after`, the next boss of a chain (5.8).
 */
export default function GoalEditor() {
  const { bossId, after } = useLocalSearchParams<{ bossId?: string; after?: string }>();
  return <BossEditor bossId={bossId} after={after} />;
}
