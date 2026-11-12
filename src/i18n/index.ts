import { createInstance, type i18n } from 'i18next';
import { getLocales } from 'expo-localization';
import { initReactI18next } from 'react-i18next';

import type { SettingValue } from '../db/repositories/settings';
import { FALLBACK_LANGUAGE } from '../rules/config';
import { pickLanguage } from '../rules/language';
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

/** Every language in its own words, in the order of the list (design-sezioni.md 1.2). */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
};

/** The device locales in order of preference, e.g. `['pt-BR', 'fr-FR']`. */
export function deviceLocaleTags(): string[] {
  return getLocales().map((locale) => locale.languageTag);
}

/**
 * The language to preselect at the first launch: the first language of the phone among the five,
 * otherwise English (CLAUDE.md, choice 19).
 */
export function deviceLanguage(): Language {
  return pickLanguage(deviceLocaleTags());
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
