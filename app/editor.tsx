import { Stack, useLocalSearchParams } from 'expo-router';

import { MissionEditor } from '@/features/editor/MissionEditor';
import { useLargeText } from '@/features/shared/useLargeText';
import { ScreenPlaceholder } from '@/features/shell/ScreenPlaceholder';

/**
 * The mission editor, opened from the [+] of the tab bar as a sheet: half height, dragged up to
 * full height; with very large text it opens at full height (design-sezioni.md 4.1, 4.15).
 * Editing an existing mission (`missionId`) comes with T44.
 */
export default function Editor() {
  const { missionId } = useLocalSearchParams<{ missionId?: string }>();
  const large = useLargeText();
  if (missionId !== undefined) {
    return <ScreenPlaceholder titleKey="editor" />;
  }
  return (
    <>
      <Stack.Screen options={{ sheetAllowedDetents: large ? [1] : [0.5, 1] }} />
      <MissionEditor />
    </>
  );
}
