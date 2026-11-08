import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { Difficulty as DifficultyLevel } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeFamily } from '@/theme/themes';
import { ThemedText } from './ThemedText';

const NOTCHES: Readonly<Record<DifficultyLevel, number>> = { easy: 1, medium: 2, hard: 3 };
const TOTAL_NOTCHES = 3;
const NOTCH_SIZE = 12;

/** The shapes of `docs/mockup/asset/lotto1/tacche/` (tacca-<theme>-piena and -vuota). */
function notchShape(family: ThemeFamily, full: boolean, color: string) {
  switch (family) {
    case 'minimal':
      return full ? (
        <Circle cx={6} cy={6} r={3.5} fill={color} />
      ) : (
        <Circle cx={6} cy={6} r={3} fill="none" stroke={color} strokeWidth={1.25} />
      );
    case 'arcade':
      return full ? (
        <Rect x={2} y={2} width={8} height={8} fill={color} />
      ) : (
        <>
          <Rect x={2} y={2} width={8} height={1} fill={color} />
          <Rect x={2} y={9} width={8} height={1} fill={color} />
          <Rect x={2} y={3} width={1} height={6} fill={color} />
          <Rect x={9} y={3} width={1} height={6} fill={color} />
        </>
      );
    case 'fantasy':
      return (
        <>
          {full ? (
            <Path d="M6 .5l1.9 2v5.9H4.1V2.5z" fill={color} />
          ) : (
            <Path
              d="M6 1.1l1.45 1.6v5.3h-2.9V2.7z"
              fill="none"
              stroke={color}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          )}
          <Path
            d="M3 8.6h6M6 8.6v1.8"
            stroke={color}
            strokeWidth={1.2}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={6} cy={11} r={0.9} fill={color} />
        </>
      );
    case 'cyberpunk':
      return full ? (
        <Path d="M4 1h4v10H4z" fill={color} />
      ) : (
        <Path d="M4.5 1.5h3v9h-3z" fill="none" stroke={color} strokeWidth={1} />
      );
    case 'lovecraft':
      return (
        <>
          <Circle cx={6} cy={6} r={4.5} fill="none" stroke={color} strokeWidth={1.25} />
          {full ? <Circle cx={6} cy={6} r={2.2} fill={color} /> : null}
        </>
      );
  }
}

export interface DifficultyProps {
  readonly difficulty: DifficultyLevel;
  /** Writes the word beside the notches; the screen reader always reads it. */
  readonly showWord?: boolean;
  readonly testID?: string;
}

/** From 1 to 3 notches in the shape of the theme, plus the word (design-sezioni.md A6). */
export function Difficulty({ difficulty, showWord = true, testID }: DifficultyProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const word = t(`shared.difficulty.${difficulty}`);
  return (
    <View testID={testID} accessible accessibilityLabel={word} style={styles.row}>
      <View style={styles.notches}>
        {Array.from({ length: TOTAL_NOTCHES }, (_, index) => {
          const full = index < NOTCHES[difficulty];
          return (
            <View key={index} testID={full ? 'notch-full' : 'notch-empty'}>
              <Svg
                width={NOTCH_SIZE}
                height={NOTCH_SIZE}
                viewBox={`0 0 ${NOTCH_SIZE} ${NOTCH_SIZE}`}
              >
                {notchShape(family, full, colors.primary)}
              </Svg>
            </View>
          );
        })}
      </View>
      {showWord ? <ThemedText variant="label">{word}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notches: { flexDirection: 'row', gap: 2 },
});
