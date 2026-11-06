# GHQ Mobile – Backlog dei task preliminari

Task di sviluppo da eseguire in loop con Claude Code, uno per giro, seguendo `docs/prompt-loop.md`. Scritto il 06/11/2026 a partire da analisi funzionale, modello dati, stack tecnologico, XP e monete, statistiche dell'eroe e design delle sezioni.

**Stati:** `[ ]` da fare · `[~]` in corso · `[x]` fatto · `[!]` bloccato (motivo nel Diario).

**Cosa copre:** le fondamenta su cui poggeranno le schermate: progetto Expo, regole di gioco con i test, database con le azioni di gioco, temi, lingue, navigazione e il codice del prototipo delle notifiche. Le schermate complete (Oggi, Abitudini, Editor…) saranno un secondo backlog, quando questo è finito.

**Cosa non copre:** le regole segnate «Proposta» in `xp-e-monete.md` (non ancora approvate) e tutto ciò che richiede Claudio: telefono, account, decisioni. Quei passi sono in fondo, in «Task per Claudio».

Ogni task ha: obiettivo, riferimenti, cosa fare, criterio di completamento («Fatto quando») e dipendenze. Oltre ai comandi indicati, alla fine di ogni task deve passare `npm run check` (dal T02 in poi).

---

## Fase 0 – Progetto e strumenti

### [x] T01 – Creare il progetto Expo
- **Obiettivo:** avere la base del codice con TypeScript strict e la struttura a cartelle decisa.
- **Riferimenti:** `stack-tecnologico.md` punti 1, 2 e 10; `CLAUDE.md`, «Struttura delle cartelle».
- **Da fare:**
  - Crea il progetto con `npx create-expo-app@latest` (modello predefinito con Expo Router e TypeScript, ultima SDK stabile). Il repository non è vuoto (contiene `CLAUDE.md` e `docs/`): crealo in una cartella temporanea e sposta i file nella radice, senza sovrascrivere `CLAUDE.md`, `docs/` e `.claude/`.
  - Togli le schermate e i componenti d'esempio (o lo script `reset-project`), lasciando una sola schermata vuota.
  - `tsconfig.json` con `strict: true` e l'alias `@/*` verso `src/*`.
  - Crea le cartelle vuote della struttura con un `.gitkeep`.
  - `app.json`: nome «GHQ Mobile», slug `ghq-mobile`, schema `ghq`, identificativi `ch.ghq.mobile` per iOS e Android (provvisori, da confermare con Claudio).
  - `.gitignore` con `node_modules`, `.expo`, `dist-check`, `ios`, `android`.
- **Fatto quando:** `npx tsc --noEmit` passa; `npx expo-doctor` non segnala errori (gli avvisi vanno nel Diario); `git init` fatto e primo commit.
- **Dipende da:** nessuno (il repository esiste già, task C01 di Claudio).

### [x] T02 – Lint, formattazione e test
- **Obiettivo:** avere `npm run check` funzionante, da usare in ogni task successivo.
- **Riferimenti:** `stack-tecnologico.md` punto 10.
- **Da fare:**
  - ESLint con `npx expo lint` (configurazione Expo) e Prettier con `eslint-config-prettier`.
  - Jest con il preset `jest-expo` e `@testing-library/react-native`; alias `@/` anche in Jest.
  - Script in `package.json`: `typecheck`, `lint`, `format`, `test`, `check` (typecheck + lint + test).
  - Un test d'esempio in `src/rules/` che passa.
  - Soglia di copertura del 90% sulle righe solo per `src/rules/`.
- **Fatto quando:** `npm run check` passa; un errore di tipo voluto in un file di prova fa fallire `npm run typecheck` (poi rimuovilo).
- **Dipende da:** T01.

### [x] T03 – Integrazione continua su GitHub Actions
- **Obiettivo:** lint, tipi e test a ogni push, come previsto dallo stack.
- **Riferimenti:** `stack-tecnologico.md` punto 10, «CI».
- **Da fare:** `.github/workflows/ci.yml` con Node LTS, cache di npm, `npm ci` e `npm run check`, su push e pull request.
- **Fatto quando:** il file YAML è valido (`node -e` con il pacchetto `yaml` lo legge senza errori) e i comandi usati esistono in `package.json`.
- **Dipende da:** T02.

---

## Fase 1 – Regole di gioco (funzioni pure, in TDD)

Tutto in `src/rules/`, senza React, Expo o database. Ogni file ha il suo `*.test.ts` con i casi limite elencati.

### [x] T04 – Tipi e configurazione del gioco
- **Obiettivo:** un unico punto con tutti i valori da tarare.
- **Riferimenti:** `xp-e-monete.md` sezioni 1, 2 e 4 («Valori di difficoltà»); `statistiche-eroe.md`; `analisi-funzionale.md` «Regole di gioco».
- **Da fare:**
  - `src/rules/types.ts`: `Difficulty` (`easy`, `medium`, `hard`), `StatKey` (6 chiavi del modello dati), `GameDay` (stringa `AAAA-MM-GG`), `Deltas` (`xp`, `coins`, `hp`, `stats`).
  - `src/rules/config.ts`: XP 10/25/50, monete 2/5/10, danno al boss 2/5/10, punti statistica 10/20/30, quota secondaria 0,3, vita massima 50, vita persa massima 10, vita dopo esaurimento 13, +1 vita per completamento, bonus giornata completa (+10 monete, +5 vita), bonus Piano +25 XP, soglie del moltiplicatore di serie (7 → 1,1; 30 → 1,2; 100 → 1,3), livello massimo 50, livello massimo statistiche 10, prezzi (pozione 50, scudo 100), pozione +10 vita, scudi massimi 2, salti massimi 3 a settimana, boss (20 vita e danno per passo, minimo 10 per passo rimanente, moltiplicatori 1 / 1,5 / 2, furto 10% massimo 500, avviso a 3 giorni), compagno (cucciolo a 1 completamento, adulto a 150), umore (soglie 0,7 e 0,3 su 3 giorni).
