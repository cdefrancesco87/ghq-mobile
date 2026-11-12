import { termInSentence } from './lexicon';

describe('termInSentence', () => {
  it('writes a term of the lexicon in lower case inside a sentence', () => {
    expect(termInSentence('Missioni', 'it')).toBe('missioni');
    expect(termInSentence('Conoscenza proibita', 'it')).toBe('conoscenza proibita');
    expect(termInSentence('Quests', 'en')).toBe('quests');
  });

  it('keeps the capital letter of German nouns', () => {
    expect(termInSentence('Aufgaben', 'de')).toBe('Aufgaben');
  });

  it('keeps an acronym as it is', () => {
    expect(termInSentence('XP', 'it')).toBe('XP');
    expect(termInSentence('EXP', 'fr')).toBe('EXP');
  });
});
