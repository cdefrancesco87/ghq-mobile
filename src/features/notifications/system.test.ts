import type { ReminderRequest } from './reminders';
import { CATEGORY_REMINDER, CATEGORY_REMINDER_LAST, reminderCategory } from './system';

const BASE: ReminderRequest = {
  missionId: 'm1',
  title: 'Water',
  body: 'Time.',
  fireAt: 0,
  snoozeCount: 0,
  increment: null,
  completeLabel: null,
  snoozeLabel: 'In 10 min',
};

describe('reminderCategory', () => {
  it('uses the default categories for a yes/no mission', () => {
    expect(reminderCategory(BASE)).toBe(CATEGORY_REMINDER);
    expect(reminderCategory({ ...BASE, snoozeCount: 3 })).toBe(CATEGORY_REMINDER_LAST);
  });

  it('gives a measurable mission a category whose Complete button is the increment', () => {
    const request = {
      ...BASE,
      increment: { amount: 250, unit: 'milliliter' },
      completeLabel: '+250 ml',
    };
    expect(reminderCategory(request)).toBe(`${CATEGORY_REMINDER}:+250 ml`);
    expect(reminderCategory({ ...request, snoozeCount: 3 })).toBe(
      `${CATEGORY_REMINDER_LAST}:+250 ml`,
    );
  });
});