- **Fatto quando:** un test confronta i valori con le tabelle dei documenti (un caso per tabella).
- **Dipende da:** T02.

### [x] T05 – Giorno di gioco e calendario
- **Obiettivo:** sapere a quale giorno appartiene ogni istante, con il cambio di giornata e il fuso.
- **Riferimenti:** `modello-dati.md` sezione 5; `analisi-funzionale.md` «Requisiti non funzionali», Tempo.
- **Da fare:** in `src/rules/gameDay.ts`: `toGameDay(instantMs, tzOffsetMinutes, dayChange 'HH:MM')`, `addDays`, `diffDays`, `weekday` (1 = lunedì … 7 = domenica), `weekStartOf(day, weekStart)`, `daysBetween(from, to)` (elenco dei giorni interi passati). Nessuna libreria esterna di date.
- **Fatto quando:** i test coprono: completamento all'1:00 con cambio alle 6:00 che vale per il giorno prima; esattamente alle 6:00; cambio di ora legale; volo verso est e verso ovest senza giorni falsi; fine mese e anno bisestile; inizio settimana lunedì e domenica.
- **Dipende da:** T04.

### [x] T06 – Frequenze e missioni previste
- **Obiettivo:** decidere se una missione è prevista in un giorno.
- **Riferimenti:** `modello-dati.md` sezione 3.4; `analisi-funzionale.md` sezione 4 (frequenze) e US-OGGI-01.
- **Da fare:**
  - `src/rules/frequency.ts`: schema Zod `frequencySchema` (unione discriminata con le 6 forme) e tipo `Frequency` ricavato con `z.infer`.
  - `isScheduled(frequency, day, ctx)` dove `ctx` contiene i completamenti della settimana (per `times_per_week`) e l'inizio settimana.
  - `isDueToday(mission, day, ctx)` che considera anche stato (`paused` fino a `paused_until`, `archived`, `deleted_at`) e attività singole (in scadenza oggi o scadute e non completate).
- **Fatto quando:** i test coprono ogni forma, il 31 nei mesi corti (vale l'ultimo giorno), il 29 febbraio annuale negli anni non bisestili (vale il 28), `times_per_week` che sparisce raggiunto N, `every_n_days` prima della data di partenza, missione in pausa con data di fine, Zod che rifiuta forme sbagliate.
- **Dipende da:** T05.

### [x] T07 – Livelli e titolo dell'eroe
- **Obiettivo:** far salire e scendere il livello con gli XP.
- **Riferimenti:** `xp-e-monete.md` «Livelli»; `design-sezioni.md` 9.3.
- **Da fare:** in `src/rules/level.ts`: `xpToNext(level) = 50 × (level + 3)`; `applyXp({level, xpInLevel, xpTotal}, deltaXp)` che gestisce più livelli in un colpo, il tetto a 50 (oltre si accumulano solo `xpTotal`) e i delta negativi (il livello può scendere, mai sotto 1 e mai XP negativi); `titleIndex(level)` da 0 a 10 (livelli 1, 5, 10 … 50).
- **Fatto quando:** i test verificano la tabella dei livelli del documento (livello 2 a 200 XP totali, 5 a 1.100, 10 a 3.600, 20 a 12.350, 30 a 26.100, 50 a 68.600), salita multipla, discesa con annullamento, tetto a 50.
- **Dipende da:** T04.

### [ ] T08 – Statistiche dell'eroe
- **Obiettivo:** punti e livelli delle 6 statistiche.
- **Riferimenti:** `statistiche-eroe.md` (tutto).
- **Da fare:** in `src/rules/stats.ts`: `statPoints(difficulty, primary, secondary)` (10/20/30 e 30% per difetto; nessun punto senza principale); `statLevel(points)` con la curva 100 × (n+1), tetto 10 con punti che si accumulano; `formArrow(last30, prev30, daysOfUse)` (↑ con +10%, ↓ con −10%, niente nei primi 30 giorni).
- **Fatto quando:** i test verificano la tabella «Punti totali» del documento (livello 1 a 100, 2 a 300, 3 a 600, 5 a 1.500, 10 a 5.500), la secondaria uguale alla principale rifiutata, la freccia ai bordi del 10%.
- **Dipende da:** T04.

### [ ] T09 – Ricompense di un completamento
- **Obiettivo:** calcolare le variazioni di un completamento, uguali da app, notifica, widget e salute.
- **Riferimenti:** `xp-e-monete.md` sezione 1 («Quanti XP», «Bonus», «Quando si ottengono»); `analisi-funzionale.md` «Regole di gioco»; `CLAUDE.md` scelte minori 1, 2 e 3.
- **Da fare:** in `src/rules/completion.ts`: `completionDeltas({difficulty, heroStreak, exhausted, statPrimary, statSecondary})` → XP, monete, +1 vita, punti statistica, danno al boss; `measurableProgress({value, step, target})` che dice quando il valore raggiunge l'obiettivo (le ricompense arrivano una volta sola, superare l'obiettivo non dà altro).
- **Fatto quando:** i test coprono le 3 difficoltà, le soglie di serie 6/7/29/30/99/100 giorni, il moltiplicatore che non tocca le monete, l'esausto con XP dimezzati, la misurabile che passa da parziale a fatta e oltre.
- **Dipende da:** T07, T08.

