import { LANGUAGES } from '@/db/repositories/settings';
import { RESOURCES } from '@/i18n';
import { ENCOURAGEMENT, EVENING_SITUATIONS, MORNING_SITUATIONS, TALE_VOICES } from '@/rules/tale';

import { plainTale, taleSegments, taleVariants } from './taleTexts';

const MOODS = ['happy', 'normal', 'sad'] as const;
/** The placeholders of racconto-compagno-testi.md, «Regole di scrittura». */
const PLACEHOLDERS = [
  'hero',
  'companion',
  'done',
  'scheduled',
  'streak',
  'boss',
  'damage',
  'days',
  'missing',
  'count',
];

function text(language: (typeof LANGUAGES)[number], key: string): string {
  let node: unknown = RESOURCES[language].translation;
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown>)[part];
  }
  return node as string;
}

describe('texts of the tale (design 6.14)', () => {
  it('has a variant for every voice, situation and mood in all five languages', () => {
    for (const language of LANGUAGES) {
      const variants = taleVariants(language);
      for (const voice of TALE_VOICES) {
        for (const situation of [...MORNING_SITUATIONS, ENCOURAGEMENT]) {
          for (const mood of MOODS) {
            expect(variants(`tale.${voice}.${situation}.${mood}`).length).toBeGreaterThan(0);
          }
        }
        for (const situation of EVENING_SITUATIONS) {
          expect(variants(`tale.${voice}.${situation}`).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('uses only the placeholders of the list, never coins or damage, and at most 120 characters in Italian', () => {
    const variants = taleVariants('it');
    for (const voice of TALE_VOICES) {
      const groups = [
        ...[...MORNING_SITUATIONS, ENCOURAGEMENT].flatMap((situation) =>
          MOODS.map((mood) => `tale.${voice}.${situation}.${mood}`),
        ),
        ...EVENING_SITUATIONS.map((situation) => `tale.${voice}.${situation}`),
      ];
      for (const key of groups.flatMap(variants)) {
        for (const language of LANGUAGES) {
          const value = text(language, key);
          const names = [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]);
          expect(names.filter((name) => !PLACEHOLDERS.includes(name))).toEqual([]);
          // Valid also in the Essential mode (backlog T91).
          expect(names).not.toContain('damage');
        }
        expect(plainTale(text('it', key)).length).toBeLessThanOrEqual(120);
      }
    }
  });

  it('reads the variants of a group from the files, any number of them', () => {
    expect(taleVariants('it')('tale.cloudy.fullDay.happy')).toEqual([
      'tale.cloudy.fullDay.happy.1',
    ]);
    expect(taleVariants('it')('tale.cloudy.allDone')).toEqual(['tale.cloudy.allDone.1']);
    expect(taleVariants('it')('tale.nobody.fullDay.happy')).toEqual([]);
  });
});

describe('taleSegments', () => {
  it('puts the numbers between ** in bold', () => {
    expect(taleSegments('Ieri **4 su 5** e basta')).toEqual([
      { text: 'Ieri ', bold: false },
      { text: '4 su 5', bold: true },
      { text: ' e basta', bold: false },
    ]);
    expect(plainTale('Ieri **4 su 5**')).toBe('Ieri 4 su 5');
  });
});
