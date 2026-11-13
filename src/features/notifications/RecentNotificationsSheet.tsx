import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  markNotificationsSeen,
  recentNotifications,
  recordFiredReminders,
  type AppNotification,
  type RecentNotifications,
} from '@/db/repositories/appNotifications';
import type { TodayMission, TodayView } from '@/db/repositories/todayView';
import { useBossTexts } from '@/features/bosses/bossTexts';
import { Button } from '@/features/shared/Button';
import { Card } from '@/features/shared/Card';
import { formatClock } from '@/features/shared/formatClock';
import { Sheet } from '@/features/shared/Sheet';
import { ThemedText } from '@/features/shared/ThemedText';
import { useEssential } from '@/features/shared/useGameMode';
import type { MissionActions } from '@/features/today/useMissionActions';
import { formatDay } from '@/features/stats/format';
import { BOSS } from '@/rules/config';
import { addDays } from '@/rules/gameDay';
import type { GameDay } from '@/rules/types';
import { getSession } from '@/stores/session';
import { useTheme } from '@/theme/ThemeProvider';

import { clearAppBadge } from './system';

export interface RecentNotificationsSheetProps {
  readonly view: TodayView;
  readonly actions: MissionActions;
  /** True when Today is opened to show the unseen notifications (from the widget). */
  readonly requested: boolean;
  /** Called once the request is handled, opened or not. */
  readonly onHandled: () => void;
}

interface Row {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly when: string;
  /** The mission of an open reminder of today: the row has Complete. */
  readonly open: TodayMission | null;
}

/**
 * The sheet «Notifiche recenti» on Today (design-sezioni.md 11.7, 12.1; mockup D41): opened when
 * Today is reached with notifications not seen yet, it lists the latest, the newest first, with
 * time, text and Complete for the reminders still open. Closing it marks them as seen and clears
 * the badge of the icon.
 */
export function RecentNotificationsSheet({
  view,
  actions,
  requested,
  onHandled,
}: RecentNotificationsSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors, family } = useTheme();
  const { nameOf } = useBossTexts();
  const essential = useEssential();
  const { width, height } = useWindowDimensions();
  const [recent, setRecent] = useState<{ data: RecentNotifications; at: number } | null>(null);
  const [visible, setVisible] = useState(false);

  // Each request is read once, while rendering (the reminders already shown are written first).
  const [readFor, setReadFor] = useState(false);
  if (requested !== readFor) {
    setReadFor(requested);
    if (requested) {
      const { db, clock } = getSession();
      const now = clock();
      try {
        recordFiredReminders(db, now.now);
        const data = recentNotifications(db, now);
        if (data.unseen > 0) {
          setRecent({ data, at: now.now });
          setVisible(true);
        }
      } catch {
        // Nothing to show: Today opens as usual.
      }
    }
  }

  useEffect(() => {
    if (requested) {
      onHandled();
    }
  }, [requested, onHandled]);

  const close = () => {
    setVisible(false);
    if (recent !== null) {
      try {
        markNotificationsSeen(getSession().db, recent.at);
      } catch {
        // They stay unseen: the sheet opens again next time.
      }
    }
    void clearAppBadge();
  };

  const language = i18n.language;
  const whenOf = (item: AppNotification, today: GameDay): string => {
    if (item.day === today) {
      return formatClock(item.time, language);
    }
    if (item.day === addDays(today, -1)) {
      return t('notifications.recent.yesterday');
    }
    return formatDay(item.day, language, { day: 'numeric', month: 'short' });
  };

  const rowOf = (item: AppNotification, today: GameDay): Row | null => {
    const when = whenOf(item, today);
    const text = (key: string) =>
      typeof item.params[key] === 'string' ? (item.params[key] as string) : '';
    switch (item.kind) {
      case 'reminder': {
        const missionId = text('missionId');
        const inToday =
          text('gameDay') === view.day
            ? (view.missions.find((entry) => entry.mission.id === missionId) ?? null)
            : null;
        if (item.missionName === null) {
          return null;
        }
        const done = inToday?.state === 'done';
        const gender = t('lexicon.missions_g', { context: family }) === 'm' ? 'm' : undefined;
        return {
          id: item.id,
          title: item.missionName,
          body: done
            ? t('notifications.recent.done', { context: gender })
            : t('notifications.reminder.body', { context: family }),
          when,
          open: inToday !== null && inToday.state === 'todo' && !view.restDay ? inToday : null,
        };
      }
      case 'summary':
        return { id: item.id, title: text('title'), body: text('body'), when, open: null };
      case 'boss.deadline_warning':
      case 'boss.deadline_missed': {
        if (item.boss === null) {
          return null;
        }
        const name = nameOf(item.boss);
        return {
          id: item.id,
          title: name,
          body:
            item.kind === 'boss.deadline_missed'
              ? t('notifications.recent.deadlineMissed')
              : t(essential ? 'essential.goalWarning' : 'bosses.warning.body', {
                  name,
                  count: BOSS.deadlineWarningDays,
                }),
          when,
          open: null,
        };
      }
      default:
        return null;
    }
  };

  const data = recent?.data ?? null;
  const rows =
    data === null
      ? []
      : data.items.map((item) => rowOf(item, data.today)).filter((row): row is Row => row !== null);

  return (
    <Sheet
      testID="recent-notifications"
      visible={visible}
      onClose={close}
      title={t('notifications.recent.title')}
    >
      <ScrollView testID="recent-notifications-scroll" contentContainerStyle={styles.content}>
        <ThemedText testID="recent-notifications-unseen" variant="caption" color={colors.textMuted}>
          {t('notifications.recent.unseen', { count: data?.unseen ?? 0 })}
        </ThemedText>
        <Card style={styles.list}>
          {rows.map((row, index) => (
            <View key={row.id}>
              {index === 0 ? null : (
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
              )}
              <View testID={`recent-notification-${row.id}`} style={styles.row}>
                <View
                  accessible
                  accessibilityLabel={`${row.title}, ${row.body}, ${row.when}`}
                  style={styles.texts}
                >
                  <ThemedText>{row.title}</ThemedText>
                  <ThemedText variant="caption" color={colors.textMuted}>
                    {row.body}
                  </ThemedText>
                </View>
                <ThemedText variant="caption" color={colors.textMuted}>
                  {row.when}
                </ThemedText>
                {row.open === null ? null : (
                  <Button
                    testID={`recent-notification-complete-${row.id}`}
                    variant="secondary"
                    label={t('notifications.reminder.complete')}
                    accessibilityLabel={t('notifications.recent.completeA11y', {
                      name: row.title,
                    })}
                    onPress={() => {
                      if (row.open !== null) {
                        actions.complete(row.open, { x: width / 2, y: height / 2 });
                      }
                    }}
                  />
                )}
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 16 },
  list: { paddingVertical: 0 },
  separator: { height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  texts: { flex: 1, gap: 2 },
});
