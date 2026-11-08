import type { TFunction } from 'i18next';

import { createI18n } from '@/i18n';
import type { Frequency } from '@/rules/frequency';
import { LANGUAGES, type GameDay } from '@/rules/types';
import { describeFrequency } from './describeFrequency';

let t: TFunction;

beforeAll(async () => {
  t = (await createI18n('it')).t;
});

describe('describeFrequency', () => {
  const cases: readonly (readonly [string, Frequency, string])[] = [
    ['daily', { type: 'daily' }, 'Ogni giorno'],
    ['some weekdays', { type: 'weekdays', days: [5, 1, 3] }, 'Lun, mer, ven'],
    ['a run of weekdays', { type: 'weekdays', days: [1, 2, 3, 4, 5] }, 'Lun–ven'],
    ['a run and a day', { type: 'weekdays', days: [1, 2, 3, 6] }, 'Lun–mer, sab'],
    ['two days in a row', { type: 'weekdays', days: [6, 7] }, 'Sab, dom'],
    ['all the weekdays', { type: 'weekdays', days: [1, 2, 3, 4, 5, 6, 7] }, 'Ogni giorno'],
    ['once a week', { type: 'times_per_week', times: 1 }, '1 volta a settimana'],
    ['times a week', { type: 'times_per_week', times: 3 }, '3 volte a settimana'],
    ['every 1 day', { type: 'every_n_days', n: 1, from: day('2026-11-08') }, 'Ogni giorno'],
    ['every n days', { type: 'every_n_days', n: 3, from: day('2026-11-08') }, 'Ogni 3 giorni'],
    ['monthly', { type: 'monthly', day: 15 }, 'Ogni mese il giorno 15'],
    ['yearly', { type: 'yearly', month: 3, day: 21 }, 'Ogni anno il 21 marzo'],
  ];

  it.each(cases)('writes %s', (_name, frequency, text) => {
    expect(describeFrequency(frequency, t)).toBe(text);
  });

  it('writes the due day of a task', () => {
    expect(describeFrequency(null, t, day('2026-11-12'))).toBe('Scade il 12 novembre');
    expect(describeFrequency(null, t, day('2026-01-05'))).toBe('Scade il 5 gennaio');
  });

  it('says when a task has no due day', () => {
    expect(describeFrequency(null, t)).toBe('Senza scadenza');
    expect(describeFrequency(null, t, null)).toBe('Senza scadenza');
  });

  it.each(LANGUAGES)('never leaves a key unresolved in %s', async (language) => {
    const { t: translate } = await createI18n(language);
    const texts = [
      ...cases.map(([, frequency]) => describeFrequency(frequency, translate)),
      ...Array.from({ length: 12 }, (_, index) =>
        describeFrequency({ type: 'yearly', month: index + 1, day: 1 }, translate),
      ),
      describeFrequency(null, translate),
      describeFrequency(null, translate, day('2026-11-12')),
    ];
    for (const text of texts) {
      expect(text).not.toContain('shared.frequency');
      expect(text).not.toContain('{{');
    }
  });
});

function day(value: string): GameDay {
  return value as GameDay;
}