### [ ] T10 – Vita, giornata completa, Piano e salti
- **Obiettivo:** le regole della vita e dei bonus del giorno.
- **Riferimenti:** `analisi-funzionale.md` «Regole di gioco» (Vita, Bonus) e US-OGGI-02, US-OGGI-06; `design-sezioni.md` 2.3 e 2.7; `CLAUDE.md` scelte minori 3, 4 e 6.
- **Da fare:** in `src/rules/day.ts`: `hpLoss({scheduledXp, missedXp, isRestDay, gameMode})` (massimo 10, nessuna perdita a riposo o in Essenziale); `applyHp(hp, delta)` tra 0 e 50; `isFullDay(scheduled, done)` (falso con zero missioni previste); `isPlanComplete(plan, done)` (falso con zero priorità); `canAddToPlan(plan)` (massimo 3); `skipsLeft(skipsThisWeek)` (massimo 3).
- **Fatto quando:** i test riproducono l'esempio del documento (2 medie mancate su 5 previste tolgono 4 punti), il tetto di 10, il giorno di riposo, Essenziale, vita che non supera 50 con pozione e bonus.
- **Dipende da:** T09.

### [ ] T11 – Serie dell'eroe e delle missioni
- **Obiettivo:** calcolare le serie, con riposo, salti e scudi.
- **Riferimenti:** `analisi-funzionale.md` «Regole di gioco», Serie.
- **Da fare:** in `src/rules/streak.ts`: `nextHeroStreak({streak, best}, dayOutcome)` con esiti `done`, `rest`, `missed`, `missed_with_shield`; `nextMissionStreak({streak, best}, occurrence)` con esiti `done`, `skipped`, `missed`, `missed_with_shield`, `not_scheduled`.
- **Fatto quando:** i test coprono: un giorno di riposo che mantiene senza crescere; «Salta oggi» che non spezza e non fa crescere; lo scudo che salva entrambe le serie; i giorni non previsti che non contano; il record che si aggiorna.
- **Dipende da:** T05.

### [ ] T12 – Boss
- **Obiettivo:** vita, danni, vittoria e scadenza dei boss.
- **Riferimenti:** `analisi-funzionale.md` «Regole di gioco», Boss, e sezione 5; `xp-e-monete.md` «Bonus» e «Quando si perdono»; `statistiche-eroe.md` (punti dei passi).
- **Da fare:** in `src/rules/boss.ts`: `bossHpMax(steps)`; `applyBossDamage({hp, stepsLeft}, damage)` con il minimo di 10 × passi rimanenti (la vittoria richiede l'ultimo passo); `victoryReward(steps, difficulty)`; `deadlineSteal(coins)`; `shouldWarnDeadline(today, deadline, warned)`; `canCreateBoss(activeCount)` (massimo 3); punti statistica di un passo (10 alla statistica del boss, se c'è).
- **Fatto quando:** i test coprono: un boss di 8 passi con 160 vita; danni di missioni che non scendono sotto il minimo; l'ultimo passo che sconfigge; ricompensa di un boss medio di 4 passi (60 XP, 12 monete); furto con 300 monete (30) e con 8.000 (500); avviso a 3 giorni una volta sola.
- **Dipende da:** T04.

