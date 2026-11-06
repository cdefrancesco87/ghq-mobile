# Verifica del backlog – 06/11/2026

Verifica eseguita il 06/11/2026. Tutti i task T01–T33 sono marcati `[x]`. Nessun task `[~]` o `[!]` aperto.

---

## Tabella task

| Task | Stato | Commit | File presenti | Criterio | Note |
|------|-------|--------|---------------|----------|------|
| T01  | [x]   | `c2581d9` | OK | OK | `tsconfig.json`, `app.json`, `.gitignore`, tutte le cartelle struttura presenti |
| T02  | [x]   | `61a4b00` | OK | OK | `npm run check` passa; 37 suite, 427 test |
| T03  | [x]   | `2dc249d` | OK | OK | `.github/workflows/ci.yml` presente; script `check` esiste in `package.json` |
| T04  | [x]   | `2644ee4` | OK | OK | `types.ts`, `config.ts`, `config.test.ts` presenti; copertura 100% |
| T05  | [x]   | `725ec51` | OK | OK | `gameDay.ts`, `gameDay.test.ts`; copertura 100% |
| T06  | [x]   | `185bce5` | OK | OK | `frequency.ts`, `frequency.test.ts`; copertura 100% |
| T07  | [x]   | `ca0d18c` | OK | OK | `level.ts`, `level.test.ts`; copertura 100% |
| T08  | [x]   | `d1fd49b` | OK | OK | `stats.ts`, `stats.test.ts`; copertura 100% |
| T09  | [x]   | `f488e88` | OK | OK | `completion.ts`, `completion.test.ts`; copertura 100% |
| T10  | [x]   | `512c9a3` | OK | OK | `day.ts`, `day.test.ts`; copertura 100% |
| T11  | [x]   | `6583942` | OK | OK | `streak.ts`, `streak.test.ts`; copertura 100% |
| T12  | [x]   | `24a17ca` | OK | OK | `boss.ts`, `boss.test.ts`; copertura 100% |
| T13  | [x]   | `a8e92d4` | OK | OK | `companion.ts`, `companion.test.ts`; copertura 100% |
| T14  | [x]   | `f636bae` (+ `eddfa55` blocco) | OK | OK | `closeDays.ts`, `closeDays.test.ts`; copertura 100% |
| T15  | [x]   | `28a2ee0` | OK | OK | `undo.ts`, `undo.test.ts`; copertura 100% |
| T16  | [x]   | `9c289dc` | OK | OK | `schema.ts`, `drizzle/0000_initial_schema.sql`, `drizzle.config.ts` presenti |
| T17  | [x]   | `6b7918e` | OK | OK | `client.ts`, `types.ts`, `migrateWithBackup.ts`, `test/db.ts`; `expo export` passa |
| T18  | [x]   | `94a3fff` | OK | OK | `drizzle/0002_events_append_only.sql` presente; trigger verificati dai test |
| T19  | [x]   | `be547c4` | OK | OK | `repositories/settings.ts` presente; `npm run check` passa |
| T20  | [x]   | `24525ad` | OK | OK | `repositories/events.ts` presente; `npm run check` passa |
| T21  | [x]   | `9d827a3` | OK | OK | `templates.ts`, `shop.ts`, `titles.ts` presenti; copertura 100% |
| T22  | [x]   | `c629a72` | OK | OK | `repositories/onboarding.ts` presente; `npm run check` passa |
| T23  | [x]   | `661e21d` | OK | OK | `repositories/missions.ts` presente; `npm run check` passa |
| T24  | [x]   | `9388a0f` | OK | OK | `repositories/completion.ts` presente; `npm run check` passa |
| T25  | [x]   | `ecca343` | OK | OK | `repositories/undo.ts`, `closing.ts`, `shop.ts` presenti; `npm run check` passa |
| T26  | [x]   | `4d5c15c` | OK | OK | `repositories/rebuild.ts`, `test/simulation.test.ts` presenti; `npm run check` passa |
| T27  | [x]   | `0f6a669` | OK | OK | `themes.ts`, `ThemeProvider.tsx` presenti; `npm run check` passa |
| T28  | [x]   | `a719883` | OK | OK | `i18n/index.ts`, `locales/it.json`, `locales/en.json` presenti; `npm run check` passa |
| T29  | [x]   | `314e97c` | OK | OK | `fonts.ts` presente; `expo export` passa |
| T30  | [x]   | `f065af5` | OK | OK | `src/stores/` con `hero.ts`, `settings.ts`, `theme.ts`, `app.ts`; `npm run check` passa |
| T31  | [x]   | `3421f3a` | OK | OK | `app/(tabs)/today.tsx` e le altre schede presenti; `expo export` passa |
| T32  | [x]   | `f07560b` | OK | OK | `src/features/notifications/`, `docs/prova-notifiche.md`, `eas.json`; `expo export` passa |
| T33  | [x]   | `b25c6c0` | OK | OK | `README.md` presente; comandi citati esistono in `package.json` |

