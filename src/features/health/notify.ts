import * as Notifications from 'expo-notifications';

import { notificationPermission, SUMMARY_CHANNEL } from '../notifications/system';
import type { HealthNotifier } from './sync';

/**
 * «Obiettivo raggiunto» on top of expo-notifications, in the channel of the summaries (it must be
 * seen, unlike the quiet confirmation after Complete); nothing without the permission.
 */
export const systemHealthNotifier: HealthNotifier = {
  notify: async (text, fireAt, now) => {
    if ((await notificationPermission()) !== 'granted') {
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title: text.title, body: text.body, data: { kind: 'health' } },
      trigger:
        fireAt > now
          ? {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: fireAt,
              channelId: SUMMARY_CHANNEL,
            }
          : { channelId: SUMMARY_CHANNEL },
    });
  },
};
