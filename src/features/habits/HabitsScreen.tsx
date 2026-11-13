import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HabitItem, HabitsView } from '@/db/repositories/habitsView';
import { moveMission } from '@/db/repositories/missions';
import { ActionSheet } from '@/features/shared/ActionSheet';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { Chip } from '@/features/shared/Chip';
import { CompanionSprite } from '@/features/shared/CompanionSprite';
import { describeFrequency } from '@/features/shared/describeFrequency';
import { EmptyState } from '@/features/shared/EmptyState';
import { Icon } from '@/features/shared/Icon';
import { MissionRow } from '@/features/shared/MissionRow';
import { ScreenHeader } from '@/features/shared/ScreenHeader';
import { searchable } from '@/features/shared/searchable';
import { SearchField } from '@/features/shared/SearchField';
import { ThemedText } from '@/features/shared/ThemedText';
import { MIN_TOUCH } from '@/features/shared/touch';
import { missionIcon } from '@/features/today/missionText';
import type { MissionRowAction } from '@/features/shared/MissionRow';
import { useUndoToast } from '@/features/shared/UndoToast';
import type { GameDay } from '@/rules/types';
import { runAction } from '@/stores/app';
import { useHabitsUiStore } from '@/stores/habits';
import { useTheme } from '@/theme/ThemeProvider';
import { HABIT_FILTERS } from './filters';
import { HabitSwipe, type SwipeAction } from './HabitSwipe';
import { moveTarget, type ReorderGroup } from './reorder';
import { ReorderRow } from './ReorderRow';
import { useHabitActions } from './useHabitActions';

const EMPTY_COMPANION_SIZE = 128;
const PAUSED_KEY = 'paused';

export interface HabitsScreenProps {
  readonly view: HabitsView;
}

/**
 * Habits (design-sezioni.md 3.1–3.3, 3.6–3.8): the count of the active missions, Search, the filter
 * chips (remembered), the missions by category with collapsible headers, the group «In pausa» at
 * the bottom, the archive with Restore, the long-press menu and the empty states. While searching,
 * the list keeps the active filter and, with «Tutte», shows the archived matches at the bottom; no
 * match offers «Crea “…”». «Altro › Riordina» shows the handles and «Fine» (3.4); the rows slide
 * to pause, archive or edit (3.5).
 */
