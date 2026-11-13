import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { TodayMission, TodayView } from '@/db/repositories/todayView';
import { ActionSheet, type ActionSheetItem } from '@/features/shared/ActionSheet';
import { Icon } from '@/features/shared/Icon';
import type { MissionRowAction } from '@/features/shared/MissionRow';
import { SHEET_DURATION_MS } from '@/features/shared/Sheet';
import { canAddToPlan } from '@/rules/day';
import { useTheme } from '@/theme/ThemeProvider';
import { PlanPicker } from './PlanPicker';
import { SkipSheet } from './SkipSheet';
import type { MissionActions } from './useMissionActions';
import { ValueSheet } from './ValueSheet';

export interface MissionMenu {
  /** The long-press menu of a row of Today. */
  readonly open: (item: TodayMission) => void;
  /** The same items, as actions of the screen reader. */
  readonly rowActions: (item: TodayMission) => MissionRowAction[];
  /** The sheet «Scegli una priorità» (design-sezioni.md 2.3). */
  readonly openPicker: () => void;
  /** The sheet «Salta oggi» with the reasons (design-sezioni.md 2.5), e.g. from the swipe. */
  readonly openSkip: (item: TodayMission) => void;
  /** «Inserisci valore» of a measurable mission (design-sezioni.md 2.5). */
  readonly openValue: (item: TodayMission) => void;
  readonly openDetail: (item: TodayMission) => void;
  /** The menu and the picker, to put once in the screen. */
  readonly sheets: ReactNode;
}

/** The menu of the rows of Today, shared by the Plan and the list of the missions. */
export function useMissionMenu(view: TodayView, actions: MissionActions): MissionMenu {
  const { t } = useTranslation();
  const { colors, family } = useTheme();
  const router = useRouter();
  const [menuFor, setMenuFor] = useState<TodayMission | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [skipFor, setSkipFor] = useState<TodayMission | null>(null);
  const [valueFor, setValueFor] = useState<TodayMission | null>(null);
  // The sheets asked from the menu wait for the menu to slide away: on iOS a modal shown while
  // another one is still closing may never appear.
  const [queued, setQueued] = useState<
    { sheet: 'picker' } | { sheet: 'skip' | 'value'; item: TodayMission } | null
  >(null);

  useEffect(() => {
    if (queued === null || menuFor !== null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setQueued(null);
      if (queued.sheet === 'picker') {
        setPickerOpen(true);
      } else if (queued.sheet === 'value') {
        setValueFor(queued.item);
      } else {
        setSkipFor(queued.item);
      }
    }, SHEET_DURATION_MS);
    return () => clearTimeout(timer);
  }, [queued, menuFor]);

  const openDetail = (item: TodayMission) =>
    router.push({ pathname: '/stats', params: { missionId: item.mission.id } });

  const itemsFor = (item: TodayMission): ActionSheetItem[] => {
    const items: ActionSheetItem[] = [];
    if (item.state === 'todo' && item.mission.goalType === 'quantity') {
      items.push({
        key: 'value',
        label: t('today.missions.menu.enterValue'),
        icon: <Icon name="aggiungi" size={20} color={colors.text} />,
        onPress: () => setQueued({ sheet: 'value', item }),
      });
    }
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
        onPress: () =>
          canAddToPlan(view.plan) ? actions.addToPlan(item) : setQueued({ sheet: 'picker' }),
      });
    }
    if (item.state === 'todo') {
      // With no skips left the sheet still opens and says why (US-OGGI-06).
      items.push({
        key: 'skip',
        label: t('lexicon.skipToday', { context: family }),
        icon: <Icon name="salta" size={20} color={colors.text} />,
        onPress: () => setQueued({ sheet: 'skip', item }),
      });
    }
    const skipEventId = item.skipEventId;
    if (skipEventId !== null) {
      items.push({
        key: 'unskip',
        label: t('today.skip.undo'),
        icon: <Icon name="ripristina" size={20} color={colors.text} />,
        onPress: () => actions.undoSkip(skipEventId),
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

  // The screen reader has no menu to close: its «Salta oggi» opens the sheet at once.
  const rowActions = (item: TodayMission) =>
    itemsFor(item).map(({ key, label, onPress }) => ({
      name: key,
      label,
      onAction:
        key === 'skip'
          ? () => setSkipFor(item)
          : key === 'value'
            ? () => setValueFor(item)
            : onPress,
    }));

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
      <SkipSheet
        item={skipFor}
        onClose={() => setSkipFor(null)}
        onSkip={(item, reason) => {
          setSkipFor(null);
          actions.skip(item, reason);
        }}
      />
      <ValueSheet
        item={valueFor}
        onClose={() => setValueFor(null)}
        onAdd={(item, amount) => {
          setValueFor(null);
          actions.complete(item, { x: 0, y: 0 }, amount);
        }}
      />
    </>
  );

  return {
    open: setMenuFor,
    rowActions,
    openPicker: () => setPickerOpen(true),
    openSkip: setSkipFor,
    openValue: setValueFor,
    openDetail,
    sheets,
  };
}