### [ ] T13 – Compagno
- **Obiettivo:** stadio e umore del compagno.
- **Riferimenti:** `analisi-funzionale.md` «Regole di gioco», Compagno, e sezione 6; `design-sezioni.md` 6.3; `modello-dati.md` 3.2.
- **Da fare:** in `src/rules/companion.ts`: `stageFor(completionsTotal)` (uovo, cucciolo, adulto; mai all'indietro); `moodFor(lastThreeDays)` (felice sopra il 70%, normale tra 30 e 70, triste sotto il 30; senza giorni previsti, normale). I regali (Could) non si fanno ora.
- **Fatto quando:** i test coprono 0, 1, 149 e 150 completamenti e i bordi esatti del 30% e del 70%.
- **Dipende da:** T04.

### [ ] T14 – Chiusura dei giorni
- **Obiettivo:** la funzione pura che chiude uno o più giorni passati, anche dopo giorni senza aprire l'app.
- **Riferimenti:** `modello-dati.md` 3.7 e sezione 5; `analisi-funzionale.md` «Regole di gioco» (Vita, Serie); `CLAUDE.md` scelta minore 3.
- **Da fare:** in `src/rules/closeDays.ts`: `closeDays({lastClosedDay, today, missions, missionDays, hero, inventory, settings})` che, per ogni giorno intero tra l'ultimo chiuso e oggi, calcola il riepilogo (`scheduled_count`, `done_count`, `scheduled_xp`, `missed_xp`, `hp_lost`, `is_rest_day`, `shield_used`…), consuma lo scudo nel primo giorno mancato, aggiorna le serie, gestisce esausto e ritorno a 13. Restituisce l'elenco dei riepiloghi e delle variazioni, senza scrivere niente.
- **Fatto quando:** i test coprono: nessun giorno da chiudere; 5 giorni chiusi in un colpo; idempotenza (rieseguire non cambia niente); un volo che non crea giorni falsi; un giorno con vita a 0 seguito dal giorno esausto; uno scudo usato e il secondo no.
- **Dipende da:** T06, T10, T11.

### [ ] T15 – Annullamento
- **Obiettivo:** sapere cosa e fino a quando si può annullare.
- **Riferimenti:** `analisi-funzionale.md` US-OGGI-04; `modello-dati.md` 4.3; `CLAUDE.md` scelte minori 4 e 5.
- **Da fare:** in `src/rules/undo.ts`: `canUndo(eventGameDay, today)` (solo nella stessa giornata di gioco); `revertDeltas(deltas)` con i segni opposti; elenco dei bonus da annullare insieme (giornata completa e Piano) quando il giorno torna incompleto.
- **Fatto quando:** i test coprono l'annullamento prima e dopo il cambio di giornata e un annullamento che toglie anche il bonus del giorno.
- **Dipende da:** T09, T10.

---

## Fase 2 – Database e azioni di gioco

### [ ] T16 – Schema completo e prima migrazione
- **Obiettivo:** tutte le tabelle del modello dati in Drizzle.
- **Riferimenti:** `modello-dati.md` sezioni 2, 3, 4.1, 6 e 8.
- **Da fare:**
  - Installa `drizzle-orm`, `expo-sqlite` (con `npx expo install`), `zod`, `uuidv7`; in sviluppo `drizzle-kit`, `better-sqlite3`, `@types/better-sqlite3`.
  - `src/db/schema.ts` con tutte le tabelle: `hero`, `hero_stats`, `companion`, `settings`, `boss`, `boss_steps`, `missions`, `mission_reminders`, `mission_days`, `day_plan`, `day_summaries`, `inventory` (con `CHECK` sugli scudi ≤ 2), `badges`, `app_notifications`, `scheduled_reminders`, `events`. Le tabelle `rewards` (Could) non si fanno ora.
  - `drizzle.config.ts` con `dialect: 'sqlite'` e `driver: 'expo'`; genera la prima migrazione.
- **Fatto quando:** `npx drizzle-kit generate` crea `drizzle/0000_*.sql` senza errori; i tipi `typeof missions.$inferSelect` compilano; il campo `frequency` usa il tipo `Frequency` del T06.
- **Dipende da:** T06.

### [ ] T17 – Client del database e database di test
- **Obiettivo:** aprire il database nell'app e nei test con le stesse migrazioni.
- **Riferimenti:** `modello-dati.md` sezioni 6 (PRAGMA) e 8.
- **Da fare:**
  - `src/db/client.ts`: apertura con expo-sqlite, `PRAGMA foreign_keys = ON` e `journal_mode = WAL`, `migrate()` all'avvio; copia di sicurezza del file prima di una migrazione e ripristino se fallisce (la parte sui file dietro una piccola interfaccia, così si testa).
  - `src/db/types.ts`: il tipo del database comune a expo-sqlite e better-sqlite3.
  - `test/db.ts`: `createTestDb()` con better-sqlite3 in memoria, che applica le stesse migrazioni SQL di `drizzle/`.
- **Fatto quando:** un test applica tutte le migrazioni da zero; un test simula una migrazione che fallisce e verifica il ripristino; `npx expo export --platform android --output-dir dist-check` passa.
- **Dipende da:** T16.

### [ ] T18 – Registro in sola aggiunta e vincoli speciali
- **Obiettivo:** rendere impossibile modificare o cancellare il registro.
- **Riferimenti:** `modello-dati.md` 3.8 e 4.3.
- **Da fare:** migrazione personalizzata (`npx drizzle-kit generate --custom`) con i due trigger che rifiutano `UPDATE` e `DELETE` su `events` e l'indice parziale sui boss attivi.
- **Fatto quando:** un test su better-sqlite3 applica le migrazioni e verifica che `UPDATE` e `DELETE` su `events` falliscano e che `INSERT` funzioni.
- **Dipende da:** T17.

### [ ] T19 – Impostazioni
- **Obiettivo:** leggere e scrivere le impostazioni validate.
- **Riferimenti:** `modello-dati.md` 3.10; `design-sezioni.md` sezione 10 (valori predefiniti).
- **Da fare:** `src/db/repositories/settings.ts` con uno schema Zod e un valore predefinito per ogni chiave (`language`, `theme` = minimal, `game_mode` = full, `day_change` = 06:00, `week_start` = lunedì, `rest_days`, `quiet_hours`, `evening_summary`, `reduce_motion`, `colorblind`, `backup`, `device_id`); `getSetting`, `setSetting`; il cambio di `day_change` vale da domani (`{ value, next, from_day }`).
- **Fatto quando:** i test coprono valori predefiniti, valore non valido rifiutato e cambio dell'orario che vale dal giorno dopo.
- **Dipende da:** T17.

### [ ] T20 – Scrittura degli eventi e idempotenza
- **Obiettivo:** il mattone comune di ogni azione di gioco.
- **Riferimenti:** `modello-dati.md` 4.1, 4.2, 4.3 e 4.5 (`notDeleted`).
- **Da fare:** `src/db/repositories/events.ts`: `appendEvent(tx, input)` con UUID v7, `tz_offset`, `game_day`, `device_id` dalle impostazioni, chiave di idempotenza (se esiste già restituisce «già registrato» senza errori); i tipi di evento del modello come unione TypeScript; `notDeleted(missions)`.
- **Fatto quando:** i test verificano che lo stesso `idem_key` scritto due volte produca una sola riga e che gli UUID siano ordinati nel tempo.
- **Dipende da:** T18, T19.

### [ ] T21 – Contenuti fissi: modelli, negozio, titoli
- **Obiettivo:** i contenuti uguali per tutti, nel codice e tipizzati.
- **Riferimenti:** `analisi-funzionale.md` US-ONB-03; `design-sezioni.md` 1.5, 4.11, 7 e 9.3; `statistiche-eroe.md` «Le sei statistiche»; `modello-dati.md` sezione 1.
- **Da fare:** `src/content/templates.ts` con almeno 12 modelli in 4 categorie (Salute, Mente, Lavoro e studio, Casa), ognuno con chiave, frequenza, difficoltà, statistica e obiettivo; i 3 consigliati (Bevi 2 litri d'acqua, Leggi 20 pagine, Meditazione 10 min) segnati. `src/content/shop.ts` con pozione e scudo. `src/content/titles.ts` con 11 chiavi di titolo per tema (i testi vanno nelle lingue, al T28). Contenuti in bozza secondo la scelta minore 7.
- **Fatto quando:** un test valida ogni modello con lo schema della frequenza e controlla che le statistiche siano valide.
- **Dipende da:** T06.

### [ ] T22 – Primo avvio: creazione del profilo
- **Obiettivo:** creare eroe, statistiche, compagno, missioni scelte e quest di partenza in una transazione.
- **Riferimenti:** `analisi-funzionale.md` sezione 1 (US-ONB-00…05); `design-sezioni.md` 1.7 e 1.8; `modello-dati.md` 8 («Dati di partenza»).
- **Da fare:** `src/db/repositories/onboarding.ts`: `createProfile({name, language, theme, templateKeys})` crea `hero`, le 6 righe di `hero_stats`, il compagno uovo, le missioni dai modelli (da 1 a 5), il boss `starter` con 3 passi (crea la prima abitudine già fatta, completala, apri le statistiche) e gli eventi relativi. `hasProfile()`.
- **Fatto quando:** i test verificano tutte le righe create, il primo passo già segnato, il rifiuto di 0 o 6 modelli e di un nome vuoto, e che l'eroe coincida con la somma del registro.
- **Dipende da:** T20, T21.

### [ ] T23 – Missioni: creare, modificare, pausa, archivio, eliminazione
- **Obiettivo:** il ciclo di vita delle missioni.
- **Riferimenti:** `analisi-funzionale.md` sezioni 3 e 4; `modello-dati.md` 3.3 e 4.5.
- **Da fare:** `src/db/repositories/missions.ts`: `createMission`, `updateMission` (difficoltà e statistica valgono dai completamenti successivi), `pauseMission` con data di fine, `resumeMission`, `archiveMission`, `restoreMission`, `deleteMission` (cancellazione logica: `deleted_at`, promemoria e righe future di `day_plan` cancellati, evento `mission.deleted`), `listTodayMissions(day)` che usa `isDueToday`.
- **Fatto quando:** i test coprono ogni azione con il suo evento, la missione eliminata che sparisce dalle liste ma lascia `mission_days` ed eventi, e la validazione della frequenza con Zod.
- **Dipende da:** T22.

### [ ] T24 – Completare, avanzare, saltare, Piano del giorno
- **Obiettivo:** l'azione più importante dell'app, identica da ogni origine.
- **Riferimenti:** `modello-dati.md` 3.5, 3.6 e 4.4; `analisi-funzionale.md` sezione 2; `CLAUDE.md` scelte minori 1–4.
- **Da fare:** `src/db/repositories/completion.ts`:
  - `completeMission({missionId, source, idemKey, now})` in una transazione: evento, `mission_days`, eroe (XP, livello con evento `hero.level_up`, monete, vita), statistiche, compagno (con `companion.stage_up` alla schiusa), serie della missione, danno al boss collegato (e vittoria), bonus giornata completa e Piano se scattano, cancellazione di `scheduled_reminders` di quel giorno;
  - `progressMission` per le misurabili (parziale finché non si raggiunge l'obiettivo);
  - `skipMission` con motivo e limite di 3 a settimana;
  - `setDayPlan` / `removeFromDayPlan` con il limite di 3.
- **Fatto quando:** i test coprono: lo stesso completamento arrivato da notifica e da app che conta una volta; XP con serie e con esausto; schiusa al primo completamento; boss sconfitto dall'ultimo passo; bonus giornata completa e Piano; quarto posto del Piano rifiutato; quarto salto rifiutato; eroe uguale alla somma del registro dopo ogni test.
- **Dipende da:** T09, T10, T12, T13, T23.

### [ ] T25 – Annullare, chiudere i giorni, boss e negozio
- **Obiettivo:** le altre azioni che cambiano l'eroe.
- **Riferimenti:** `modello-dati.md` 3.7, 3.8, 3.9 e 4.3; `analisi-funzionale.md` sezioni 5 e 7; `xp-e-monete.md` sezione 2.
- **Da fare:**
  - `undoEvent(eventId)`: evento `event.reverted` con i delta opposti, `mission_days` ripristinato, boss, statistiche, livello, bonus del giorno; rifiutato dopo il cambio di giornata.
  - `closePendingDays(now)`: usa `closeDays` del T14 e scrive `day_summaries` ed eventi `day.closed` e `shield.consumed`.
  - Boss: `createBoss` (massimo 3 attivi), `completeBossStep`, `archiveBoss`, `checkBossDeadlines(today)` con avviso e furto.
  - Negozio: `buyItem` (monete sufficienti, massimo 2 scudi), `usePotion`.
- **Fatto quando:** i test coprono ogni azione e i suoi rifiuti; la chiusura rieseguita non cambia niente; un annullamento dopo il cambio di giornata è rifiutato; eroe uguale alla somma del registro dopo ogni test.
- **Dipende da:** T14, T15, T24.

### [ ] T26 – Ricostruzione dal registro e partita simulata
- **Obiettivo:** la garanzia che stato ed eventi non divergano mai.
- **Riferimenti:** `modello-dati.md` 4.3 («Ricostruzione») e 11.
- **Da fare:** `rebuildHeroFromEvents(db)` (la funzione di riparazione) e un test che simula 90 giorni di gioco con un generatore pseudo-casuale a seme fisso: crea missioni e boss, completa, annulla, salta, compra, usa pozioni, chiude i giorni. A ogni giorno controlla le invarianti: monete ≥ 0, vita tra 0 e 50, livello tra 1 e 50, scudi ≤ 2, eroe e statistiche uguali alla somma del registro.
- **Fatto quando:** il test passa con 3 semi diversi in meno di 30 secondi.
- **Dipende da:** T25.

---

## Fase 3 – Base dell'app

### [ ] T27 – Temi
- **Obiettivo:** i 6 temi come token tipizzati, disponibili in tutta l'app.
- **Riferimenti:** `temi.json`; `design-temi.md`; `design-sezioni.md` A3 e A4; `stack-tecnologico.md` punto 8.
- **Da fare:** copia `temi.json` in `src/theme/`, tipi ricavati dal file, `ThemeProvider` con il Context di React e `useTheme()`; Minimal segue chiaro o scuro del telefono; il tema scelto si legge dalle impostazioni.
- **Fatto quando:** un test verifica che ogni tema abbia gli stessi token e che ogni coppia testo/sfondo dichiarata abbia contrasto almeno 4,5:1 (le coppie che non passano vanno nel Diario, senza cambiare i colori); un test con React Native Testing Library verifica il cambio di tema.
- **Dipende da:** T19.

### [ ] T28 – Lingue e lessico dei temi
- **Obiettivo:** i testi in 5 lingue con le varianti di ogni tema.
- **Riferimenti:** `stack-tecnologico.md` punto 9; `temi.json` («lessico»); `statistiche-eroe.md` «Nomi per tema»; `design-sezioni.md` A10.
- **Da fare:** i18next, react-i18next ed expo-localization (lingua del telefono se è una delle 5, altrimenti inglese); file `it`, `en`, `de`, `fr`, `es`; lessico dei temi con il contesto di i18next (`missions_fantasy`…, la forma base come ripiego); nomi delle statistiche per tema. Italiano dai documenti, inglese tradotto; tedesco, francese e spagnolo in bozza.
- **Fatto quando:** un test controlla che ogni chiave esista in tutte e 5 le lingue e che ogni termine del lessico abbia la variante per ogni tema.
- **Dipende da:** T27.

### [ ] T29 – Caratteri
- **Obiettivo:** i caratteri dei temi inclusi nell'app, funzionanti offline.
- **Riferimenti:** `design-temi.md` «Caratteri»; `design-sezioni.md` A3.
- **Da fare:** pacchetti `@expo-google-fonts/*` per Manrope, Press Start 2P, VT323, Cinzel, Alegreya, Chakra Petch, Share Tech Mono, IM Fell English SC, Crimson Pro; caricamento all'avvio con la splash screen tenuta finché non sono pronti; i nomi dei caratteri presi dai token del tema.
- **Fatto quando:** `npx expo export --platform android --output-dir dist-check` passa e i file dei caratteri sono nel bundle.
- **Dipende da:** T27.

### [ ] T30 – Store Zustand e avvio dell'app
- **Obiettivo:** caricare database, impostazioni ed eroe all'avvio.
- **Riferimenti:** `stack-tecnologico.md` punto 2; `modello-dati.md` sezione 7.
- **Da fare:** store `hero`, `settings`, `theme` in `src/stores/`; sequenza di avvio: apri il database e applica le migrazioni, chiudi i giorni pendenti, carica le impostazioni e l'eroe; aggiornamento dello store dopo ogni azione del repository.
- **Fatto quando:** i test degli store con il database di test verificano il caricamento iniziale e l'aggiornamento dopo un completamento.
- **Dipende da:** T25, T28.

### [ ] T31 – Navigazione e schermate segnaposto
- **Obiettivo:** lo scheletro navigabile dell'app.
- **Riferimenti:** `analisi-funzionale.md` «Mappa dell'app»; `design-sezioni.md` A6.
- **Da fare:** layout a schede di Expo Router con Oggi, Abitudini, [+], Obiettivi, Statistiche, Profilo (il [+] apre l'editor come foglio); rotte segnaposto per Compagno, Negozio, Impostazioni e Primo avvio; reindirizzamento al Primo avvio se `hasProfile()` è falso. Ogni segnaposto mostra il titolo tradotto e i colori del tema. Icone a linea da `react-native-svg` (copiare gli SVG di base dagli asset quando servono; altrimenti un segnaposto).
- **Fatto quando:** un test con React Native Testing Library verifica le 5 voci della barra e il reindirizzamento; `npx expo export --platform android --output-dir dist-check` passa.
- **Dipende da:** T29, T30.

### [ ] T32 – Codice del prototipo delle notifiche
- **Obiettivo:** preparare il prototipo che Claudio proverà sul telefono (è il punto più delicato dello stack).
- **Riferimenti:** `stack-tecnologico.md` punto 5; `design-sezioni.md` 11.3; `modello-dati.md` 3.9 e 4.4.
- **Da fare:**
  - expo-notifications ed expo-task-manager, con i plugin in `app.json`; categoria con le azioni «Completa» e «Posticipa» che non aprono l'app.
  - Task in background (`registerTaskAsync`) che, alla pressione di «Completa», apre il database e chiama `completeMission` con `source: 'notification'` e `idemKey: 'notif:<id>'`; «Posticipa» riprogramma di 10 minuti, massimo 3 volte.
  - Schermata di prova `app/dev/notifications.tsx`, visibile solo in sviluppo: programma una notifica di prova tra 10 secondi per una missione, mostra gli ultimi eventi del registro e il loro `source`.
  - `eas.json` con il profilo `development` (development build, Android APK).
  - `docs/prova-notifiche.md` con i passi della prova per Claudio: telefono bloccato, offline, app chiusa del tutto, doppio tocco.
- **Fatto quando:** `npm run check` e `npx expo export --platform android --output-dir dist-check` passano; la logica del task in background è una funzione separata testata con il database di test.
- **Dipende da:** T31.

### [ ] T33 – README per il portfolio
- **Obiettivo:** un README che presenti il progetto nei colloqui.
- **Riferimenti:** `stack-tecnologico.md` punto 10 («Portfolio»); `analisi-funzionale.md` «Scopo e vincoli».
- **Da fare:** `README.md` in italiano e inglese: cosa fa l'app, architettura (regole pure, repository, registro degli eventi) con un diagramma in Mermaid, stack, come avviarla, come lanciare i test, stato del progetto.
- **Fatto quando:** i comandi citati nel README esistono in `package.json` e i link interni puntano a file esistenti.
- **Dipende da:** T32.

---

## Task per Claudio (fuori dal loop)

Il loop non li esegue: servono il telefono, un account o una decisione.

| # | Cosa | Quando | Sblocca |
| --- | --- | --- | --- |
| C01 | Installare Node LTS, Git, VS Code e Claude Code; creare il repository su GitHub (pubblico, per il portfolio), clonarlo e copiarci dentro questo pacchetto | Prima di partire | T01 |
| C02 | Avviare il loop (vedi `sviluppo/README.md`) e controllare il Diario ogni tanto, soprattutto i task `[!]` | Dopo C01 | tutto |
| C03 | Fare `git push` dopo qualche task e controllare che la CI su GitHub sia verde | Dopo T03 | – |
| C04 | Confermare gli identificativi dell'app (`ch.ghq.mobile` è provvisorio) | Prima di T32 | build |
| C05 | Confermare quale serie usa il moltiplicatore di XP (scelta minore 2 di `CLAUDE.md`) | Quando vuoi | T09 resta valido |
| C06 | Decidere le proposte aperte di XP e monete (cambi di difficoltà, facili dimezzate, ritardi, completamenti a posteriori) e i valori di badge e ricompense | Prima del secondo backlog | regole in più |
| C07 | Rivedere i contenuti in bozza: modelli di missione, titoli dell'eroe, testi in tedesco, francese e spagnolo | Dopo T21 e T28 | – |
| C08 | Creare l'account Expo, `eas login`, `eas build --profile development --platform android` e installare l'APK sul telefono | Dopo T32 | prova notifiche |
| C09 | Provare il prototipo delle notifiche su Android seguendo `docs/prova-notifiche.md` | Dopo C08 | decisione nativo sì/no |
| C10 | Più avanti: iPhone e Apple Developer Program per provare anche su iOS | Quando Android è avanti | prova iOS |
| C11 | Più avanti: emulatore di Android Studio e Maestro per i test dei flussi completi | Con le schermate | test end-to-end |

---

## Diario

Una riga per task chiuso o bloccato: data, codice, cosa è stato fatto, scelte minori e contenuti da rivedere.

| Data | Task | Esito | Note |
| --- | --- | --- | --- |
| 06/11/2026 | T01 | Fatto | Progetto creato con create-expo-app 5.0.0 (modello `default`, SDK 58: Expo 58.0.23, React Native 0.88.1, React 19.3, TypeScript 6.0), esempi tolti con `reset-project` e rotte spostate da `src/app/` (dove le mette il modello della SDK 58) ad `app/` come da CLAUDE.md. `tsc` passa, `expo-doctor` 20/20 senza avvisi, export Android riuscito. Scelte: identificativi `ch.ghq.mobile` provvisori (C04); dal modello non ho copiato `AGENTS.md` (mette le rotte in `src/app/`, in contrasto con CLAUDE.md), il suo `.claude/settings.json` (attivava il plugin `expo@claude-plugins-official`), `README.md` (arriva col T33) e `LICENSE` (MIT intestata a 650 Industries/Expo: la licenza la sceglie Claudio); aggiunto `.claude/settings.local.json` al `.gitignore`; messaggio di commit col titolo del task in inglese, come chiede CLAUDE.md. Al primo giro i file non tracciati erano solo il pacchetto iniziale (CLAUDE.md, docs/, .claude/): li ho trattati come punto di partenza del T01, non come modifiche da controllare. `npm audit`: 5 vulnerabilità moderate in glob e minimatch dentro gli strumenti di Expo (@expo/cli, @expo/fingerprint); la correzione forzata scenderebbe a Expo 53, quindi non applicata. |
| 06/11/2026 | T02 | Fatto | `npm run check` funziona: ESLint 9 con `eslint-config-expo` (installato da `npx expo lint`) ed `eslint-config-prettier`, Prettier 3, Jest 30 con `jest-expo` 58, React Native Testing Library 14 con `test-renderer`, alias `@/` anche in Jest e soglia del 90% sulle righe per `src/rules/`; il test d'esempio è su `clamp` in `src/rules/`, una funzione pura generica utile per valori limitati come vita e livelli. Verificato che falliscono un errore di tipo voluto, un avviso di ESLint, un file non formattato e un file di regole non testato; un test di componente di prova passa (poi rimosso). Scelte: TypeScript 6 non carica più da solo i pacchetti `@types`, quindi `types: ["jest"]` in `tsconfig.json`; Prettier con apici singoli e righe da 100, come il codice del modello Expo; `docs/`, `CLAUDE.md`, `.claude/`, `assets/` e `package-lock.json` esclusi da Prettier, così `npm run format` non tocca i documenti; ESLint controlla `app/`, `src/` e `test/` e fallisce anche sugli avvisi (`--max-warnings 0`); `npm test` calcola sempre la copertura (per lanciare un solo file: `npx jest <file>`); `coverage/` nel `.gitignore`. Nota per i task dei componenti: in Testing Library 14 `render` è asincrono (`await render(...)`). `npm audit`: 31 segnalazioni (30 moderate, 1 bassa) in glob, minimatch e deepmerge dentro gli strumenti di sviluppo (expo, jest, jest-expo, eslint-config-expo), non corrette. |
| 06/11/2026 | T03 | Fatto | Creato `.github/workflows/ci.yml`: su push e pull request usa `actions/checkout@v7` e `actions/setup-node@v7` con Node `lts/*` e cache di npm, poi `npm ci` e `npm run check`; permessi in sola lettura e limite di 15 minuti. Verifica: il pacchetto `yaml` 2.9.1, installato solo in una cartella temporanea e non nel progetto, legge il file senza errori né avvisi, e gli script richiamati esistono in `package.json`; in locale passano anche `npm ci` e `CI=true npm run check`. Nota: oggi `lts/*` è Node 26, mentre in locale c'è Node 22; la SDK 58 li supporta entrambi. Il primo giro della CI su GitHub lo vede Claudio dopo il push (C03). |
| 06/11/2026 | T04 | Fatto | Creati `src/rules/types.ts` (`Difficulty`, `StatKey`, `GameDay`, `Deltas`, con gli elenchi `DIFFICULTIES` e `STAT_KEYS`) e `src/rules/config.ts` con tutti i valori dell'elenco del task, in sola lettura; `config.test.ts` ha un caso per ogni tabella dei documenti citati più uno per ogni elenco di regole (bonus, vita, boss, compagno, salti, freccia di forma). Scelte: oltre all'elenco ho messo in configurazione le altre costanti che i documenti citati definiscono, perché CLAUDE.md vuole ogni costante in `config.ts`: coefficienti delle curve dei livelli (50 × (n + 3)) e delle statistiche (100 × (n + 1)), titolo ogni 5 livelli, 10 punti statistica per passo di boss, 10 XP per passo e 1 moneta ogni 5 XP alla vittoria, massimo 3 priorità nel Piano, XP × 0,5 da esausto, freccia di forma (30 giorni, 10%, nascosta nei primi 30 giorni); la vita dopo l'esaurimento è calcolata come 25% della massima arrotondato per eccesso (13), come dice la regola; `GameDay` è un tipo `${number}-${number}-${number}`, che rifiuta già in compilazione un istante completo. Non configurati: la colonna «Vita tolta se mancata», sostituita dalla regola della vita; le proposte non approvate; monete dei badge e prezzi di regali e ricompense, ancora da definire; il limite di 3 boss attivi, che sta nella sezione 5 dell'analisi e arriverà col T12. Nessuna incoerenza trovata tra i documenti. |
| 06/11/2026 | T05 | Fatto | Creato `src/rules/gameDay.ts` con `toGameDay`, `addDays`, `diffDays`, `weekday`, `weekStartOf` e `daysBetween`, più `isGameDay` (vero solo per una data reale `AAAA-MM-GG`) e il tipo `Weekday`; solo aritmetica UTC, nessuna libreria di date. I 28 test coprono tutti i casi del task con i cambi d'ora reali di Roma del 2026 (verificati col database dei fusi di Node), un fuso da mezz'ora e gli input non validi, e passano con la macchina impostata su 5 fusi diversi. Scelte da confermare: `tzOffsetMinutes` è in minuti a est di UTC (ora locale = UTC + offset, Roma +60 d'inverno), cioè col segno opposto a `getTimezoneOffset()` di JavaScript; il modello dati non fissa il segno di `tz_offset`, quindi conviene usare la stessa convenzione anche nel registro. `weekStart` è un numero da 1 (lunedì) a 7 (domenica) come `weekday`; il formato di `week_start` nelle impostazioni lo fissa il T19. `daysBetween` esclude entrambi gli estremi, perché restituisce i giorni da chiudere tra l'ultimo chiuso e oggi, ed è vuota quando il secondo giorno viene prima, come dopo un volo verso ovest. |
| 06/11/2026 | T06 | Fatto | Creato `src/rules/frequency.ts` con `frequencySchema` (unione discriminata Zod con le 6 forme del modello dati, chiavi sconosciute rifiutate), il tipo `Frequency` ricavato con `z.infer`, `isScheduled` e `isDueToday`; installato `zod` 4.6.7 con `npx expo install`, perché serviva già qui (il T16 lo troverà installato). I 31 test coprono ogni forma e tutti i casi del task. Interpretazioni da confermare: il contesto contiene `weekStart` e `completedDays`, cioè i giorni di gioco in cui la missione è stata completata; per `times_per_week` contano solo i completamenti della settimana fatti prima del giorno, così la missione resta visibile, come fatta, nel giorno in cui raggiunge N e sparisce dal giorno dopo; `paused_until` è il primo giorno di nuovo attivo, perché US-ABI-02 dice che «alla scadenza la missione si riattiva da sola»; un'attività singola completata oggi resta tra le missioni di oggi, segnata come fatta; un'attività singola senza scadenza non compare in Oggi, perché US-OGGI-01 elenca solo quelle in scadenza oggi o scadute. Zod rifiuta anche giorni della settimana ripetuti, `times` oltre 7 (irraggiungibile in una settimana) e date annuali inesistenti come il 30 febbraio. Note per il T14: `isDueToday` non guarda la data di creazione, quindi la chiusura non dovrà contare i giorni prima che la missione esistesse; inoltre i documenti dicono che una `times_per_week` appare ogni giorno finché non raggiunge N, ma non dicono se un giorno in cui non la si fa toglie vita. |
| 06/11/2026 | T07 | Fatto | Creato `src/rules/level.ts` con `xpToNext`, `applyXp`, `titleIndex` e in più `heroLevelFromXp`, che ricava livello e XP nel livello dagli XP totali (servirà anche alla ricostruzione dal registro del T26); i coefficienti vengono da `config.ts`. I 16 test verificano la tabella «Livelli» del documento, la salita di più livelli in un colpo, la discesa con annullamento (anche da 50 a 49), il tetto a 50 e gli 11 titoli ai livelli 1, 5, 10 … 50. Scelte: `applyXp` ricalcola sempre livello e XP nel livello dagli XP totali, così il risultato è coerente anche se lo stato di partenza non lo era, e un annullamento al livello 50 fa scendere di livello solo se gli XP totali tornano sotto 68.600; al livello 50 `xp_in_level` resta 0; XP e variazioni devono essere interi, altrimenti la funzione li rifiuta. |