export function HabitsScreen({ view }: HabitsScreenProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const actions = useHabitActions(view.today);
  const filter = useHabitsUiStore((state) => state.filter);
  const setFilter = useHabitsUiStore((state) => state.setFilter);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const toast = useUndoToast();
  const { counts, companion } = view;
  const nothing = counts.all === 0 && counts.archived === 0;
  const needle = searching ? searchable(query.trim()) : '';
  const matches = ({ mission }: HabitItem) =>
    needle === '' || searchable(mission.name).includes(needle);
  const inFilter = ({ mission }: HabitItem) =>
    filter === 'all' ||
    (filter === 'habits' && mission.kind === 'habit') ||
    (filter === 'tasks' && mission.kind === 'task');

  const dayWords = (day: GameDay) => {
    const [, month, dayOfMonth] = day.split('-').map(Number);
    return { day: dayOfMonth, month: t(`shared.frequency.month.${month}`) };
  };

  const detailOf = ({
    mission,
    archivedDay,
    doneDay,
    paused,
    pausedLastDay,
  }: HabitItem): string => {
    if (paused) {
      return pausedLastDay === null
        ? t('habits.pausedOpen')
        : t('habits.pausedUntil', dayWords(pausedLastDay));
    }
    if (archivedDay !== null) {
      return t('habits.archivedOn', dayWords(archivedDay));
    }
    if (doneDay !== null) {
      return t('habits.doneOn', dayWords(doneDay));
    }
    return describeFrequency(mission.frequency, t, mission.dueDay);
  };

  const groups: ReorderGroup[] = view.categories.map(({ key, items }) => ({
    key,
    ids: items.map((item) => item.mission.id),
  }));
  const categoryName = (key: string | null) =>
    key === null ? t('habits.noCategory') : t(`templateCategories.${key}`);

  const move = (item: HabitItem, steps: number) => {
    const place = moveTarget(groups, item.mission.id, steps);
    if (place === null) {
      return;
    }
    try {
      runAction((db, clock) => moveMission(db, item.mission.id, place, clock));
    } catch {
      toast.show({ message: t('today.missions.errors.failed') });
      return;
    }
    const ids =
      groups
        .find((group) => group.key === place.categoryKey)
        ?.ids.filter((id) => id !== item.mission.id) ?? [];
    const position = place.beforeId === null ? ids.length + 1 : ids.indexOf(place.beforeId) + 1;
    AccessibilityInfo.announceForAccessibility(
      t('habits.reorder.moved', {
        name: item.mission.name,
        category: categoryName(place.categoryKey),
        position,
        count: ids.length + 1,
      }),
    );
  };

  const moveActions = (item: HabitItem): MissionRowAction[] =>
    (
      [
        ['moveUp', -1],
        ['moveDown', 1],
      ] as const
    )
      .filter(([, steps]) => moveTarget(groups, item.mission.id, steps) !== null)
      .map(([name, steps]) => ({
        name,
        label: t(`habits.reorder.${name}`),
        onAction: () => move(item, steps),
      }));

  const swipeActions = (item: HabitItem): SwipeAction[] => {
    const archive: SwipeAction = {
      key: 'archive',
      label: t('habits.swipe.archive'),
      icon: 'archivio',
      color: colors.textMuted,
      onPress: () => actions.archive(item),
    };
    if (item.paused) {
      return [
        {
          key: 'resume',
          label: t('habits.swipe.resume'),
          icon: 'play',
          color: colors.info,
          onPress: () => actions.resume(item),
        },
        archive,
      ];
    }
    // A single task already done has nothing left to pause.
    return item.doneDay !== null
      ? [archive]
      : [
          {
            key: 'pause',
            label: t('habits.swipe.pause'),
            icon: 'pausa',
            color: colors.info,
            onPress: () => actions.askPause(item),
          },
          archive,
        ];
  };

  const row = (item: HabitItem) => {
    const { mission } = item;
    const archived = mission.status === 'archived';
    if (reordering) {
      return (
        <ReorderRow
          key={mission.id}
          testID={`habits-row-${mission.id}-reorder`}
          onDrop={(steps) => move(item, steps)}
          onDragging={setDragging}
        >
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
            muted={item.doneDay !== null}
            actions={moveActions(item)}
          />
        </ReorderRow>
      );
    }
    const missionRow = (
      <MissionRow
        testID={`habits-row-${mission.id}`}
        variant="list"
        name={mission.name}
        difficulty={mission.difficulty}
        icon={item.paused ? 'pausa' : missionIcon(mission)}
        detail={detailOf(item)}
        streak={mission.streak}
        streakUnit={mission.frequency?.type === 'times_per_week' ? 'weeks' : 'days'}
        completionRate={item.completionRate}
        muted={archived || item.doneDay !== null}
        paused={item.paused}
        onPress={() => actions.openDetail(item)}
        onLongPress={() => actions.openMenu(item)}
        actions={actions.rowActions(item)}
      />
    );
    if (!archived) {
      return (
        <HabitSwipe
          key={mission.id}
          testID={`habits-row-${mission.id}-swipe`}
          leftActions={swipeActions(item)}
          onLongSwipe={() => actions.archive(item)}
          onEdit={() => actions.edit(item)}
        >
          <View style={{ backgroundColor: colors.surface }}>{missionRow}</View>
        </HabitSwipe>
      );
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

  // Reorder mode shows every active mission, whatever the filter (PROVISIONAL, T77).
  const categories = reordering
    ? view.categories
    : view.categories
        .map((category) => ({
          ...category,
          items: category.items.filter((item) => inFilter(item) && matches(item)),
        }))
        .filter((category) => category.items.length > 0);
  const paused = reordering ? [] : view.paused.filter((item) => inFilter(item) && matches(item));
  // With «Tutte» the search also looks among the archived missions, shown at the bottom (3.3).
  const archived = reordering
    ? []
    : filter === 'archived' || (filter === 'all' && needle !== '')
      ? view.archived.filter(matches)
      : [];

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

  const group = (key: string, name: string, items: readonly HabitItem[]): ReactNode => {
    const open = reordering || needle !== '' || !collapsed.has(key);
    return (
      <View key={key} testID={`habits-category-${key}`} style={styles.category}>
        <Pressable
          testID={`habits-category-${key}-header`}
          accessibilityRole="button"
          accessibilityLabel={t('habits.categoryLabel', { name, count: items.length })}
          accessibilityState={{ expanded: open }}
          onPress={reordering ? undefined : () => toggle(key)}
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
            {String(items.length)}
          </ThemedText>
          {reordering ? null : (
            <Icon name={open ? 'freccia-giu' : 'freccia-su'} size={16} color={colors.textMuted} />
          )}
        </Pressable>
        {open ? <Card>{withDividers(items)}</Card> : null}
      </View>
    );
  };

  const list =
    filter === 'archived' && !reordering ? (
      archived.length === 0 ? null : (
        <Card testID="habits-archived">{withDividers(archived)}</Card>
      )
    ) : (
      <>
        {categories.map((category) =>
          group(category.key ?? 'none', categoryName(category.key), category.items),
        )}
        {paused.length === 0 ? null : group(PAUSED_KEY, t('habits.pausedGroup'), paused)}
        {archived.length === 0 ? null : (
          <Card testID="habits-archived">{withDividers(archived)}</Card>
        )}
      </>
    );

  const empty = categories.length === 0 && paused.length === 0 && archived.length === 0;
  const typed = query.trim();

  const closeSearch = () => {
    setSearching(false);
    setQuery('');
  };

  const startReorder = () => {
    closeSearch();
    setCollapsed(new Set());
    setReordering(true);
  };

  const noResults = (
    <View testID="habits-search-empty" style={styles.noResults}>
      <ThemedText variant="sectionTitle" style={styles.center}>
        {t('habits.search.noResults', { query: typed })}
      </ThemedText>
      <Button
        testID="habits-search-create"
        label={t('habits.search.create', { name: typed })}
        onPress={() => router.push({ pathname: '/editor', params: { name: typed } })}
      />
    </View>
  );

  return (
    <View testID="habits-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
      {searching ? (
        <View testID="habits-search-bar" style={[styles.searchBar, { paddingTop: top + 8 }]}>
          <SearchField
            testID="habits-search"
            value={query}
            onChangeText={setQuery}
            placeholder={t('habits.search.placeholder')}
            clearLabel={t('habits.search.clear')}
            autoFocus
          />
          <Button
            variant="text"
            testID="habits-search-cancel"
            label={t('habits.search.cancel')}
            onPress={closeSearch}
          />
        </View>
      ) : (
        <ScreenHeader
          testID="habits-header"
          title={t('lexicon.missions_pl', { context: family })}
          caption={t('habits.active', { count: counts.all })}
          actions={
            reordering ? (
              <Button
                variant="text"
                testID="habits-reorder-done"
                label={t('habits.reorder.done')}
                onPress={() => setReordering(false)}
              />
            ) : nothing ? undefined : (
              <View style={styles.headerActions}>
                <Pressable
                  testID="habits-search-open"
                  accessibilityRole="button"
                  accessibilityLabel={t('habits.search.open')}
                  onPress={() => setSearching(true)}
                  style={styles.headerButton}
                >
                  <Icon name="cerca" color={colors.text} />
                </Pressable>
                <Pressable
                  testID="habits-more"
                  accessibilityRole="button"
                  accessibilityLabel={t('habits.more')}
                  onPress={() => setMoreOpen(true)}
                  style={styles.headerButton}
                >
                  <Icon name="altro" color={colors.text} />
                </Pressable>
              </View>
            )
          }
        />
      )}
      <ScrollView
        testID="habits-scroll"
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!dragging}
        contentContainerStyle={styles.content}
      >
        {reordering ? (
          <>
            <ThemedText testID="habits-reorder-hint" color={colors.textMuted}>
              {t('habits.reorder.hint')}
            </ThemedText>
            {list}
          </>
        ) : nothing ? (
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
            secondaryActionLabel={t('habits.empty.template')}
            onSecondaryAction={() => router.push({ pathname: '/editor', params: { library: '1' } })}
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
            {empty && needle !== '' ? (
              noResults
            ) : empty ? (
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
      <ActionSheet
        testID="habits-more-menu"
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={[
          {
            key: 'reorder',
            label: t('habits.reorder.start'),
            icon: <Icon name="trascina" size={20} color={colors.text} />,
            disabled: view.categories.length === 0,
            onPress: startReorder,
          },
        ]}
      />
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
  noResults: { alignItems: 'center', gap: 16, paddingVertical: 32 },
  center: { textAlign: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerActions: { flexDirection: 'row' },
  headerButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
