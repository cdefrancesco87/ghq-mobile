import de from '../../i18n/locales/de.json';
import en from '../../i18n/locales/en.json';
import es from '../../i18n/locales/es.json';
import fr from '../../i18n/locales/fr.json';
import it from '../../i18n/locales/it.json';

// Amounts of the measurable missions, e.g. «1,25 L» or «+250 ml» (design-sezioni.md 2.5, 11.3).
// No React and no i18next instance: the notifications use it from the background task too.

const UNITS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  it: it.missionDetail.units,
  en: en.missionDetail.units,
  de: de.missionDetail.units,
  fr: fr.missionDetail.units,
  es: es.missionDetail.units,
};

/** «1,25»: at most two decimals, with the separator of the language. */
export function formatNumber(value: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(value);
}

/** The short name of a unit key (`liter` → «L»); a custom unit is shown as it was typed. */
export function unitName(unit: string, language: string): string {
  return UNITS[language]?.[unit] ?? UNITS.en[unit] ?? unit;
}

/** «1,25 L». */
export function formatAmount(value: number, unit: string, language: string): string {
  return `${formatNumber(value, language)} ${unitName(unit, language)}`;
}

/** «+250 ml»: the Complete button of the notification of a measurable mission (11.3). */
export function incrementLabel(amount: number, unit: string, language: string): string {
  return `+${formatAmount(amount, unit, language)}`;
}
