import { useWindowDimensions } from 'react-native';

import { LARGE_TEXT_SCALE } from '@/theme/textScale';

/** True with very large system text: the only switch of the alternative layouts (A11.1). */
export function useLargeText(): boolean {
  const { fontScale } = useWindowDimensions();
  return fontScale >= LARGE_TEXT_SCALE;
}
