# GHQ Mobile – istruzioni per Claude Code

Good Habits Quest Mobile (GHQ Mobile) è un habit tracker per iOS e Android che trasforma le abitudini in un gioco di ruolo leggero: offline, senza account, senza server. Lo sviluppa Claudio, che viene da Angular e lavora su Windows e Linux (niente Mac).

## Come si lavora in questo repository

- Il lavoro è diviso in task piccoli in `docs/backlog-task.md`. Si eseguono con il loop descritto in `docs/prompt-loop.md`: **un task per giro**, nell'ordine, solo se le dipendenze sono fatte.
- I documenti di progetto sono in `docs/riferimenti/`. Sono una copia: la fonte di verità è la cartella di progetto di Claudio. Non modificarli; se trovi un errore o un'incoerenza, scrivilo nel diario del backlog.
- Rispondi e scrivi i diari in italiano. Il codice, i nomi di file, tabelle, variabili e i commit sono in inglese (`snake_case` nel database, `camelCase` in TypeScript), come stabilito nel modello dati.
- **Non inventare regole di gioco.** I valori stanno in `docs/riferimenti/xp-e-monete.md`, `statistiche-eroe.md` e nella sezione «Regole di gioco» di `analisi-funzionale.md`. I punti segnati «Proposta» non sono approvati: **non implementarli**. Se un task richiede una regola che i documenti non definiscono e che non è tra le «Scelte minori già fissate» qui sotto, segna il task bloccato.
- Mai `git push`, mai comandi `eas` (build, submit, update, login): li lancia Claudio.

## Stack (deciso, non cambiarlo)

React Native con Expo (TypeScript strict), Expo Router, Zustand, SQLite con expo-sqlite e Drizzle ORM, Zod, expo-notifications con expo-task-manager, i18next con react-i18next ed expo-localization, react-native-reanimated, expo-image, react-native-svg, expo-font. Test con Jest (preset jest-expo) e React Native Testing Library; nei test il database gira su better-sqlite3. Development build, non Expo Go. Dettagli in `docs/riferimenti/stack-tecnologico.md`.

## Struttura delle cartelle

```
app/                 rotte di Expo Router (schermate sottili: leggono e chiamano azioni)
src/rules/           regole di gioco: funzioni pure, nessun import di React, Expo o database
src/db/              schema.ts, client.ts, repositories/ (una funzione per azione di gioco)
src/features/<nome>/ componenti e hook di una sezione (today, habits, editor, boss, ...)
src/theme/           token dei temi da temi.json e ThemeProvider
src/i18n/            i18next e file delle lingue (it, en, de, fr, es)
src/content/         contenuti fissi in JSON/TS tipizzato: modelli di missione, negozio, titoli, badge
src/stores/          store Zustand (eroe, impostazioni, tema)
drizzle/             migrazioni SQL generate da drizzle-kit
test/                helper dei test (database in memoria, orologio finto)
docs/                backlog, prompt del loop, riferimenti
```

Regole di architettura (dal modello dati, sezione 7):

- Una schermata non scrive mai nelle tabelle: chiama un'azione in `src/db/repositories/`.
- Un'azione chiede alle funzioni di `src/rules/` le variazioni, apre **una** transazione, aggiorna le tabelle di stato e aggiunge l'evento al registro `events`.
- Le funzioni dei repository ricevono il database come parametro, con un tipo compatibile sia con expo-sqlite sia con better-sqlite3 (entrambi sincroni in Drizzle), così gli stessi repository girano nell'app e nei test.
- Ogni query sulle missioni nelle schermate usa `notDeleted(missions)`.
- Orologio e fuso orario si passano come parametri (o con un `Clock` iniettabile): niente `Date.now()` dentro `src/rules/`.

## Comandi

- `npm run typecheck` – TypeScript senza emettere file
- `npm run lint` – ESLint (configurazione Expo) e Prettier in controllo
- `npm test` – Jest
- `npm run check` – i tre comandi sopra in sequenza; **deve passare alla fine di ogni task**
- `npx drizzle-kit generate` – nuova migrazione dopo una modifica a `src/db/schema.ts`
- `npx expo export --platform android --output-dir dist-check` – verifica che il bundle JavaScript si costruisca (non serve un telefono); cancellare `dist-check/` dopo

## Scelte minori già fissate

Valgono finché Claudio non decide diversamente. Ogni costante va in `src/rules/config.ts`, così si ritocca in un punto solo.

1. **Arrotondamenti**: gli XP di un completamento si calcolano come base × moltiplicatore di serie × 0,5 se esausto, e si arrotondano una volta sola alla fine con `Math.round`. Punti della statistica secondaria: 30% per difetto (`Math.floor`). Monete della vittoria sul boss: `Math.floor(xp / 5)`. Monete rubate dal boss: `Math.min(Math.floor(monete × 0,1), 500)`. Vita persa al cambio di giornata: `Math.round(10 × XP mancati ÷ XP previsti)`.
2. **Moltiplicatore di serie**: usa la serie dell'eroe al momento del completamento (assunzione da confermare con Claudio: l'analisi non dice se è la serie dell'eroe o della missione).
3. **Esausto**: se alla chiusura del giorno D la vita arriva a 0, l'eroe è esausto nel giorno D+1 (`exhausted_day = D+1`, XP dimezzati); alla chiusura di D+1 la vita torna a 13.
4. **Bonus immediati**: «giornata completa» (+10 monete, +5 vita) e «Piano completato» (+25 XP) si danno nel momento in cui l'ultima missione o priorità viene completata, con un proprio evento; se un annullamento rende il giorno di nuovo incompleto, il bonus si annulla con lui.
5. **Annullamento**: riporta indietro anche il livello dell'eroe se gli XP scendono sotto la soglia (il livello può scendere).
6. **Settimana**: per «N volte a settimana» e per il limite di 3 «Salta oggi», la settimana inizia dal giorno impostato in `week_start` (predefinito lunedì).
7. **Contenuti in bozza**: quando un task chiede contenuti non ancora definiti (modelli di missione oltre ai 3 citati, titoli dell'eroe, testi in tedesco, francese e spagnolo), scrivili come bozza, segnala nel diario «contenuto da rivedere da Claudio» e prosegui.
