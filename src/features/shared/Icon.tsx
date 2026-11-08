import { View, type ColorValue } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { iconSide, iconXml, type IconName, type IconSize } from './icons';

export interface IconProps {
  readonly name: IconName;
  readonly size?: IconSize;
  /** A colour role of the theme; `text` when missing. */
  readonly color?: ColorValue;
  /** Only for an icon that says something on its own: otherwise the screen reader skips it. */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
}

/** An icon in the style of the theme: pixel in Arcade, line with the stroke of the theme elsewhere. */
export function Icon({ name, size = 24, color, accessibilityLabel, testID }: IconProps) {
  const { colors, family } = useTheme();
  const decorative = accessibilityLabel === undefined;
  const side = iconSide(name, family, size);
  return (
    <View
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      <SvgXml xml={iconXml(name, family)} width={side} height={side} color={color ?? colors.text} />
    </View>
  );
}
