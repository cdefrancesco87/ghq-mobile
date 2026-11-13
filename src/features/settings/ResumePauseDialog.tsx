import { useTranslation } from 'react-i18next';

import { resumePause } from '@/db/repositories/pause';
import type { TodayPause } from '@/db/repositories/todayView';
import { announceOnIos } from '@/features/shared/announce';
import { ConfirmDialog } from '@/features/shared/ConfirmDialog';
import { useEssential } from '@/features/shared/useGameMode';
import { runAction } from '@/stores/app';

export interface ResumePauseDialogProps {
  readonly visible: boolean;
  /** The pause that holds today; nothing is shown without one. */
  readonly pause: TodayPause | null;
  /** After «Riprendi» or «Annulla». */
  readonly onClose: () => void;
  readonly testID?: string;
}

/**
 * «Riprendi» (design-sezioni.md 2.8, 10.5): the dialog says that the pause ends today, that
 * everything counts again from tomorrow and, with bosses whose deadline the pause holds, by how
 * many days their deadlines move. The same dialog in Today and in the Settings.
 */
export function ResumePauseDialog({
  visible,
  pause,
  onClose,
  testID = 'pause-resume-dialog',
}: ResumePauseDialogProps) {
  const { t } = useTranslation();
  const essential = useEssential();
  if (pause === null) {
    return null;
  }
  const message = [
    t('pause.dialog.body'),
    pause.heldBosses === 0
      ? null
      : t('pause.dialog.bosses', {
          count: pause.resumeDays,
          context: essential ? 'essential' : undefined,
        }),
  ]
    .filter((part) => part !== null)
    .join(' ');
  return (
    <ConfirmDialog
      testID={testID}
      visible={visible}
      title={t('pause.dialog.title')}
      message={message}
      confirmLabel={t('pause.dialog.confirm')}
      confirmVariant="primary"
      onConfirm={() => {
        runAction((db, clock) => resumePause(db, clock));
        announceOnIos(t('pause.dialog.done'));
        onClose();
      }}
      onCancel={onClose}
    />
  );
}
