import { Pressable, StyleSheet, View } from 'react-native';

import { pressedColour } from '@/theme/contrast';
import { BADGE_FILL, BADGE_TEXT, SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeFamily } from '@/theme/themes';
import { Frame } from './Frame';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { ThemedText } from './ThemedText';
import { hitSlopFor } from './touch';

export const CHIP_HEIGHT = 32;

/** How far the number of a chip goes out of it: a list that clips must leave this room. */
export const CHIP_BADGE_OVERLAP = 8;
const BADGE_SIZE = 20;
const BADGE_FONT_SIZE = 11;
/** In Cyberpunk the number is hard to read at the size of the other themes. */
const BADGE_FONT_SIZE_CYBERPUNK = 14;
/**
 * How far to move the number so that its figure sits in the centre: a font leaves it off centre by
 * its own metrics. Measured on the figures 1 to 5 of each font, at the sizes above; `xOne` is for
 * the 1, which is narrower than the others.
 */
const BADGE_NUDGE: Readonly<
  Record<ThemeFamily, { readonly x: number; readonly xOne: number; readonly y: number }>
> = {
  minimal: { x: 0, xOne: 0.3, y: -0.25 },
  arcade: { x: 0.7, xOne: 0, y: 0.7 },
  fantasy: { x: 0, xOne: 0, y: 0.5 },
  cyberpunk: { x: 0, xOne: 0.3, y: 0.1 },
  lovecraft: { x: 0, xOne: 0, y: -0.6 },
};

export interface ChipProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly selected?: boolean;
  readonly icon?: IconName;
  /** A number on the top right corner, as on a notification; none at 0. */
  readonly badge?: number;
  /** The name for the screen reader, when the visible label is not enough. */
  readonly accessibilityLabel?: string;
}

/** A short choice, 32 high with the touch area of the platform (misure-componenti.md). */
export function Chip({
  label,
  onPress,
  testID,
  selected = false,
  icon,
  badge = 0,
  accessibilityLabel,
}: ChipProps) {
  const { colors, family } = useTheme();
  const shape = SHAPES[family];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      hitSlop={hitSlopFor(CHIP_HEIGHT)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      style={styles.chip}
    >
      {({ pressed }) => {
        const main = selected ? colors.primary : colors.textMuted;
        const stroke = pressed ? pressedColour(main) : main;
        return (
          <>
            <Frame
              shape={shape.chip}
              fill={selected ? stroke : 'transparent'}
              stroke={stroke}
              testID={`${testID}-frame`}
            />
            {icon === undefined ? null : (
              <Icon name={icon} size={16} color={selected ? colors.onPrimary : colors.text} />
            )}
            <ThemedText variant="label" color={selected ? colors.onPrimary : colors.text}>
              {label}
            </ThemedText>
            {badge > 0 ? (
              <View testID={`${testID}-badge`} style={styles.badge}>
                <ThemedText
                  // IM Fell, the Lovecraft titles, has old style figures of different heights.
                  variant={family === 'lovecraft' ? 'numbers' : 'display'}
                  color={BADGE_TEXT}
                  allowFontScaling={false}
                  style={[
                    styles.badgeText,
                    {
                      fontSize:
                        family === 'cyberpunk' ? BADGE_FONT_SIZE_CYBERPUNK : BADGE_FONT_SIZE,
                      transform: [
                        {
                          translateX:
                            badge === 1 ? BADGE_NUDGE[family].xOne : BADGE_NUDGE[family].x,
                        },
                        { translateY: BADGE_NUDGE[family].y },
                      ],
                    },
                  ]}
                >
                  {badge}
                </ThemedText>
              </View>
            ) : null}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: CHIP_HEIGHT,
    paddingHorizontal: 12,
    paddingVertical: 4,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -CHIP_BADGE_OVERLAP,
    right: -CHIP_BADGE_OVERLAP,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: BADGE_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { includeFontPadding: false, fontVariant: [] },
});
