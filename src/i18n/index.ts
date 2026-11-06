import { createInstance, type i18n } from 'i18next';
import { getLocales } from 'expo-localization';
import { initReactI18next } from 'react-i18next';

import type { SettingValue } from '../db/repositories/settings';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';

// The texts of the app in five languages (stack-tecnologico.md, point 9). The lexicon of the
// themes uses the i18next context: `t('lexicon.missions', { context: 'fantasy' })` reads
// `missions_fantasy`, with `missions` as the fallback. Italian comes from the documents, English
// is translated, German, French and Spanish are drafts.

export type Language = SettingValue<'language'>;

export const RESOURCES = {
  it: { translation: it },
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
  es: { translation: es },
} as const satisfies Record<Language, { translation: object }>;

const FALLBACK_LANGUAGE: Language = 'en';

function isLanguage(code: string | null | undefined): code is Language {
  return code != null && code in RESOURCES;
}

/** The language of the phone if it is one of the five, otherwise English (US-ONB first step). */
export function pickLanguage(
  locales: readonly { readonly languageCode: string | null }[],
): Language {
  const code = locales[0]?.languageCode;
  return isLanguage(code) ? code : FALLBACK_LANGUAGE;
}

/** The language to preselect at the first launch. */
export function deviceLanguage(): Language {
  return pickLanguage(getLocales());
}

/** A new i18next instance, ready for react-i18next, in the given language. */
export async function createI18n(language: Language): Promise<i18n> {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    resources: RESOURCES,
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: { escapeValue: false },
  });
  return instance;
}
