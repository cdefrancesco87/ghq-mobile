import { Text, type ColorValue } from 'react-native';

import { textStyleOf } from '@/theme/fonts';
import { LARGE_TEXT_SCALE } from '@/theme/textScale';
import { useTheme } from '@/theme/ThemeProvider';

/** Tab-bar label (design-sezioni.md A11.1): one line, font scale capped, cut with «…». */
export function NavLabel({ children, color }: { children: string; color: ColorValue }) {
  const { typography } = useTheme();
  return (
    <Text
      numberOfLines={1}
      ellipsizeMode="tail"
      maxFontSizeMultiplier={LARGE_TEXT_SCALE}
      style={[textStyleOf(typography.navLabel), { color }]}
    >
      {children}
    </Text>
  );
}
