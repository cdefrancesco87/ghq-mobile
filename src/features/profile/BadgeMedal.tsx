import { StyleSheet, View } from 'react-native';

import { Icon } from '@/features/shared/Icon';
import { Sprite } from '@/features/shared/Sprite';
import { useTheme } from '@/theme/ThemeProvider';

export interface BadgeMedalProps {
  readonly unlocked: boolean;
  readonly size: number;
  /** What the screen reader says; the tile around it usually speaks for it. */
  readonly label: string;
}

/**
 * The shape of a badge (design-sezioni.md 9.6; asset lotto 8): medal, seal or chip of the pixel
 * themes, at whole multiples of its grid; in Minimal a circle with the medal or, while locked, a
 * dashed circle with the padlock (mockup D34A), drawn with the colours of the theme.
 */
export function BadgeMedal({ unlocked, size, label }: BadgeMedalProps) {
  const { colors, family } = useTheme();
  if (family !== 'minimal') {
    return (
      <Sprite
        spriteKey={`badge-${unlocked ? 'sbloccato' : 'bloccato'}-${family}`}
        size={size}
        label={label}
      />
    );
  }
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        unlocked
          ? { backgroundColor: colors.surface }
          : { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border },
      ]}
    >
      <Icon
        name={unlocked ? 'badge' : 'lucchetto'}
        size={size >= 64 ? 24 : 20}
        color={unlocked ? colors.coinsText : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
