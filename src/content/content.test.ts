import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import deTexts from '@/i18n/locales/de.json';
import enTexts from '@/i18n/locales/en.json';
import esTexts from '@/i18n/locales/es.json';
import frTexts from '@/i18n/locales/fr.json';
import itTexts from '@/i18n/locales/it.json';
import { SHOP_ITEMS } from '@/content/shop';
import { MISSION_TEMPLATES, TEMPLATE_CATEGORIES } from '@/content/templates';
import { TITLE_KEYS, TITLE_THEMES } from '@/content/titles';
import { SHOP } from '@/rules/config';
import { frequencySchema } from '@/rules/frequency';
import { DIFFICULTIES, STAT_KEYS } from '@/rules/types';

describe('mission templates', () => {
  it('has at least 12 templates in the 4 categories of US-ONB-03', () => {
    expect(TEMPLATE_CATEGORIES).toEqual(['health', 'mind', 'work_study', 'home']);
    expect(MISSION_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    for (const category of TEMPLATE_CATEGORIES) {
      expect(MISSION_TEMPLATES.some((template) => template.category === category)).toBe(true);
    }
  });

  it('validates every frequency with the frequency schema', () => {
    for (const template of MISSION_TEMPLATES) {
      expect({
        key: template.key,
        valid: frequencySchema.safeParse(template.frequency).success,
      }).toEqual({ key: template.key, valid: true });
    }
  });

  it('gives every template a valid stat and difficulty', () => {
    for (const template of MISSION_TEMPLATES) {
      expect(STAT_KEYS).toContain(template.stat);
      expect(DIFFICULTIES).toContain(template.difficulty);
    }
  });

  it('gives every measurable template a target and an increment', () => {
    for (const template of MISSION_TEMPLATES) {
      const { goal } = template;
      if (goal.type !== 'none') {
        expect(goal.target).toBeGreaterThan(0);
        expect(goal.increment).toBeGreaterThan(0);
        expect(goal.increment).toBeLessThanOrEqual(goal.target);
      }
    }
  });

  it('has a different key for every template', () => {
    const keys = MISSION_TEMPLATES.map((template) => template.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('recommends the 3 templates of the first launch', () => {
    const recommended = MISSION_TEMPLATES.filter((template) => template.recommended);
    expect(recommended.map(({ key, stat }) => ({ key, stat }))).toEqual([
      { key: 'drink_water', stat: 'constitution' },
      { key: 'read_pages', stat: 'intelligence' },
      { key: 'meditation', stat: 'wisdom' },
    ]);
  });

  it('uses the stats of the examples in statistiche-eroe.md', () => {
    const statOf = (key: string) =>
      MISSION_TEMPLATES.find((template) => template.key === key)?.stat;
    expect(statOf('run')).toBe('strength');
    expect(statOf('healthy_meal')).toBe('constitution');
    expect(statOf('study_hour')).toBe('intelligence');
    expect(statOf('journal')).toBe('wisdom');
    expect(statOf('call_friend')).toBe('charisma');
    expect(statOf('inbox_zero')).toBe('discipline');
  });
});

describe('shop', () => {
  it('sells the potion and the shield at the prices of the configuration', () => {
    expect(SHOP_ITEMS).toEqual([
      { key: 'potion', group: 'helps', price: SHOP.potion.price, maxOwned: null },
      { key: 'shield', group: 'helps', price: SHOP.shield.price, maxOwned: SHOP.shield.maxOwned },
    ]);
  });
});

describe('hero titles', () => {
  it('has 11 different title keys for every theme', () => {
    expect(TITLE_THEMES).toEqual(['arcade', 'fantasy', 'cyberpunk', 'lovecraft', 'minimal']);
    for (const theme of TITLE_THEMES) {
      expect(TITLE_KEYS[theme]).toHaveLength(11);
      expect(new Set(TITLE_KEYS[theme]).size).toBe(11);
    }
  });

  it('has the titles approved on 14/11 (lessico-v2.json, titoliEroe) in every language', () => {
    const lexicon = JSON.parse(
      readFileSync(join(__dirname, '../../docs/riferimenti/lessico-v2.json'), 'utf8'),
    ) as Record<string, { titoliEroe: Record<string, string[]> }>;
    const locales = { it: itTexts, en: enTexts, de: deTexts, fr: frTexts, es: esTexts } as Record<
      string,
      { titles: Record<string, Record<string, string>> }
    >;
    for (const language of Object.keys(locales)) {
      for (const theme of ['arcade', 'fantasy', 'cyberpunk', 'lovecraft'] as const) {
        const expected = lexicon[language].titoliEroe[theme];
        expect(expected).toHaveLength(11);
        expect(TITLE_KEYS[theme].map((key) => locales[language].titles[theme][key])).toEqual(
          expected,
        );
      }
    }
  });
});
