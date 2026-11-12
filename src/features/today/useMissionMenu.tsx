import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { TodayMission, TodayView } from '@/db/repositories/todayView';
import { ActionSheet, type ActionSheetItem } from '@/features/shared/ActionSheet';
import { Icon } from '@/features/shared/Icon';
import type { MissionRowAction } from '@/features/shared/MissionRow';
import { canAddToPlan } from '@/rules/day';
import { useTheme } from '@/theme/ThemeProvider';
import { PlanPicker } from './PlanPicker';
import type { MissionActions } from './useMissionActions';

export interface MissionMenu {
  /** The long-press menu of a row of Today. */
  readonly open: (item: TodayMission) => void;
  /** The same items, as actions of the screen reader. */
  readonly rowActions: (item: TodayMission) => MissionRowAction[];
  /** The sheet «Scegli una priorità» (design-sezioni.md 2.3). */
  readonly openPicker: () => void;
  readonly openDetail: (item: TodayMission) => void;
  /** The menu and the picker, to put once in the screen. */
  readonly sheets: ReactNode;
}

/** The menu of the rows of Today, shared by the Plan and the list of the missions. */
export function useMissionMenu(view: TodayView, actions: MissionActions): MissionMenu {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const [menuFor, setMenuFor] = useState<TodayMission | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const openDetail = (item: TodayMission) =>
    router.push({ pathname: '/stats', params: { missionId: item.mission.id } });

  const itemsFor = (item: TodayMission): ActionSheetItem[] => {
    const items: ActionSheetItem[] = [];
    const eventId = item.completionEventId;
    if (eventId !== null) {
      items.push({
        key: 'undo',
        label: t('today.missions.menu.undo'),
        icon: <Icon name="ripristina" size={20} color={colors.text} />,
        onPress: () => actions.undo(eventId),
      });
    }
    if (view.plan.includes(item.mission.id)) {
      items.push({
        key: 'unplan',
        label: t('today.missions.menu.removeFromPlan'),
        icon: <Icon name="chiudi" size={20} color={colors.text} />,
        onPress: () => actions.removeFromPlan(item),
      });
    } else if (item.state === 'todo') {
      // With a full plan the item stays and the picker explains why it cannot add (2.3).
      items.push({
        key: 'plan',
        label: t('today.missions.menu.addToPlan'),
        icon: <Icon name="aggiungi" size={20} color={colors.text} />,
        onPress: () => (canAddToPlan(view.plan) ? actions.addToPlan(item) : setPickerOpen(true)),
      });
    }
    items.push(
      {
        key: 'edit',
        label: t('today.missions.menu.edit'),
        icon: <Icon name="modifica" size={20} color={colors.text} />,
        onPress: () => router.push({ pathname: '/editor', params: { missionId: item.mission.id } }),
      },
      {
        key: 'progress',
        label: t('today.missions.menu.progress'),
        icon: <Icon name="statistiche" size={20} color={colors.text} />,
        onPress: () => openDetail(item),
      },
    );
    return items;
  };

  const rowActions = (item: TodayMission) =>
    itemsFor(item).map(({ key, label, onPress }) => ({ name: key, label, onAction: onPress }));

  const sheets = (
    <>
      <ActionSheet
        testID="today-mission-menu"
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.mission.name}
        items={menuFor === null ? [] : itemsFor(menuFor)}
      />
      <PlanPicker
        view={view}
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onChoose={(item) => {
          setPickerOpen(false);
          actions.addToPlan(item);
        }}
      />
    </>
  );

  return {
    open: setMenuFor,
    rowActions,
    openPicker: () => setPickerOpen(true),
    openDetail,
    sheets,
  };
}
