import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { Boss } from '@/db/repositories/boss';
import type { Db } from '@/db/types';
import { useBossTexts } from '@/features/bosses/bossTexts';
import { useEssential } from '@/features/shared/useGameMode';
import { BOSS } from '@/rules/config';
import { onActionDone, useAppStore } from '@/stores/app';

import { syncBossWarnings, type BossWarningText } from './bossWarnings';
import { notificationPermission, systemBossWarnings } from './system';
import { notificationTextsOf } from './texts';

// The responses already handled: the one that started the app is also read at the start.
const opened = new Set<string>();

async function syncSystemBossWarnings(db: Db, textOf: (target: Boss) => BossWarningText) {
  try {
    if ((await notificationPermission()) !== 'granted') {
      return;
    }
    const now = Date.now();
    // Signed by the companion, like the other notifications (design 11.2; T80).
    const { sign } = notificationTextsOf(db);
    await syncBossWarnings(
      db,
      systemBossWarnings,
      { now, tzOffset: -new Date(now).getTimezoneOffset() },
      (target) => {
        const text = textOf(target);
        return { title: text.title, body: sign(text.body) };
      },
    );
  } catch {
    // Nothing to show: the warnings are aligned again at the next start or action.
  }
}

function openBoss(response: Notifications.NotificationResponse): void {
  const { identifier, content } = response.notification.request;
  const bossId = content.data?.bossId;
  if (
    typeof bossId !== 'string' ||
    response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ||
    opened.has(identifier)
  ) {
    return;
  }
  opened.add(identifier);
  try {
    router.push({ pathname: '/boss/[id]', params: { id: bossId } });
  } catch {
    // The navigation is not ready: the app stays on its first screen.
  }
}

/**
 * The deadline warnings of the bosses in the notifications of the system (design-sezioni.md
 * 11.6): aligned at the start and after every action, in the language and lexicon of the app; a
 * touch on one opens the card of its boss. It draws nothing. The texts follow the game mode.
 */
export function BossNotifications() {
  const { t } = useTranslation();
  const { nameOf } = useBossTexts();
  // In the Essential mode the warning speaks of a goal, not of a boss (11.8).
  const essential = useEssential();
  const db = useAppStore((state) => state.db);
  const textOf = (target: Boss): BossWarningText => {
    const name = nameOf(target);
    return {
      title: name,
      body: t(essential ? 'essential.goalWarning' : 'bosses.warning.body', {
        name,
        count: BOSS.deadlineWarningDays,
      }),
    };
  };
  // The texts follow the language and the theme of the last render.
  const texts = useRef(textOf);
  useEffect(() => {
    texts.current = textOf;
  });

  useEffect(() => {
    if (db === null) {
      return undefined;
    }
    const sync = () => void syncSystemBossWarnings(db, (target) => texts.current(target));
    sync();
    const stopListening = onActionDone(sync);
    const subscription = Notifications.addNotificationResponseReceivedListener(openBoss);
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response !== null) {
          openBoss(response);
        }
      })
      .catch(() => undefined);
    return () => {
      stopListening();
      subscription.remove();
    };
  }, [db]);

  return null;
}
