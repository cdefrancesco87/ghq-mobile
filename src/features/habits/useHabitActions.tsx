import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { HabitItem } from '@/db/repositories/habitsView';
import {
  archiveMission,
  deleteMission,
  pauseMission,
  restoreMission,
  resumeMission,
} from '@/db/repositories/missions';
import { systemScheduler } from '@/features/notifications/system';
import { ActionSheet, type ActionSheetItem } from '@/features/shared/ActionSheet';
import { ConfirmDialog } from '@/features/shared/ConfirmDialog';
import { Icon } from '@/features/shared/Icon';
import type { MissionRowAction } from '@/features/shared/MissionRow';
import { SHEET_DURATION_MS } from '@/features/shared/Sheet';
import { useUndoToast } from '@/features/shared/UndoToast';
import { pauseUntil, type PauseChoice } from '@/rules/pause';
import type { GameDay } from '@/rules/types';
import { runAction } from '@/stores/app';
import { useTheme } from '@/theme/ThemeProvider';
import { PauseSheet } from './PauseSheet';

export interface HabitActions {
  /** The long-press menu of a row (design-sezioni.md 3.2). */
  readonly openMenu: (item: HabitItem) => void;
  /** The same items, as actions of the screen reader (3.11). */
  readonly rowActions: (item: HabitItem) => MissionRowAction[];
  readonly openDetail: (item: HabitItem) => void;
  readonly restore: (item: HabitItem) => void;
  /** The menu and the dialog, to put once in the screen. */
  readonly sheets: ReactNode;
}

type Queued = { readonly kind: 'delete' | 'pause'; readonly item: HabitItem };

