/**
 * A term of the lexicon of the theme inside a sentence (e.g. «Scegli 3 missioni», «Missioni di
 * oggi» stays a title): lower case, except for German, where nouns keep their capital letter, and
 * for acronyms such as XP.
 */
export function termInSentence(term: string, language: string): string {
  if (language === 'de' || term === term.toUpperCase()) {
    return term;
  }
  return term.toLowerCase();
}
