import { pickLanguage } from '@/rules/language';

describe('pickLanguage', () => {
  it('takes the base language of the first device locale when it is supported (choice 19)', () => {
    expect(pickLanguage(['it-IT'])).toBe('it');
    expect(pickLanguage(['de-AT'])).toBe('de');
    expect(pickLanguage(['es'])).toBe('es');
    expect(pickLanguage(['en-GB', 'it-IT'])).toBe('en');
  });

  it('skips unsupported locales and takes the first supported one (choice 19)', () => {
    expect(pickLanguage(['pt-BR', 'fr-FR'])).toBe('fr');
    expect(pickLanguage(['zh-Hans-CN', 'ja-JP', 'IT-it'])).toBe('it');
  });

  it('falls back to English when no locale is supported (choice 19)', () => {
    expect(pickLanguage(['ja-JP'])).toBe('en');
    expect(pickLanguage([])).toBe('en');
    expect(pickLanguage([''])).toBe('en');
  });
});