---

## Comandi eseguiti

### npm run check

```
> npm run typecheck && npm run lint && npm test

typecheck: tsc --noEmit → OK (nessun errore)
lint: expo lint --max-warnings 0 && prettier --check → OK (All matched files use Prettier code style!)
test: jest --coverage

Test Suites: 37 passed, 37 total
Tests:       427 passed, 427 total
Snapshots:   0 total
Time:        ~25 s

EXIT CODE: 0 → PASSA
```

### Copertura src/rules/

```
Tutti i file di src/rules/ al 100% su righe, istruzioni, rami e funzioni.

File           | % Stmts | % Branch | % Funcs | % Lines
---------------|---------|----------|---------|--------
All files      |     100 |      100 |     100 |     100
 boss.ts       |     100 |      100 |     100 |     100
 clamp.ts      |     100 |      100 |     100 |     100
 closeDays.ts  |     100 |      100 |     100 |     100
 companion.ts  |     100 |      100 |     100 |     100
 completion.ts |     100 |      100 |     100 |     100
 config.ts     |     100 |      100 |     100 |     100
 day.ts        |     100 |      100 |     100 |     100
 frequency.ts  |     100 |      100 |     100 |     100
 gameDay.ts    |     100 |      100 |     100 |     100
 level.ts      |     100 |      100 |     100 |     100
 stats.ts      |     100 |      100 |     100 |     100
 streak.ts     |     100 |      100 |     100 |     100
 types.ts      |     100 |      100 |     100 |     100
 undo.ts       |     100 |      100 |     100 |     100

Test Suites: 13 passed, 13 total (222 test)
```

La soglia del 90% è abbondantemente superata (100%).

### expo export

```
npx expo export --platform android --output-dir dist-check

Bundle Android generato: _expo/static/js/android/entry-*.hbc (4.6 MB)
Exported: dist-check → PASSA

dist-check cancellata dopo la verifica.
```

### git status

```
Sul branch main
Il tuo branch è aggiornato rispetto a 'origin/main'.
non c'è nulla di cui eseguire il commit, l'albero di lavoro è pulito
```

### git stash list

```
(vuoto — nessuna modifica in sospeso)
```

---

## Punti aperti nel Diario

### Contenuti da rivedere da Claudio

- **T21/T28** – Modelli di missione (categorie, frequenze, difficoltà, obiettivi numerici) e titoli dell'eroe dal quarto in poi sono bozze; i testi in tedesco, francese e spagnolo sono bozze in tutte le sezioni.
- **T22** – Difficoltà della quest di partenza impostata a `easy` (bozza).
- **T28** – Inglese tradotto da Claude; nomi dei titoli; nome generico della quest («Quest di partenza»).
- **T28** – Genere dell'eroe nei titoli (oggi maschile fisso: Cavaliere, Studioso…).
- **T31** – Testo dell'etichetta «Nuova missione» del pulsante [+]; testi di errore d'avvio grezzi; nomi tab in tedesco, francese e spagnolo bozza.
- **T32** – Testi delle notifiche («Completa», «Posticipa», «Tocca Completa per segnarla fatta.») provvisori e in italiano fisso.
- **T33** – Testo di presentazione e stato del progetto nel README.

