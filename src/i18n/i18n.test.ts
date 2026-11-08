import { MISSION_TEMPLATES, TEMPLATE_CATEGORIES } from '@/content/templates';
import { TITLE_KEYS, TITLE_THEMES } from '@/content/titles';
import { SKIP_REASONS } from '@/db/repositories/completion';
import { STARTER_QUEST } from '@/db/repositories/onboarding';
import { LANGUAGES } from '@/db/repositories/settings';
import { RESOURCES, createI18n, deviceLanguage, type Language } from '@/i18n';
import { STAT_KEYS } from '@/rules/types';
import temi from '@/theme/temi.json';

let mockLocaleTags: string[] = [];
jest.mock('expo-localization', () => ({
  getLocales: () => mockLocaleTags.map((languageTag) => ({ languageTag })),
}));

type Tree = { readonly [key: string]: string | Tree };

/** Every key of a translation file, as `a.b.c`, with its text. */
function entries(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : entries(value, `${prefix}${key}.`),
  );
}

const translations = (language: Language): Tree => RESOURCES[language].translation;

/** Terms of the theme lexicon: the keys without a theme suffix. */
function baseTerms(group: Readonly<Record<string, string>>): string[] {
  return Object.keys(group).filter(
    (key) => !TITLE_THEMES.some((family) => key.endsWith(`_${family}`)),
  );
}

/** temi.json «lessico» and the key of the same term in the language files. */
const TEMI_LEXICON: Record<string, string> = {
  vita: 'hp',
  esperienza: 'xp',
  monete: 'coins',
  missioni: 'missions',
  boss: 'boss',
  serie: 'streak',
  livello: 'level',
  compagno: 'companion',
};

describe('language files', () => {
  it('has the five languages of the settings', () => {
    expect(Object.keys(RESOURCES).sort()).toEqual([...LANGUAGES].sort());
  });

  it('has every key in all five languages, never empty', () => {
    const reference = entries(translations('it'))
      .map(([key]) => key)
      .sort();
    for (const language of LANGUAGES) {
      const found = entries(translations(language));
      expect(found.map(([key]) => key).sort()).toEqual(reference);
      for (const [key, text] of found) {
        expect({ language, key, empty: text.trim() === '' }).toEqual({
          language,
          key,
          empty: false,
        });
      }
    }
  });

  it('gives every term of the lexicon a variant for every theme', () => {
    for (const language of LANGUAGES) {
      const lexicon = RESOURCES[language].translation.lexicon as Record<string, string>;
      expect(baseTerms(lexicon)).toHaveLength(19);
      for (const term of baseTerms(lexicon)) {
        for (const family of TITLE_THEMES) {
          expect(lexicon[`${term}_${family}`]).toEqual(expect.any(String));
        }
      }
    }
  });

  it('takes the Italian lexicon from temi.json', () => {
    const lexicon = RESOURCES.it.translation.lexicon as Record<string, string>;
    for (const [term, byFamily] of Object.entries(temi.lessico)) {
      for (const [family, text] of Object.entries(byFamily)) {
        expect(lexicon[`${TEMI_LEXICON[term]}_${family}`]).toBe(text);
      }
    }
  });

  it('names the six stats for every theme', () => {
    for (const language of LANGUAGES) {
      const stats = RESOURCES[language].translation.stats as Record<string, string>;
      for (const stat of STAT_KEYS) {
        expect(stats[stat]).toEqual(expect.any(String));
        for (const family of TITLE_THEMES) {
          expect(stats[`${stat}_${family}`]).toEqual(expect.any(String));
        }
      }
    }
  });

  it('has the texts of templates, categories, titles and skip reasons', () => {
    for (const language of LANGUAGES) {
      const keys = new Set(entries(translations(language)).map(([key]) => key));
      for (const template of MISSION_TEMPLATES) {
        expect(keys).toContain(`templates.${template.key}.name`);
      }
      for (const category of TEMPLATE_CATEGORIES) {
        expect(keys).toContain(`templateCategories.${category}`);
      }
      for (const family of TITLE_THEMES) {
        for (const title of TITLE_KEYS[family]) {
          expect(keys).toContain(`titles.${family}.${title}`);
        }
      }
      for (const reason of SKIP_REASONS) {
        expect(keys).toContain(`skipReasons.${reason}`);
      }
    }
  });
});

describe('createI18n', () => {
  it('reads the lexicon of the theme with the context, with the base form as fallback', async () => {
    const it = await createI18n('it');
    expect(it.t('lexicon.missions', { context: 'fantasy' })).toBe('Imprese');
    expect(it.t('lexicon.missions', { context: 'minimal' })).toBe('Abitudini');
    expect(it.t('lexicon.missions', { context: 'pirate' })).toBe('Missioni');
    expect(it.t('lexicon.missions')).toBe('Missioni');
    const en = await createI18n('en');
    expect(en.t('stats.wisdom', { context: 'lovecraft' })).toBe('Lucidity');
  });

  it('translates the keys stored by the first launch', async () => {
    const it = await createI18n('it');
    expect(it.t(STARTER_QUEST.name, { context: 'fantasy' })).toBe('La prima impresa');
    expect(it.t(STARTER_QUEST.name)).toBe('Quest di partenza');
    expect(it.t(STARTER_QUEST.steps[1])).toBe('Completala');
    expect(it.t('templates.drink_water.name')).toBe("Bevi 2 litri d'acqua");
    const de = await createI18n('de');
    expect(de.t(STARTER_QUEST.steps[2])).toBe('Öffne die Statistik');
  });
});

describe('deviceLanguage', () => {
  it('takes the first supported language of the phone (choice 19)', () => {
    mockLocaleTags = ['de-DE'];
    expect(deviceLanguage()).toBe('de');
    mockLocaleTags = ['pt-BR', 'fr-FR'];
    expect(deviceLanguage()).toBe('fr');
  });

  it('falls back to English when no language of the phone is supported (choice 19)', () => {
    mockLocaleTags = ['ja-JP'];
    expect(deviceLanguage()).toBe('en');
    mockLocaleTags = [];
    expect(deviceLanguage()).toBe('en');
  });
});
