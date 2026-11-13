import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import type { HeatmapView } from '@/db/repositories/heatmap';
import { Card } from '@/features/shared/Card';
import { ThemedText } from '@/features/shared/ThemedText';
import { HEATMAP } from '@/rules/config';
import { weekSummary, type HeatmapCell } from '@/rules/heatmap';
import type { GameDay } from '@/rules/types';
import { SHAPES } from '@/theme/shapes';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDay } from './format';

const LEVELS = [0, 1, 2, 3] as const;

export interface HeatmapProps {
  readonly view: HeatmapView;
  /** Opens the sheet of a day (8.3). */
  readonly onOpenDay: (day: GameDay) => void;
}

/** The side of a cell that fits about 5 months in `width`, never under the minimum (8.3). */
export function heatmapCellSize(width: number): number {
  const fit = Math.floor((width + HEATMAP.gap) / HEATMAP.visibleWeeks) - HEATMAP.gap;
  return Math.max(HEATMAP.minCell, fit);
}

/**
 * The heatmap of Statistics (design-sezioni.md 8.3, 8.12, mockup B9, D29): a strip of weeks with
 * today on the right, outlined, that scrolls back to 12 months; four colours of the theme and an
 * empty cell for the days with no missions expected. The screen reader reads it by week and
 * reaches every day through the actions of the week.
 */
export function Heatmap({ view, onOpenDay }: HeatmapProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [width, setWidth] = useState(0);
  const cell = heatmapCellSize(width);
  const radius = Math.min(SHAPES[family].bar.radius, cell / 4);

  const spokenDay = (day: GameDay) =>
    formatDay(day, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
  const valueOf = (item: HeatmapCell) =>
    t(`statsScreen.heatmapLevels.${item.level === null ? 'none' : item.level}`);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const look = (item: HeatmapCell) => {
    if (!item.inRange) {
      return { backgroundColor: colors.heatmap[0], borderColor: colors.heatmap[0], opacity: 0.5 };
    }
    if (item.level === null) {
      return { backgroundColor: 'transparent', borderColor: colors.border };
    }
    const fill = colors.heatmap[item.level];
    return { backgroundColor: fill, borderColor: fill };
  };

  return (
    <Card testID="stats-heatmap">
      <View onLayout={onLayout}>
        <ScrollView
          ref={scroll}
          testID="stats-heatmap-scroll"
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
          contentContainerStyle={[styles.strip, { gap: HEATMAP.gap }]}
        >
          {view.weeks.map((week) => {
            const summary = weekSummary(week.cells);
            const reachable = week.cells.filter((item) => item.inRange);
            return (
              <View
                key={week.start}
                testID={`stats-heatmap-week-${week.start}`}
                accessible={summary.days > 0}
                importantForAccessibility={summary.days > 0 ? 'yes' : 'no-hide-descendants'}
                accessibilityLabel={t('statsScreen.heatmapWeek', {
                  day: formatDay(week.start, i18n.language, { day: 'numeric', month: 'long' }),
                  full: summary.full,
                  count: summary.days,
                })}
                accessibilityHint={t('statsScreen.heatmapWeekHint')}
                accessibilityActions={reachable.map((item) => ({
                  name: item.day,
                  label: t('statsScreen.heatmapDay', {
                    day: spokenDay(item.day),
                    value: valueOf(item),
                  }),
                }))}
                onAccessibilityAction={(event) =>
                  onOpenDay(event.nativeEvent.actionName as GameDay)
                }
                style={[styles.week, { gap: HEATMAP.gap }]}
              >
                {week.cells.map((item) => {
                  const today = item.day === view.today;
                  const state = item.inRange ? (item.level === null ? 'empty' : item.level) : 'out';
                  return (
                    <Pressable
                      key={item.day}
                      testID={`stats-heatmap-${item.day}`}
                      disabled={!item.inRange}
                      onPress={() => onOpenDay(item.day)}
                      accessibilityLabel={t('statsScreen.heatmapDay', {
                        day: spokenDay(item.day),
                        value: valueOf(item),
                      })}
                    >
                      <View
                        testID={`stats-heatmap-${item.day}-${state}`}
                        style={[
                          styles.cell,
                          look(item),
                          { width: cell, height: cell, borderRadius: radius },
                          today ? { borderColor: colors.text, borderWidth: 2 } : null,
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.footer}>
          <ThemedText
            testID="stats-heatmap-caption"
            variant="caption"
            color={colors.textMuted}
            style={styles.caption}
          >
            {view.anyDay ? t('statsScreen.heatmapRange') : t('statsScreen.heatmapEmpty')}
          </ThemedText>
          <View
            style={styles.legend}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <ThemedText variant="caption" color={colors.textMuted}>
              {t('statsScreen.heatmapLess')}
            </ThemedText>
            {LEVELS.map((level) => (
              <View
                key={level}
                style={[
                  styles.swatch,
                  { backgroundColor: colors.heatmap[level], borderRadius: radius },
                ]}
              />
            ))}
            <ThemedText variant="caption" color={colors.textMuted}>
              {t('statsScreen.heatmapMore')}
            </ThemedText>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row' },
  week: { flexDirection: 'column' },
  cell: { borderWidth: 1 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  caption: { flexShrink: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 14, height: 14 },
});
