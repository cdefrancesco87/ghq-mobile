import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TodayView } from '@/db/repositories/todayView';
import { Card } from '@/features/shared/Card';
import { Icon } from '@/features/shared/Icon';
import { MissionRow } from '@/features/shared/MissionRow';
import { ThemedText } from '@/features/shared/ThemedText';
import { useTheme } from '@/theme/ThemeProvider';
import { missionIcon, originOf, useMissionTexts } from './missionText';
import type { MissionActions } from './useMissionActions';
import type { MissionMenu } from './useMissionMenu';

export interface TodayMissionsProps {
  readonly view: TodayView;
  /** Minutes east of UTC, for the times of completion. */
  readonly tzOffset: number;
  readonly actions: MissionActions;
  readonly menu: MissionMenu;
}

/**
 * «Missioni di oggi» (design-sezioni.md 2.5, 2.6): the missions to do, then the group of the
 * done ones, open by default. A touch on the control completes, a long press opens the menu, a
 * touch on the name opens the detail of the mission. The priorities are only in the Plan (2.3),
 * but the counter counts them.
 */
export function TodayMissions({ view, tzOffset, actions, menu }: TodayMissionsProps) {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const { detailOf, warningOf, doneTimeOf } = useMissionTexts(view.day, tzOffset);
  const [doneOpen, setDoneOpen] = useState(true);

  const listed = view.missions.filter((item) => !view.plan.includes(item.mission.id));
  const todo = listed.filter((item) => item.state === 'todo');
  const done = listed.filter((item) => item.state === 'done');

  const separator = <View style={[styles.separator, { backgroundColor: colors.border }]} />;

  return (
    <View testID="today-missions" style={styles.section}>
      <View style={styles.heading}>
        <ThemedText variant="sectionTitle" accessibilityRole="header" style={styles.flex}>
          {t('today.missions.title', { term: t('lexicon.missions_pl', { context: family }) })}
        </ThemedText>
        {/* The ring of the header already says it to the screen reader. */}
        <ThemedText
          testID="today-missions-count"
          variant="caption"
          color={colors.textMuted}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {t('today.progress', { done: view.doneCount, total: view.totalCount })}
        </ThemedText>
      </View>
      {todo.length === 0 ? null : (
        <Card>
          {todo.map((item, index) => {
            const { mission } = item;
            const target = mission.goalTarget;
            const measurable = mission.goalType !== 'none' && target !== null && target > 0;
            return (
              <Fragment key={mission.id}>
                {index === 0 ? null : separator}
                <MissionRow
                  testID={`today-mission-${mission.id}`}
                  variant="today"
                  icon={missionIcon(mission)}
                  name={mission.name}
                  difficulty={mission.difficulty}
                  detail={detailOf(item)}
                  warning={warningOf(item)}
                  xp={item.xp}
                  progress={measurable ? Math.min((item.value ?? 0) / target, 1) : undefined}
                  onComplete={(event) => actions.complete(item, originOf(event))}
                  onPress={() => menu.openDetail(item)}
                  onLongPress={() => menu.open(item)}
                  actions={menu.rowActions(item)}
                />
              </Fragment>
            );
          })}
        </Card>
      )}
      {done.length === 0 ? null : (
        <>
          <Pressable
            testID="today-done-toggle"
            accessibilityRole="button"
            accessibilityState={{ expanded: doneOpen }}
            onPress={() => setDoneOpen((open) => !open)}
            style={styles.toggle}
          >
            <ThemedText variant="label" color={colors.textMuted} style={styles.flex}>
              {t('today.missions.doneGroup', { count: done.length })}
            </ThemedText>
            <Icon
              name={doneOpen ? 'freccia-su' : 'freccia-giu'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
          {doneOpen ? (
            <Card testID="today-done">
              {done.map((item, index) => (
                <Fragment key={item.mission.id}>
                  {index === 0 ? null : separator}
                  <MissionRow
                    testID={`today-mission-${item.mission.id}`}
                    variant="done"
                    icon={missionIcon(item.mission)}
                    name={item.mission.name}
                    difficulty={item.mission.difficulty}
                    detail={detailOf(item)}
                    doneTime={doneTimeOf(item)}
                    onPress={() => menu.openDetail(item)}
                    onLongPress={() => menu.open(item)}
                    actions={menu.rowActions(item)}
                  />
                </Fragment>
              ))}
            </Card>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
});
