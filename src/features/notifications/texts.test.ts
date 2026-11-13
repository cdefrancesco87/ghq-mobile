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
  it('writes the reminder in the tone of each theme, signed by the companion (design 11.2)', () => {
    const body = (theme: string) => notificationTexts({ ...IT, theme }).reminderBody;
    expect(body('arcade')).toBe('Stage pronto! Premi START.\n— Pixel');
    expect(body('fantasy')).toBe("L'impresa ti attende.\n— Rocky");
    expect(body('cyberpunk')).toBe('Contratto attivo, esegui.\n— Glitchy');
    expect(body('lovecraft')).toBe('Il rito ti chiama.\n— Lumin');
    expect(body('minimal')).toBe("È l'ora che hai scelto.\n— Cloudy");
    expect(body('minimal-scuro')).toBe("È l'ora che hai scelto.\n— Cloudy");
    expect(notificationTexts({ ...IT, language: 'en', theme: 'fantasy' }).reminderBody).toBe(
      'The quest awaits you.\n— Rocky',
    );
  });

  it('signs with the name chosen for the companion, or the one of the theme (T80)', () => {
    expect(notificationTexts(IT).sign('Ciao')).toBe('Ciao\n— Cloudy');
    expect(notificationTexts({ ...IT, companionName: null }).sign('Ciao')).toBe('Ciao\n— Cloudy');
    const chosen = notificationTexts({ ...IT, theme: 'arcade', companionName: 'Bit' });
    expect(chosen.sign('Ciao')).toBe('Ciao\n— Bit');
    expect(chosen.reminderBody).toBe('Stage pronto! Premi START.\n— Bit');
    expect(chosen.sign('')).toBe('— Bit');
  });

  it('writes the check-in after 3 days with the name of the companion (design 11.6)', () => {
    expect(notificationTexts(IT).recall).toEqual({
      title: 'Cloudy ti aspetta',
      body: 'Bastano due minuti per ripartire.',
    });
    expect(notificationTexts({ ...IT, language: 'en', companionName: 'Bit' }).recall).toEqual({
      title: 'Bit is waiting for you',
      body: 'Two minutes are enough to start again.',
    });
  });

  it('labels the buttons Completa and «Tra 10 min»', () => {
    const texts = notificationTexts(IT);
    expect([texts.completeLabel, texts.snoozeLabel]).toEqual(['Completa', 'Tra 10 min']);
  });

  it('titles a group with the number and the term of the theme', () => {
    expect(notificationTexts(IT).group(['Medita', 'Leggi', 'Bevi'])).toEqual({
      title: '3 abitudini per adesso',
      body: 'Medita, Leggi, Bevi\n— Cloudy',
    });
    expect(notificationTexts({ ...IT, theme: 'fantasy' }).group(names(4)).title).toBe(
      '4 imprese per adesso',
    );
  });

  const DAY = { day: '2026-11-13', done: 1 } as const;

  it('signs the evening summary with the companion, 0, 2 and 5 missions left (design 6.14, 11.5)', () => {
    const texts = notificationTexts({ ...IT, theme: 'fantasy' });
    expect(texts.evening(summaryWith(0)!, DAY)).toEqual({
      title: 'Rocky',
      body: 'Grumf. Tutto fatto per oggi, Claudio. Che giornata!',
    });
    expect(texts.evening(summaryWith(2)!, DAY)).toEqual({
      title: 'Rocky',
      body: "Grumf. Ancora 2 da fare: A, B. C'è tempo!",
    });
    expect(texts.evening(summaryWith(5)!, DAY)).toEqual({
      title: 'Rocky',
      body: "Grumf. Ancora 5 da fare: A, B, C e altre 2. C'è tempo!",
    });
  });

  it('invites to start when no mission is done yet', () => {
    const summary = eveningSummary([
      { name: 'A', done: false },
      { name: 'B', done: false },
    ])!;
    expect(notificationTexts(IT).evening(summary, { ...DAY, done: 0 })).toEqual({
      title: 'Cloudy',
      body: 'La giornata non è finita: A, B. Bastano due minuti.',
    });
  });

  it('uses the name given to the companion as the title', () => {
    const texts = notificationTexts({ ...IT, companionName: 'Nuvola' });
    expect(texts.evening(summaryWith(0)!, DAY).title).toBe('Nuvola');
  });

  it('agrees «e altri» with a masculine term and writes the other languages', () => {
    const arcade = notificationTexts({ ...IT, theme: 'arcade' });
    expect(arcade.evening(summaryWith(4)!, DAY)).toEqual({
      title: 'Pixel',
      body: "Bip! Ancora 4 da fare: A, B, C e un altro. C'è tempo!",
    });
    expect(notificationTexts(IT).evening(summaryWith(1)!, DAY).body).toBe(
      "Ancora 1 da fare: A. C'è tempo!",
    );
    expect(notificationTexts({ ...IT, language: 'en' }).evening(summaryWith(5)!, DAY).body).toBe(
      "5 still to do: A, B, C and 2 more. There's time!",
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
