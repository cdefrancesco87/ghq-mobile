import { useLocalSearchParams } from 'expo-router';

import { MissionEditor } from '@/features/editor/MissionEditor';

/**
 * The mission editor, opened as a sheet: from the [+] of the tab bar, with `missionId` to edit a
 * mission, with `bossId` from a boss (design-sezioni.md 4.1).
 */
export default function Editor() {
  const { missionId, bossId } = useLocalSearchParams<{ missionId?: string; bossId?: string }>();
  return <MissionEditor missionId={missionId} bossId={bossId} />;
}
