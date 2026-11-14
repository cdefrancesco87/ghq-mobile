import { ENABLED_LANGUAGES, FALLBACK_LANGUAGE } from './config';
import { type Language } from './types';

function isLanguage(code: string): code is Language {
  return (ENABLED_LANGUAGES as readonly string[]).includes(code);
}

/**
 * The language of the first launch (CLAUDE.md, choice 19): the first device locale whose base
 * language is supported, otherwise English.
 *
 * @param localeTags The device locales in order of preference, e.g. `['pt-BR', 'fr-FR']`.
 */
export function pickLanguage(localeTags: readonly string[]): Language {
  for (const tag of localeTags) {
    const base = tag.split('-')[0].toLowerCase();
    if (isLanguage(base)) {
      return base;
    }
  }
  return FALLBACK_LANGUAGE;
}