### Scelte da confermare

- **T05** – Segno di `tz_offset`: minuti a est di UTC (opposto a `getTimezoneOffset()`); vale anche per la colonna `tz_offset` del registro?
- **T06** – `paused_until` è il primo giorno di nuovo attivo; i «Salta oggi» riducono N nelle «N volte a settimana»?
- **T13** – Regola dell'umore: soglie del 70%/30% (implementato) oppure «torna felice con una missione completata oggi» (US-COMP-02 / design 6.3)?
- **T14** – Se l'ultimo giorno della settimana è di riposo, le «N volte a settimana» non vengono mai valutate per chi riposa la domenica.
- **T14** – Una «N volte a settimana» creata a metà settimana perde le occorrenze dalla creazione.
- **T19** – Lingua predefinita `en`; `theme: 'minimal'` come codice per «Automatico»; riepilogo serale acceso di default alle 21:00; `week_start` come intero 1–7.
- **T22** – Tipo di evento `hero.created` aggiunto (non previsto dal modello dati 4.2) per garantire che la somma del registro coincida con l'eroe.
- **T22/T24/T25** – Ricompensa della vittoria della quest di partenza: oggi segue la formula normale (T25 aggiunge `starterQuestReward`), ma US-ONB-04 / design 1.8 promettono «il primo livello e le prime monete».
- **T25** – L'annullamento è rifiutato se le monete da restituire sono già state spese.
- **T25** – Il furto avviene dal giorno dopo la scadenza, una volta per scadenza.
- **T25** – La pozione si può usare anche a vita piena.

### Incoerenze nei documenti (già segnalate, non risolte)

- **T12** – Sezione 5 dell'analisi dice vita del boss «calcolata da passi e difficoltà»; le regole approvate e il modello dati dicono passi × 20. Seguito il modello approvato. La frase è un refuso da correggere.
- **T13** – US-COMP-02 / design 6.3 e le «Regole di gioco» danno regole diverse per l'umore del compagno (vedi sopra).
- **T19** – Design 10.5 dice che «ogni cambio della giornata vale da domani» (anche primo giorno settimana e giorni di riposo), mentre il modello dati lo prevede solo per `day_change`. Seguito il task.
- **T27** – `temi.json` ha chiavi di colore diverse per tema; i ruoli mancanti sono bozza da rivedere. Coppie testo/sfondo sotto 4,5:1 segnalate nel Diario T27 (Arcade, Fantasy, Lovecraft, Minimal chiaro).

### Task per Claudio ancora aperti

| # | Cosa | Stato |
|---|------|-------|
| C03 | `git push` e verifica CI verde su GitHub | Aperto |
| C04 | Confermare identificativi `ch.ghq.mobile` (provvisori) | Aperto |
| C05 | Confermare quale serie usa il moltiplicatore di XP (scelta minore 2) | Aperto |
| C06 | Decidere proposte aperte su XP/monete e valori badge/ricompense | Aperto |
| C07 | Rivedere contenuti in bozza: modelli, titoli, DE/FR/ES | Aperto (dopo T21/T28) |
| C08 | Account Expo, `eas build`, installazione APK | Aperto (dopo T32) |
| C09 | Prova prototipo notifiche su Android (`docs/prova-notifiche.md`) | Aperto (dopo C08) |
| C10 | iPhone e Apple Developer Program | Futuro |
| C11 | Emulatore Android Studio e Maestro per test E2E | Futuro |

*(C01 e C02 sono completati: il repository esiste e il loop è stato eseguito.)*
