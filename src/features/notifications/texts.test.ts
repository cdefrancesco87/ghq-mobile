import { eveningSummary } from '@/rules/notifications';

import { notificationTexts, type TextSettings } from './texts';

const IT: TextSettings = {
  language: 'it',
  theme: 'minimal',
  gameMode: 'full',
  heroName: 'Claudio',
};

const names = (count: number) => ['A', 'B', 'C', 'D', 'E'].slice(0, count);
const summaryWith = (left: number) =>
  eveningSummary([
    ...names(left).map((name) => ({ name, done: false })),
    { name: 'Z', done: true },
  ]);

describe('notificationTexts', () => {
  it('writes the reminder in the tone of each theme (design 11.2)', () => {
    const body = (theme: string) => notificationTexts({ ...IT, theme }).reminderBody;
    expect(body('arcade')).toBe('Stage pronto! Premi START.');
    expect(body('fantasy')).toBe("L'impresa ti attende.");
    expect(body('cyberpunk')).toBe('Contratto attivo, esegui.');
    expect(body('lovecraft')).toBe('Il rito ti chiama.');
    expect(body('minimal')).toBe("È l'ora che hai scelto.");
    expect(body('minimal-scuro')).toBe("È l'ora che hai scelto.");
    expect(notificationTexts({ ...IT, language: 'en', theme: 'fantasy' }).reminderBody).toBe(
      'The quest awaits you.',
    );
  });

  it('labels the buttons Completa and «Tra 10 min»', () => {
    const texts = notificationTexts(IT);
    expect([texts.completeLabel, texts.snoozeLabel]).toEqual(['Completa', 'Tra 10 min']);
  });

  it('titles a group with the number and the term of the theme', () => {
    expect(notificationTexts(IT).group(['Medita', 'Leggi', 'Bevi'])).toEqual({
      title: '3 abitudini per adesso',
      body: 'Medita, Leggi, Bevi',
    });
    expect(notificationTexts({ ...IT, theme: 'fantasy' }).group(names(4)).title).toBe(
      '4 imprese per adesso',
    );
  });

  it('writes the evening summary with 0, 2 and 5 missions left (design 11.5)', () => {
    const texts = notificationTexts({ ...IT, theme: 'fantasy' });
    expect(texts.evening(summaryWith(0)!)).toEqual({
      title: 'Giornata completa!',
      body: 'Il regno festeggia, Claudio.',
    });
    expect(texts.evening(summaryWith(2)!)).toEqual({
      title: "Com'è andata oggi?",
      body: "Ti mancano 2 imprese, c'è ancora tempo: A, B.",
    });
    expect(texts.evening(summaryWith(5)!)).toEqual({
      title: "Com'è andata oggi?",
      body: "Ti mancano 5 imprese, c'è ancora tempo: A, B, C e altre 2.",
    });
  });

  it('agrees «e altri» with a masculine term and speaks of one mission left', () => {
    const arcade = notificationTexts({ ...IT, theme: 'arcade' });
    expect(arcade.evening(summaryWith(4)!).body).toBe(
      "Ti mancano 4 stage, c'è ancora tempo: A, B, C e un altro.",
    );
    expect(notificationTexts(IT).evening(summaryWith(1)!).body).toBe(
      "Ti manca 1 abitudine, c'è ancora tempo: A.",
    );
    expect(notificationTexts({ ...IT, language: 'en' }).evening(summaryWith(5)!).body).toBe(
      "5 habits left, there's still time: A, B, C and 2 more.",
    );
  });

  it('confirms a completion with the gains, and only «Fatto!» in the Essential mode', () => {
    expect(notificationTexts(IT).confirmation({ xp: 20, coins: 5 })).toEqual({
      title: 'Fatto!',
      body: '+20 XP · +5 monete',
    });
    expect(
      notificationTexts({ ...IT, theme: 'arcade' }).confirmation({ xp: 20, coins: 0 }),
    ).toEqual({ title: 'Fatto!', body: '+20 EXP' });
    expect(
      notificationTexts({ ...IT, gameMode: 'essential' }).confirmation({ xp: 20, coins: 5 }),
    ).toEqual({ title: 'Fatto!', body: '' });
  });

  it('names the Android channels', () => {
    expect(notificationTexts(IT).channels).toEqual({
      reminders: 'Promemoria',
      summaries: 'Riepiloghi',
      boss: 'Boss',
      recall: 'Richiamo',
      confirmations: 'Conferme',
    });
  });
});
