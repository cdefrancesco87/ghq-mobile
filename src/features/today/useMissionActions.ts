import { useTranslation } from 'react-i18next';
import { uuidv7 } from 'uuidv7';

import {
  completeMission,
  progressMission,
  removeFromDayPlan,
  setDayPlan,
  skipMission,
  type SkipReason,
} from '@/db/repositories/completion';
import { completeBossStep } from '@/db/repositories/boss';
import type { TodayBoss, TodayMission } from '@/db/repositories/todayView';
import { undoEvent, UndoRefusedError } from '@/db/repositories/undo';
import { type Point, useCelebration } from '@/features/shared/Celebration';
import { useMomentQueue } from '@/features/shared/MomentQueue';
import { useEssential } from '@/features/shared/useGameMode';
import { useUndoToast } from '@/features/shared/UndoToast';
import { systemScheduler } from '@/features/notifications/system';
import { DAY_PLAN } from '@/rules/config';
import { runAction } from '@/stores/app';
import { useTheme } from '@/theme/ThemeProvider';

export interface MissionActions {
  /**
   * A touch on the control (US-OGGI-03): a measurable mission adds its increment, or `amount`
   * when given («Inserisci valore»).
   */
  readonly complete: (item: TodayMission, origin: Point, amount?: number) => void;
  /** Undoes a completion of today (US-OGGI-04); a refusal is told in words. */
  readonly undo: (eventId: string) => void;
  /** «Salta oggi» (US-OGGI-06), with «Annulla» for 5 seconds (design-sezioni.md A7). */
  readonly skip: (item: TodayMission, reason: SkipReason) => void;
  /** Undoes a skip of today; a refusal is told in words. */
  readonly undoSkip: (eventId: string) => void;
  readonly addToPlan: (item: TodayMission) => void;
  readonly removeFromPlan: (item: TodayMission) => void;
  /**
   * Completes a step of a boss, the next one unless another is given (design-sezioni.md 2.4, 5.3),
   * and gives the hit points it took, or null when nothing changed. The step that wins has no
   * «Annulla» (choice 25).
   */
  readonly completeStep: (item: TodayBoss, stepId?: string) => number | null;
}

/** The actions of the rows and the boss cards of Today, with celebration, moments and notices. */
export function useMissionActions(): MissionActions {
  const { t } = useTranslation();
  const { family } = useTheme();
  const { celebrate } = useCelebration();
  const { enqueue } = useMomentQueue();
  const toast = useUndoToast();
  // The Essential mode hides the coins: the completion says only the experience (2.10).
  const essential = useEssential();

  const tell = (message: string) => toast.show({ message });

  const undoOf = (texts: 'missions' | 'skip') => (eventId: string) => {
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
        boss_not_active: 'bossNotActive',
      } as const;
      tell(t(`today.${texts}.errors.${reasons[error.reason]}`));
    }
  };
  const undo = undoOf('missions');
  const undoSkip = undoOf('skip');

  const skip = (item: TodayMission, reason: SkipReason) => {
    let result;
    try {
      result = runAction((db, { now, tzOffset }) =>
        skipMission(db, { missionId: item.mission.id, reason, now, tzOffset }),
      );
    } catch {
      // The sheet offers it only with skips left: the refusal left is a day that changed.
      tell(t('today.missions.errors.failed'));
      return;
    }
    if (result.cancelledNotificationIds.length > 0) {
      void systemScheduler.cancel(result.cancelledNotificationIds).catch(() => undefined);
    }
    enqueue(result.moments);
    const { eventId } = result;
    toast.show({ message: t('today.skip.toast'), onUndo: () => undoSkip(eventId) });
  };

  const complete = (item: TodayMission, origin: Point, amount?: number) => {
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
          : progressMission(db, amount === undefined ? input : { ...input, amount });
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
    const coins = essential ? 0 : completion.coins;
    const values = {
      name: mission.name,
      xp: completion.xp,
      xpTerm: t('lexicon.xp_pl', { context: family }),
      coins,
      coinsTerm: t('lexicon.coins_pl', { context: family }),
    };
    const label = t(
      coins > 0 ? 'today.missions.completedCoins' : 'today.missions.completed',
      values,
    );
    celebrate({
      xp: completion.xp,
      coins,
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

  const completeStep = (item: TodayBoss, stepId = item.nextStep?.id): number | null => {
    if (stepId === undefined) {
      return null;
    }
    let result;
    try {
      result = runAction((db, clock) => completeBossStep(db, stepId, clock));
    } catch {
      tell(t('today.missions.errors.failed'));
      return null;
    }
    enqueue(result.moments);
    if (!result.defeated) {
      const { eventId } = result;
      toast.show({
        message: essential
          ? t('essential.stepToast')
          : t('bosses.today.stepToast', { damage: result.dealt }),
        onUndo: () => undo(eventId),
      });
    }
    return result.dealt;
  };

  return { complete, undo, skip, undoSkip, addToPlan, removeFromPlan, completeStep };
}
