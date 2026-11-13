import { useLocalSearchParams } from 'expo-router';

import { BossEditor } from '@/features/bosses/BossEditor';

/** The creation of a boss, at full height (design-sezioni.md 5.2); with `bossId`, «Modifica» (5.3). */
export default function GoalEditor() {
  const { bossId } = useLocalSearchParams<{ bossId?: string }>();
  return <BossEditor bossId={bossId} />;
}
