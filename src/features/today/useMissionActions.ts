import { useTranslation } from 'react-i18next';
import { uuidv7 } from 'uuidv7';

import {
  completeMission,
  progressMission,
  removeFromDayPlan,
  setDayPlan,
} from '@/db/repositories/completion';
import type { TodayMission } from '@/db/repositories/todayView';
import { undoEvent, UndoRefusedError } from '@/db/repositories/undo';
import { type Point, useCelebration } from '@/features/shared/Celebration';
import { useMomentQueue } from '@/features/shared/MomentQueue';
import { useUndoToast } from '@/features/shared/UndoToast';
import { systemScheduler } from '@/features/notifications/system';
import { DAY_PLAN } from '@/rules/config';
import { runAction } from '@/stores/app';
import { useTheme } from '@/theme/ThemeProvider';

export interface MissionActions {
  /** A touch on the control (US-OGGI-03): a measurable mission adds its increment. */
  readonly complete: (item: TodayMission, origin: Point) => void;
  /** Undoes a completion of today (US-OGGI-04); a refusal is told in words. */
  readonly undo: (eventId: string) => void;
  readonly addToPlan: (item: TodayMission) => void;
  readonly removeFromPlan: (item: TodayMission) => void;
}

/** The actions of the rows of Today, with their celebration, moments and notices. */
export function useMissionActions(): MissionActions {
  const { t } = useTranslation();
  const { family } = useTheme();
  const { celebrate } = useCelebration();
  const { enqueue } = useMomentQueue();
  const toast = useUndoToast();

  const tell = (message: string) => toast.show({ message });

  const undo = (eventId: string) => {
    try {
      runAction((db, clock) => undoEvent(db, eventId, clock));
    } catch (error) {
      if (!(error instanceof UndoRefusedError)) {
        tell(t('today.missions.errors.failed'));
        return;
      }
      const reasons = {
        day_changed: 'dayChanged',
        coins_spent: 'coinsSpent',
        already_undone: 'alreadyUndone',
      } as const;
      tell(t(`today.missions.errors.${reasons[error.reason]}`));
    }
  };

  const complete = (item: TodayMission, origin: Point) => {
    const { mission } = item;
    let result;
    try {
      result = runAction((db, { now, tzOffset }) => {
        const input = {
          missionId: mission.id,
          source: 'app',
          idemKey: `app:${uuidv7()}`,
          now,
          tzOffset,
        } as const;
        return mission.goalType === 'none'
          ? completeMission(db, input)
          : progressMission(db, input);
      });
    } catch {
      tell(t('today.missions.errors.failed'));
      return;
    }
    if (result.cancelledNotificationIds.length > 0) {
      // A reminder left on the phone is only a nuisance: the completion is already saved.
      void systemScheduler.cancel(result.cancelledNotificationIds).catch(() => undefined);
    }
    const { completion } = result;
    if (completion === null) {
      return;
    }
    const values = {
      name: mission.name,
      xp: completion.xp,
      xpTerm: t('lexicon.xp_pl', { context: family }),
      coins: completion.coins,
      coinsTerm: t('lexicon.coins_pl', { context: family }),
    };
    const label = t(
      completion.coins > 0 ? 'today.missions.completedCoins' : 'today.missions.completed',
      values,
    );
    celebrate({
      xp: completion.xp,
      coins: completion.coins,
      origin,
      label: result.bonuses.includes('bonus.plan')
        ? t('today.plan.completedLabel', { label, xp: DAY_PLAN.bonusXp, xpTerm: values.xpTerm })
        : label,
    });
    enqueue(result.moments);
    toast.show({
      message: t('today.missions.doneToast'),
      onUndo: () => undo(completion.eventId),
    });
  };

  const addToPlan = (item: TodayMission) => {
    try {
      runAction((db, clock) => setDayPlan(db, item.mission.id, clock));
    } catch {
      // The menu offers it only to missions outside the plan: a full plan is the refusal left.
      tell(t('today.missions.errors.planFull'));
    }
  };

  const removeFromPlan = (item: TodayMission) => {
    try {
      runAction((db, clock) => removeFromDayPlan(db, item.mission.id, clock));
    } catch {
      tell(t('today.missions.errors.failed'));
    }
  };

  return { complete, undo, addToPlan, removeFromPlan };
}
