import { Text, useWindowDimensions, type TextProps } from 'react-native';

import { textStyleOf } from '@/theme/fonts';
import { MAX_TEXT_SCALE, MAX_TITLE_SCALE, pixelFontSize } from '@/theme/textScale';
import { useTheme } from '@/theme/ThemeProvider';
import type { Typography } from '@/theme/themes';

export type TextVariant = Exclude<keyof Typography, 'navLabel'>;

const TITLE_VARIANTS: readonly TextVariant[] = ['display', 'screenTitle', 'sectionTitle'];

export interface ThemedTextProps extends TextProps {
  /** The typographic role of the theme. */
  readonly variant?: TextVariant;
  /** The colour, from a role of the theme; `text` when missing. */
  readonly color?: string;
}

/** Text in a typographic role of the theme, with the limits of the system text size of A3. */
export function ThemedText({ variant = 'body', color, style, ...props }: ThemedTextProps) {
  const { colors, typography } = useTheme();
  const { fontScale } = useWindowDimensions();
  const token = typography[variant];
  const maxScale = TITLE_VARIANTS.includes(variant) ? MAX_TITLE_SCALE : MAX_TEXT_SCALE;
  const scaling =
    token.fontFamily === 'Press Start 2P'
      ? {
          allowFontScaling: false,
          fontSize: pixelFontSize(token.fontSize, fontScale, maxScale),
        }
      : { maxFontSizeMultiplier: maxScale, fontSize: token.fontSize };
  const { fontSize, ...textProps } = scaling;
  return (
    <Text
      {...textProps}
      {...props}
      style={[textStyleOf(token), { color: color ?? colors.text, fontSize }, style]}
    />
  );
}