/** Edit, pause, resume, archive, restore and delete from Habits (design-sezioni.md 3.2, 3.6, 3.7). */
export function useHabitActions(today: GameDay): HabitActions {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useUndoToast();
  const [menuFor, setMenuFor] = useState<HabitItem | null>(null);
  const [deleteFor, setDeleteFor] = useState<HabitItem | null>(null);
  const [pauseFor, setPauseFor] = useState<HabitItem | null>(null);
  // The dialog and the sheet asked from the menu wait for the menu to slide away: on iOS a modal
  // shown while another one is still closing may never appear (as in useMissionMenu).
  const [queued, setQueued] = useState<Queued | null>(null);

  useEffect(() => {
    if (queued === null || menuFor !== null) {
      return undefined;
    }
    const timer = setTimeout(() => {
      (queued.kind === 'delete' ? setDeleteFor : setPauseFor)(queued.item);
      setQueued(null);
    }, SHEET_DURATION_MS);
    return () => clearTimeout(timer);
  }, [queued, menuFor]);

  const failed = () => toast.show({ message: t('today.missions.errors.failed') });

  const openDetail = (item: HabitItem) =>
    router.push({ pathname: '/stats', params: { missionId: item.mission.id } });

  const restore = (item: HabitItem) => {
    try {
      runAction((db, clock) => restoreMission(db, item.mission.id, clock));
    } catch {
      failed();
      return;
    }
    toast.show({ message: t('habits.restored') });
  };

  const archive = (item: HabitItem) => {
    try {
      runAction((db, clock) => archiveMission(db, item.mission.id, clock));
    } catch {
      failed();
      return;
    }
    toast.show({
      message: t('habits.archivedToast'),
      onUndo: () => {
        try {
          runAction((db, clock) => restoreMission(db, item.mission.id, clock));
        } catch {
          failed();
        }
      },
    });
  };

  const pause = (item: HabitItem, choice: PauseChoice) => {
    setPauseFor(null);
    try {
      runAction((db, clock) => pauseMission(db, item.mission.id, pauseUntil(today, choice), clock));
    } catch {
      failed();
      return;
    }
    toast.show({ message: t('habits.pausedToast') });
  };

  const resume = (item: HabitItem) => {
    try {
      runAction((db, clock) => resumeMission(db, item.mission.id, clock));
    } catch {
      failed();
      return;
    }
    toast.show({ message: t('habits.resumedToast') });
  };

  const remove = (item: HabitItem) => {
    setDeleteFor(null);
    let cancelled: string[];
    try {
      cancelled = runAction((db, clock) =>
        deleteMission(db, item.mission.id, clock),
      ).cancelledNotificationIds;
    } catch {
      failed();
      return;
    }
    if (cancelled.length > 0) {
      void systemScheduler.cancel(cancelled).catch(() => undefined);
    }
  };

  const itemsFor = (item: HabitItem): ActionSheetItem[] => {
    const archived = item.mission.status === 'archived';
    const icon = (
      name: 'modifica' | 'archivio' | 'ripristina' | 'elimina' | 'pausa' | 'play',
      color = colors.text,
    ) => <Icon name={name} size={20} color={color} />;
    const restoreItem: ActionSheetItem = {
      key: 'restore',
      label: t('habits.menu.restore'),
      icon: icon('ripristina'),
      onPress: () => restore(item),
    };
    const edit: ActionSheetItem = {
      key: 'edit',
      label: t('habits.menu.edit'),
      icon: icon('modifica'),
      onPress: () => router.push({ pathname: '/editor', params: { missionId: item.mission.id } }),
    };
    const archiveItem: ActionSheetItem = {
      key: 'archive',
      label: t('habits.menu.archive'),
      icon: icon('archivio'),
      onPress: () => archive(item),
    };
    const deleteItem: ActionSheetItem = {
      key: 'delete',
      label: t('habits.menu.delete'),
      icon: icon('elimina', colors.dangerText),
      destructive: true,
      onPress: () => setQueued({ kind: 'delete', item }),
    };
    if (archived) {
      return [restoreItem, edit, deleteItem];
    }
    if (item.paused) {
      // «Riprendi» comes first in the menu of a paused mission (design-sezioni.md 3.6).
      const resumeItem: ActionSheetItem = {
        key: 'resume',
        label: t('habits.menu.resume'),
        icon: icon('play'),
        onPress: () => resume(item),
      };
      return [resumeItem, edit, archiveItem, deleteItem];
    }
    // A single task already done has nothing left to pause.
    const pauseItem: ActionSheetItem | null =
      item.doneDay === null
        ? {
            key: 'pause',
            label: t('habits.menu.pause'),
            icon: icon('pausa'),
            onPress: () => setQueued({ kind: 'pause', item }),
          }
        : null;
    return pauseItem === null
      ? [edit, archiveItem, deleteItem]
      : [edit, pauseItem, archiveItem, deleteItem];
  };

  const rowActions = (item: HabitItem) =>
    itemsFor(item).map(({ key, label, onPress }) => ({ name: key, label, onAction: onPress }));

  const sheets = (
    <>
      <ActionSheet
        testID="habits-menu"
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.mission.name}
        items={menuFor === null ? [] : itemsFor(menuFor)}
      />
      <PauseSheet
        visible={pauseFor !== null}
        name={pauseFor?.mission.name ?? ''}
        today={today}
        onClose={() => setPauseFor(null)}
        onPause={(choice) => {
          if (pauseFor !== null) {
            pause(pauseFor, choice);
          }
        }}
      />
      <ConfirmDialog
        testID="habits-delete"
        visible={deleteFor !== null}
        title={t('habits.delete.title', { name: deleteFor?.mission.name ?? '' })}
        message={t('habits.delete.message')}
        confirmLabel={t('habits.delete.confirm')}
        onCancel={() => setDeleteFor(null)}
        onConfirm={() => {
          if (deleteFor !== null) {
            remove(deleteFor);
          }
        }}
        {...(deleteFor !== null && deleteFor.mission.status !== 'archived'
          ? {
              alternativeLabel: t('habits.delete.archiveInstead'),
              onAlternative: () => {
                setDeleteFor(null);
                archive(deleteFor);
              },
            }
          : {})}
      />
    </>
  );

  return { openMenu: setMenuFor, rowActions, openDetail, restore, sheets };
}
