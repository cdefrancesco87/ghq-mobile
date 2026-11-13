import { StyleSheet, View } from 'react-native';

import { Frame } from '@/features/shared/Frame';
import { ThemedText } from '@/features/shared/ThemedText';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';

export const EMBLEM_SIZE = 88;

/** The first letter of a name, in capitals («claudio» → «C»). */
export function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? '').toLocaleUpperCase();
}

/**
 * The emblem of the hero with the initial of the name (design-sezioni.md 9.2, choice ★): a circle
 * in Minimal, the frame of the cards of the theme elsewhere (pixel, fillet, cut corners, double
 * rule). The box is ready for a custom portrait in a later version. Decorative: the name is read
 * beside it.
 */
export function Emblem({ name }: { readonly name: string }) {
  const { colors, family } = useTheme();
  const circle = family === 'minimal';
  return (
    <View
      testID="profile-emblem"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.box,
        circle ? { borderRadius: EMBLEM_SIZE / 2, backgroundColor: colors.surfaceHigh } : null,
      ]}
    >
      {circle ? null : (
        <Frame shape={SHAPES[family].card} fill={colors.surfaceHigh} stroke={colors.primary} />
      )}
      <ThemedText variant="display" color={colors.primary} allowFontScaling={false}>
        {initialOf(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: EMBLEM_SIZE,
    height: EMBLEM_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
