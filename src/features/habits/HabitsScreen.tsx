import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { HabitItem, HabitsView } from '@/db/repositories/habitsView';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Chip } from '@/features/shared/Chip';
import { CompanionSprite } from '@/features/shared/CompanionSprite';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { EmptyState } from '@/features/shared/EmptyState';
import { Icon } from '@/features/shared/Icon';
import { MissionRow } from '@/features/shared/MissionRow';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { ThemedText } from '@/features/shared/ThemedText';
import { missionIcon } from '@/features/today/missionText';
import type { GameDay } from '@/rules/types';
import { useTheme } from '@/theme/ThemeProvider';
import { useHabitActions } from './useHabitActions';

const EMPTY_COMPANION_SIZE = 128;

export const HABIT_FILTERS = ['all', 'habits', 'tasks', 'archived'] as const;
export type HabitFilter = (typeof HABIT_FILTERS)[number];

export interface HabitsScreenProps {
  readonly view: HabitsView;
}

/**
 * Habits (design-sezioni.md 3.1, 3.2, 3.7, 3.8): the count of the active missions, the filter
 * chips, the missions by category with collapsible headers, the archive with Restore, the
 * long-press menu and the empty states. Search, pause and reorder come later (T62, T77).
 */
export function HabitsScreen({ view }: HabitsScreenProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const actions = useHabitActions();
  const [filter, setFilter] = useState<HabitFilter>('all');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const { counts, companion } = view;
  const nothing = counts.all === 0 && counts.archived === 0;

  const dayWords = (day: GameDay) => {
    const [, month, dayOfMonth] = day.split('-').map(Number);
    return { day: dayOfMonth, month: t(`shared.frequency.month.${month}`) };
  };

  const detailOf = ({ mission, archivedDay, doneDay }: HabitItem): string => {
    if (archivedDay !== null) {
      return t('habits.archivedOn', dayWords(archivedDay));
    }
    if (doneDay !== null) {
      return t('habits.doneOn', dayWords(doneDay));
    }
    return describeFrequency(mission.frequency, t, mission.dueDay);
  };

  const row = (item: HabitItem) => {
    const { mission } = item;
    const archived = mission.status === 'archived';
    const missionRow = (
      <MissionRow
        testID={`habits-row-${mission.id}`}
        variant="list"
        name={mission.name}
        difficulty={mission.difficulty}
        icon={missionIcon(mission)}
        detail={detailOf(item)}
        streak={mission.streak}
        streakUnit={mission.frequency?.type === 'times_per_week' ? 'weeks' : 'days'}
        completionRate={item.completionRate}
        muted={archived || item.doneDay !== null}
        onPress={() => actions.openDetail(item)}
        onLongPress={() => actions.openMenu(item)}
        actions={actions.rowActions(item)}
      />
    );
    if (!archived) {
      return <View key={mission.id}>{missionRow}</View>;
    }
    return (
      <View key={mission.id} style={styles.archivedRow}>
        <View style={styles.flex}>{missionRow}</View>
        <Button
          variant="text"
          testID={`habits-row-${mission.id}-restore`}
          label={t('habits.restore')}
          accessibilityLabel={t('habits.restoreLabel', { name: mission.name })}
          onPress={() => actions.restore(item)}
        />
      </View>
    );
  };

  const withDividers = (items: readonly HabitItem[]) =>
    items.map((item, index) => (
      <View key={item.mission.id}>
        {index === 0 ? null : <View style={[styles.divider, { backgroundColor: colors.border }]} />}
        {row(item)}
      </View>
    ));

  const categories = view.categories
    .map((category) => ({
      ...category,
      items: category.items.filter(
        ({ mission }) =>
          filter === 'all' ||
          (filter === 'habits' && mission.kind === 'habit') ||
          (filter === 'tasks' && mission.kind === 'task'),
      ),
    }))
    .filter((category) => category.items.length > 0);

  const toggle = (key: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  const list =
    filter === 'archived' ? (
      view.archived.length === 0 ? null : (
        <Card testID="habits-archived">{withDividers(view.archived)}</Card>
      )
    ) : (
      categories.map((category) => {
        const key = category.key ?? 'none';
        const open = !collapsed.has(key);
        const name =
          category.key === null ? t('habits.noCategory') : t(`templateCategories.${category.key}`);
        return (
          <View key={key} testID={`habits-category-${key}`} style={styles.category}>
            <Pressable
              testID={`habits-category-${key}-header`}
              accessibilityRole="button"
              accessibilityLabel={t('habits.categoryLabel', {
                name,
                count: category.items.length,
              })}
              accessibilityState={{ expanded: open }}
              onPress={() => toggle(key)}
              style={styles.categoryHeader}
            >
              <ThemedText
                variant="sectionTitle"
                color={colors.textMuted}
                style={[styles.flex, family === 'minimal' ? styles.upper : null]}
              >
                {name}
              </ThemedText>
              <ThemedText variant="caption" color={colors.textMuted}>
                {String(category.items.length)}
              </ThemedText>
              <Icon name={open ? 'freccia-giu' : 'freccia-su'} size={16} color={colors.textMuted} />
            </Pressable>
            {open ? <Card>{withDividers(category.items)}</Card> : null}
          </View>
        );
      })
    );

  const empty = filter === 'archived' ? view.archived.length === 0 : categories.length === 0;

  return (
    <View testID="habits-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader
        testID="habits-header"
        title={t('lexicon.missions_pl', { context: family })}
        caption={t('habits.active', { count: counts.all })}
      />
      <ScrollView testID="habits-scroll" contentContainerStyle={styles.content}>
        {nothing ? (
          <EmptyState
            testID="habits-empty"
            companion={
              <CompanionSprite
                stage={companion.stage}
                mood={companion.mood}
                size={EMPTY_COMPANION_SIZE}
              />
            }
            message={t('habits.empty.title')}
            actionLabel={t('habits.empty.create')}
            onAction={() => router.push('/editor')}
            // The template library comes with T61: until then the editor opens.
            secondaryActionLabel={t('habits.empty.template')}
            onSecondaryAction={() => router.push('/editor')}
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityLabel={t('habits.filters.label')}
              contentContainerStyle={styles.chips}
            >
              {HABIT_FILTERS.map((key) => (
                <Chip
                  key={key}
                  testID={`habits-filter-${key}`}
                  label={t(`habits.filters.${key}`, { count: counts[key] })}
                  accessibilityLabel={t(`habits.filters.${key}Label`, { count: counts[key] })}
                  selected={filter === key}
                  onPress={() => setFilter(key)}
                />
              ))}
            </ScrollView>
            {empty ? (
              <ThemedText
                testID="habits-filter-empty"
                color={colors.textMuted}
                style={styles.filterEmpty}
              >
                {t(`habits.emptyFilter.${filter}`)}
              </ThemedText>
            ) : (
              list
            )}
          </>
        )}
      </ScrollView>
      {actions.sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 16, paddingHorizontal: 16, paddingBottom: 120 },
  chips: { gap: 8, paddingVertical: 4 },
  category: { gap: 8 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  upper: { textTransform: 'uppercase' },
  divider: { height: StyleSheet.hairlineWidth },
  archivedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filterEmpty: { textAlign: 'center', paddingVertical: 32 },
  flex: { flex: 1 },
});
