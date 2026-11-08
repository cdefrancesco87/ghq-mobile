import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { Frame } from './Frame';

export interface CardProps {
  readonly children: ReactNode;
  /** `high` is the surface of sheets and dialogs. */
  readonly surface?: 'normal' | 'high';
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

/** A surface with the border of the theme and the inner space of 16 (design-sezioni.md A2, A6). */
export function Card({ children, surface = 'normal', style, testID }: CardProps) {
  const { colors, family } = useTheme();
  const shape = SHAPES[family];
  return (
    <View testID={testID} style={[{ padding: 16 }, style]}>
      <Frame
        shape={shape.card}
        fill={surface === 'high' ? colors.surfaceHigh : colors.surface}
        stroke={colors.border}
        testID={testID === undefined ? undefined : `${testID}-frame`}
      />
      {children}
    </View>
  );
}
