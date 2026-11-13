import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeColors, ThemeFamily } from '@/theme/themes';
import { cutFramePath } from './Frame';
import { ProgressRing, ringStroke } from './ProgressRing';
import { ThemedText } from './ThemedText';

export const COMPLETION_CONTROL_SIZE = 48;

const GLYPH_SIZE = 28;
const GLYPH_CENTER = GLYPH_SIZE / 2;
const GLYPH_CUT = 6;
const RING_SIZE = 40;
const CHECK = 'M8 14.5l4 4 8-9';
/** Play and pause of the timer (L29: not among the icons yet, a triangle and two bars). */
const PLAY = 'M9 6.5v15l13-7.5z';
const PAUSE = 'M8.5 7h4v14h-4zM15.5 7h4v14h-4z';
export const STAR = 'M14 1.5l3.7 8 8.8 1-6.5 6 1.7 8.6-7.7-4.3-7.7 4.3 1.7-8.6-6.5-6 8.8-1z';

function checkMark(color: string) {
  return <Path d={CHECK} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />;
}

/** The empty box of the theme: dashed in Lovecraft, with the corners cut in Cyberpunk. */
export function emptyGlyph(family: ThemeFamily, color: string) {
  const line = { fill: 'none', stroke: color };
  switch (family) {
    case 'arcade':
      return <Path d="M1.5 1.5H26.5V26.5H1.5Z" strokeWidth={3} {...line} />;
    case 'cyberpunk':
      return (
        <Path d={cutFramePath(GLYPH_SIZE, GLYPH_SIZE, GLYPH_CUT, 1)} strokeWidth={1} {...line} />
      );
    case 'lovecraft':
      return (
        <Circle
          cx={GLYPH_CENTER}
          cy={GLYPH_CENTER}
          r={13}
          strokeWidth={1.25}
          strokeDasharray={[3, 3]}
          {...line}
        />
      );
    case 'minimal':
    case 'fantasy':
      return <Circle cx={GLYPH_CENTER} cy={GLYPH_CENTER} r={13} strokeWidth={1.5} {...line} />;
  }
}

/** The sign of a done mission: a wax seal in Fantasy, a star seal in Lovecraft (temi.json). */
export function doneGlyph(family: ThemeFamily, colors: ThemeColors) {
  switch (family) {
    case 'arcade':
      return (
        <>
          <Path d="M0 0H28V28H0Z" fill={colors.done} />
          {checkMark(colors.background)}
        </>
      );
    case 'minimal':
      return (
        <>
          <Circle cx={GLYPH_CENTER} cy={GLYPH_CENTER} r={14} fill={colors.done} />
          {checkMark(colors.surface)}
        </>
      );
    case 'fantasy':
      return (
        <>
          <Circle cx={GLYPH_CENTER} cy={GLYPH_CENTER} r={14} fill={colors.primary} />
          {checkMark(colors.onPrimary)}
        </>
      );
    case 'cyberpunk':
      return (
        <>
          <Path d={cutFramePath(GLYPH_SIZE, GLYPH_SIZE, GLYPH_CUT, 0)} fill={colors.done} />
          {checkMark(colors.background)}
        </>
      );
    case 'lovecraft':
      return <Path d={STAR} fill={colors.done} />;
  }
}

export function Glyph({ children }: { readonly children: ReactNode }) {
  return (
    <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`}>
      {children}
    </Svg>
  );
}

/** The sign of a done mission, which is not a button: it is undone from the menu of the row (2.6). */
export function DoneMark({ testID }: { readonly testID?: string }) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.control}
    >
      {family === 'arcade' ? (
        <ThemedText variant="numbers" color={colors.doneText} numberOfLines={1}>
          {t('shared.missionRow.cleared')}
        </ThemedText>
      ) : (
        <Glyph>{doneGlyph(family, colors)}</Glyph>
      )}
    </View>
  );
}

export interface CompletionControlProps {
  readonly testID: string;
  /** The whole mission, with state and action: this is what the screen reader stops on. */
  readonly accessibilityLabel: string;
  /** The event gives where the touch was, for the celebration. */
  readonly onPress: (event: GestureResponderEvent) => void;
  readonly onLongPress?: () => void;
  /** Progress of a measurable mission, from 0 to 1: a ring instead of the empty box. */
  readonly progress?: number;
  /** Writes the percentage inside the ring. */
  readonly showPercentage?: boolean;
  /** A duration mission (T79): the play of its timer, or the pause while it runs. */
  readonly timer?: 'play' | 'pause';
  readonly accessibilityActions?: readonly AccessibilityActionInfo[];
  readonly onAccessibilityAction?: (event: AccessibilityActionEvent) => void;
}

/** The control that completes a mission: 48×48 with a sign of 28 (misure-componenti.md). */
export function CompletionControl({
  testID,
  accessibilityLabel,
  onPress,
  onLongPress,
  progress,
  showPercentage = true,
  timer,
  accessibilityActions,
  onAccessibilityAction,
}: CompletionControlProps) {
  const { colors, family } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      style={styles.control}
    >
      {timer !== undefined ? (
        <View testID={`${testID}-${timer}`}>
          <Glyph>
            <Path d={timer === 'play' ? PLAY : PAUSE} fill={colors.primary} />
          </Glyph>
        </View>
      ) : progress === undefined ? (
        <Glyph>{emptyGlyph(family, colors.textMuted)}</Glyph>
      ) : (
        <>
          <ProgressRing
            testID={`${testID}-ring`}
            progress={progress}
            size={RING_SIZE}
            strokeWidth={ringStroke(family)}
          />
          {showPercentage ? (
            <View style={styles.percentage}>
              <ThemedText variant="caption" numberOfLines={1}>
                {`${Math.min(Math.floor(progress * 100), 100)}%`}
              </ThemedText>
            </View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    minWidth: COMPLETION_CONTROL_SIZE,
    minHeight: COMPLETION_CONTROL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentage: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
