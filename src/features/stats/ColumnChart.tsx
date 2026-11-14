import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';

import { Button } from '@/features/shared/Button';
import { ThemedText } from '@/features/shared/ThemedText';
import { useLargeText } from '@/features/shared/useLargeText';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { ValueList } from './ValueList';

const HEIGHT = 140;
const AXIS_WIDTH = 44;
/** The width before the first layout, and in the tests. */
const DEFAULT_WIDTH = 280;
const MAX_BAR = 24;

export interface ChartColumn {
  readonly key: string;
  /** Under the column; empty for the columns without a label. */
  readonly label: string;
  /** The column in words, e.g. «settimana del 9 novembre». */
  readonly spoken: string;
  /** Null when there is no value: no bar. */
  readonly value: number | null;
  /** The value already written, e.g. «80%» or «1,5 L». */
  readonly text: string;
}

export interface ChartTick {
  readonly value: number;
  readonly text: string;
}

export interface ColumnChartProps {
  readonly testID: string;
  readonly title: string;
  readonly columns: readonly ChartColumn[];
  /** The value at the top of the chart. */
  readonly max: number;
  /** The numbers of the axis (design-sezioni.md 8.5: the charts always have numbered axes). */
  readonly ticks: readonly ChartTick[];
  /** The dashed line of the goal of a measurable mission. */
  readonly goal?: ChartTick;
  /** The text description for the screen reader (8.12). */
  readonly description: string;
  /** A line through the values instead of the columns (design 8.8, the trend of the stats). */
  readonly line?: boolean;
}

/**
 * A column chart (design-sezioni.md 8.5, gap L15), or with `line` a line chart (8.8, T81): columns in the chart colour (`primario`, or the colour-blind scale), dashed goal line in
 * `testoTenue`, axes in `bordo`. A tap on a column writes its exact value under the chart. The
 * screen reader reads the description, and the table of the values opens with a button; with
 * very large text the chart is that table (8.12, A11.1).
 */
export function ColumnChart({
  testID,
  title,
  columns,
  max,
  ticks,
  goal,
  description,
  line = false,
}: ColumnChartProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const largeText = useLargeText();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [selected, setSelected] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const heading = (
    <ThemedText variant="label" accessibilityRole="header" color={colors.textMuted}>
      {title}
    </ThemedText>
  );
  if (largeText) {
    return (
      <View testID={testID} style={styles.chart}>
        {heading}
        <ValueList testID={`${testID}-list`} rows={columns} />
      </View>
    );
  }

  const top = Math.max(max, 1);
  const y = (value: number) => HEIGHT - (Math.min(value, top) / top) * HEIGHT;
  const slot = width / Math.max(columns.length, 1);
  const barWidth = Math.max(2, Math.min(slot * 0.6, MAX_BAR));
  const radius = Math.min(SHAPES[family].bar.radius, barWidth / 2);
  const chosen = selected === null ? undefined : columns[selected];

  return (
    <View testID={testID} style={styles.chart}>
      {heading}
      <View
        testID={`${testID}-graph`}
        accessible
        accessibilityRole="image"
        accessibilityLabel={description}
        style={styles.graph}
      >
        <View style={[styles.axis, { height: HEIGHT }]}>
          {ticks.map((tick) => (
            <ThemedText
              key={tick.value}
              variant="caption"
              color={colors.textMuted}
              numberOfLines={1}
              style={[styles.tick, { top: y(tick.value) - 8 }]}
            >
              {tick.text}
            </ThemedText>
          ))}
        </View>
        <View
          style={styles.plot}
          onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        >
          <Svg width={width} height={HEIGHT}>
            {ticks.map((tick) => (
              <Line
                key={tick.value}
                x1={0}
                x2={width}
                y1={y(tick.value)}
                y2={y(tick.value)}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            {line ? (
              <Polyline
                testID={`${testID}-line`}
                points={columns
                  .map((column, index) =>
                    column.value === null ? null : `${index * slot + slot / 2},${y(column.value)}`,
                  )
                  .filter((point) => point !== null)
                  .join(' ')}
                fill="none"
                stroke={colors.chart}
                strokeWidth={2}
              />
            ) : null}
            {columns.map((column, index) =>
              !line ? null : column.value === null ? null : (
                <Circle
                  key={column.key}
                  testID={`${testID}-point-${column.key}`}
                  cx={index * slot + slot / 2}
                  cy={y(column.value)}
                  r={index === selected ? 6 : 4}
                  fill={index === selected ? colors.xp : colors.chart}
                />
              ),
            )}
            {columns.map((column, index) =>
              line || column.value === null || column.value <= 0 ? null : (
                <Rect
                  key={column.key}
                  testID={`${testID}-bar-${column.key}`}
                  x={index * slot + (slot - barWidth) / 2}
                  y={y(column.value)}
                  width={barWidth}
                  height={HEIGHT - y(column.value)}
                  rx={radius}
                  fill={index === selected ? colors.xp : colors.chart}
                />
              ),
            )}
            {goal === undefined ? null : (
              <Line
                testID={`${testID}-goal`}
                x1={0}
                x2={width}
                y1={y(goal.value)}
                y2={y(goal.value)}
                stroke={colors.textMuted}
                strokeWidth={2}
                strokeDasharray={[6, 4]}
              />
            )}
          </Svg>
          <View style={[StyleSheet.absoluteFill, styles.row]}>
            {columns.map((column, index) => (
              <Pressable
                key={column.key}
                testID={`${testID}-column-${index}`}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                onPress={() => setSelected(index === selected ? null : index)}
                style={styles.slot}
              />
            ))}
          </View>
          <View style={styles.row}>
            {columns.map((column) => (
              <ThemedText
                key={column.key}
                variant="caption"
                color={colors.textMuted}
                numberOfLines={1}
                style={styles.label}
              >
                {column.label}
              </ThemedText>
            ))}
          </View>
        </View>
      </View>
      {chosen === undefined ? null : (
        <ThemedText testID={`${testID}-selected`} accessibilityLiveRegion="polite">
          {t('missionDetail.columnValue', { label: chosen.spoken, value: chosen.text })}
        </ThemedText>
      )}
      <Button
        testID={`${testID}-table`}
        variant="text"
        label={t(table ? 'missionDetail.hideTable' : 'missionDetail.showTable')}
        onPress={() => setTable(!table)}
      />
      {table ? <ValueList testID={`${testID}-list`} rows={columns} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { gap: 8 },
  graph: { flexDirection: 'row', gap: 4 },
  axis: { width: AXIS_WIDTH },
  tick: { position: 'absolute', right: 0, textAlign: 'right' },
  plot: { flex: 1, gap: 4 },
  row: { flexDirection: 'row' },
  slot: { flex: 1 },
  label: { flex: 1, textAlign: 'center' },
});
