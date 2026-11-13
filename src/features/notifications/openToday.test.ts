import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

import { useHighlightStore } from '@/stores/highlight';

import { openTodayFrom } from './useReminderActions';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('./backgroundTask', () => ({}));

function response(
  identifier: string,
  data: Record<string, unknown>,
  actionIdentifier: string = Notifications.DEFAULT_ACTION_IDENTIFIER,
) {
  return {
    actionIdentifier,
    notification: { request: { identifier, content: { data } } },
  } as unknown as Notifications.NotificationResponse;
}

describe('openTodayFrom (design 11.3, 11.5)', () => {
  beforeEach(() => {
    jest.mocked(router.navigate).mockClear();
    useHighlightStore.getState().clear();
  });

  it('opens Today with the row of the reminder highlighted', () => {
    expect(openTodayFrom(response('r1', { kind: 'reminder', missionId: 'm1' }))).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith('/today');
    expect(useHighlightStore.getState().missionId).toBe('m1');
  });

  it('opens Today from a group, the evening summary and the check-in, without a highlight', () => {
    expect(openTodayFrom(response('g1', { kind: 'group', missionIds: ['a', 'b', 'c'] }))).toBe(
      true,
    );
    expect(openTodayFrom(response('s1', { kind: 'summary' }))).toBe(true);
    expect(openTodayFrom(response('recall', { kind: 'recall' }))).toBe(true);
    expect(router.navigate).toHaveBeenCalledTimes(3);
    expect(useHighlightStore.getState().missionId).toBeNull();
  });

  it('opens Statistics from the weekly recap, every week (T81)', () => {
    const weekly = (date: number) => {
      const value = response('weekly-recap', { kind: 'weekly' });
      return { ...value, notification: { ...value.notification, date } };
    };
    expect(openTodayFrom(weekly(1))).toBe(true);
    expect(openTodayFrom(weekly(1))).toBe(false);
    expect(openTodayFrom(weekly(2))).toBe(true);
    expect(router.navigate).toHaveBeenCalledTimes(2);
    expect(router.navigate).toHaveBeenLastCalledWith('/stats');
  });

  it('ignores the buttons, the other notifications and a response already opened', () => {
    expect(openTodayFrom(response('r2', { kind: 'reminder', missionId: 'm1' }, 'complete'))).toBe(
      false,
    );
    expect(openTodayFrom(response('b1', { bossId: 'x' }))).toBe(false);
    expect(openTodayFrom(response('r3', { kind: 'reminder', missionId: 'm2' }))).toBe(true);
    expect(openTodayFrom(response('r3', { kind: 'reminder', missionId: 'm2' }))).toBe(false);
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });
});
