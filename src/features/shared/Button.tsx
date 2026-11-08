import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { pressedColour } from '@/theme/contrast';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors } from '@/theme/themes';
import { Frame } from './Frame';
import { ThemedText } from './ThemedText';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'destructive';

export const BUTTON_HEIGHT = 48;

const TRANSPARENT = 'transparent';

export interface ButtonColors {
  readonly fill: string;
  readonly stroke: string;
  readonly label: string;
}

/**
 * The colours of a button (misure-componenti.md, correction 5): pressed is the same colour darkened
 * by 18%, disabled is `track` with `textMuted`. The destructive fill uses `dangerText`, the danger
 * role that keeps `onPrimary` above 4.5:1 in every theme.
 */
export function buttonColors(
  colors: ThemeColors,
  variant: ButtonVariant,
  { pressed = false, disabled = false }: { pressed?: boolean; disabled?: boolean } = {},
): ButtonColors {
  if (disabled) {
    return { fill: colors.track, stroke: colors.track, label: colors.textMuted };
  }
  const state = (colour: string) => (pressed ? pressedColour(colour) : colour);
  switch (variant) {
    case 'primary':
      return {
        fill: state(colors.primary),
        stroke: state(colors.primary),
        label: colors.onPrimary,
      };
    case 'destructive':
      return {
        fill: state(colors.dangerText),
        stroke: state(colors.dangerText),
        label: colors.onPrimary,
      };
    case 'secondary':
      return { fill: TRANSPARENT, stroke: state(colors.textMuted), label: state(colors.text) };
    case 'text':
      return { fill: TRANSPARENT, stroke: TRANSPARENT, label: state(colors.primary) };
  }
}

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  /** Why the button is disabled: read by the screen reader. */
  readonly disabledReason?: string;
  /** The name for the screen reader, when the visible label is not enough. */
  readonly accessibilityLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
}

/** Primary, secondary, text-only or destructive button, at least 48 high (A6). */
export function Button({
  label,
  onPress,
  testID,
  variant = 'primary',
  disabled = false,
  disabledReason,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const { colors, family } = useTheme();
  const shape = SHAPES[family];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={disabled ? disabledReason : undefined}
      accessibilityState={{ disabled }}
      style={[styles.button, style]}
    >
      {({ pressed }) => {
        const palette = buttonColors(colors, variant, { pressed, disabled });
        return (
          <>
            <Frame shape={shape.control} fill={palette.fill} stroke={palette.stroke} />
            <ThemedText variant="label" color={palette.label} style={styles.label}>
              {label}
            </ThemedText>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: BUTTON_HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
