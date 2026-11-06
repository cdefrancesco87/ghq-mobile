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

### [x] T08 – Statistiche dell'eroe
- **Obiettivo:** punti e livelli delle 6 statistiche.
- **Riferimenti:** `statistiche-eroe.md` (tutto).
- **Da fare:** in `src/rules/stats.ts`: `statPoints(difficulty, primary, secondary)` (10/20/30 e 30% per difetto; nessun punto senza principale); `statLevel(points)` con la curva 100 × (n+1), tetto 10 con punti che si accumulano; `formArrow(last30, prev30, daysOfUse)` (↑ con +10%, ↓ con −10%, niente nei primi 30 giorni).
- **Fatto quando:** i test verificano la tabella «Punti totali» del documento (livello 1 a 100, 2 a 300, 3 a 600, 5 a 1.500, 10 a 5.500), la secondaria uguale alla principale rifiutata, la freccia ai bordi del 10%.
- **Dipende da:** T04.

### [x] T09 – Ricompense di un completamento
- **Obiettivo:** calcolare le variazioni di un completamento, uguali da app, notifica, widget e salute.
- **Riferimenti:** `xp-e-monete.md` sezione 1 («Quanti XP», «Bonus», «Quando si ottengono»); `analisi-funzionale.md` «Regole di gioco»; `CLAUDE.md` scelte minori 1, 2 e 3.
- **Da fare:** in `src/rules/completion.ts`: `completionDeltas({difficulty, heroStreak, exhausted, statPrimary, statSecondary})` → XP, monete, +1 vita, punti statistica, danno al boss; `measurableProgress({value, step, target})` che dice quando il valore raggiunge l'obiettivo (le ricompense arrivano una volta sola, superare l'obiettivo non dà altro).
- **Fatto quando:** i test coprono le 3 difficoltà, le soglie di serie 6/7/29/30/99/100 giorni, il moltiplicatore che non tocca le monete, l'esausto con XP dimezzati, la misurabile che passa da parziale a fatta e oltre.
- **Dipende da:** T07, T08.

### [x] T10 – Vita, giornata completa, Piano e salti
- **Obiettivo:** le regole della vita e dei bonus del giorno.
- **Riferimenti:** `analisi-funzionale.md` «Regole di gioco» (Vita, Bonus) e US-OGGI-02, US-OGGI-06; `design-sezioni.md` 2.3 e 2.7; `CLAUDE.md` scelte minori 3, 4 e 6.
- **Da fare:** in `src/rules/day.ts`: `hpLoss({scheduledXp, missedXp, isRestDay, gameMode})` (massimo 10, nessuna perdita a riposo o in Essenziale); `applyHp(hp, delta)` tra 0 e 50; `isFullDay(scheduled, done)` (falso con zero missioni previste); `isPlanComplete(plan, done)` (falso con zero priorità); `canAddToPlan(plan)` (massimo 3); `skipsLeft(skipsThisWeek)` (massimo 3).
- **Fatto quando:** i test riproducono l'esempio del documento (2 medie mancate su 5 previste tolgono 4 punti), il tetto di 10, il giorno di riposo, Essenziale, vita che non supera 50 con pozione e bonus.
- **Dipende da:** T09.

### [x] T11 – Serie dell'eroe e delle missioni
- **Obiettivo:** calcolare le serie, con riposo, salti e scudi.
- **Riferimenti:** `analisi-funzionale.md` «Regole di gioco», Serie.
- **Da fare:** in `src/rules/streak.ts`: `nextHeroStreak({streak, best}, dayOutcome)` con esiti `done`, `rest`, `missed`, `missed_with_shield`; `nextMissionStreak({streak, best}, occurrence)` con esiti `done`, `skipped`, `missed`, `missed_with_shield`, `not_scheduled`.
- **Fatto quando:** i test coprono: un giorno di riposo che mantiene senza crescere; «Salta oggi» che non spezza e non fa crescere; lo scudo che salva entrambe le serie; i giorni non previsti che non contano; il record che si aggiorna.
- **Dipende da:** T05.

### [x] T12 – Boss
- **Obiettivo:** vita, danni, vittoria e scadenza dei boss.
- **Riferimenti:** `analisi-funzionale.md` «Regole di gioco», Boss, e sezione 5; `xp-e-monete.md` «Bonus» e «Quando si perdono»; `statistiche-eroe.md` (punti dei passi).
- **Da fare:** in `src/rules/boss.ts`: `bossHpMax(steps)`; `applyBossDamage({hp, stepsLeft}, damage)` con il minimo di 10 × passi rimanenti (la vittoria richiede l'ultimo passo); `victoryReward(steps, difficulty)`; `deadlineSteal(coins)`; `shouldWarnDeadline(today, deadline, warned)`; `canCreateBoss(activeCount)` (massimo 3); punti statistica di un passo (10 alla statistica del boss, se c'è).
- **Fatto quando:** i test coprono: un boss di 8 passi con 160 vita; danni di missioni che non scendono sotto il minimo; l'ultimo passo che sconfigge; ricompensa di un boss medio di 4 passi (60 XP, 12 monete); furto con 300 monete (30) e con 8.000 (500); avviso a 3 giorni una volta sola.
- **Dipende da:** T04.

### [x] T13 – Compagno
- **Obiettivo:** stadio e umore del compagno.
- **Riferimenti:** `analisi-funzionale.md` «Regole di gioco», Compagno, e sezione 6; `design-sezioni.md` 6.3; `modello-dati.md` 3.2.
- **Da fare:** in `src/rules/companion.ts`: `stageFor(completionsTotal)` (uovo, cucciolo, adulto; mai all'indietro); `moodFor(lastThreeDays)` (felice sopra il 70%, normale tra 30 e 70, triste sotto il 30; senza giorni previsti, normale). I regali (Could) non si fanno ora.
- **Fatto quando:** i test coprono 0, 1, 149 e 150 completamenti e i bordi esatti del 30% e del 70%.
- **Dipende da:** T04.

### [x] T14 – Chiusura dei giorni
- **Obiettivo:** la funzione pura che chiude uno o più giorni passati, anche dopo giorni senza aprire l'app.
- **Riferimenti:** `modello-dati.md` 3.7 e sezione 5; `analisi-funzionale.md` «Regole di gioco» (Vita, Serie); `CLAUDE.md` scelta minore 3.
- **Da fare:** in `src/rules/closeDays.ts`: `closeDays({lastClosedDay, today, missions, missionDays, hero, inventory, settings})` che, per ogni giorno intero tra l'ultimo chiuso e oggi, calcola il riepilogo (`scheduled_count`, `done_count`, `scheduled_xp`, `missed_xp`, `hp_lost`, `is_rest_day`, `shield_used`…), consuma lo scudo nel primo giorno mancato, aggiorna le serie, gestisce esausto e ritorno a 13. Restituisce l'elenco dei riepiloghi e delle variazioni, senza scrivere niente.
- **Fatto quando:** i test coprono: nessun giorno da chiudere; 5 giorni chiusi in un colpo; idempotenza (rieseguire non cambia niente); un volo che non crea giorni falsi; un giorno con vita a 0 seguito dal giorno esausto; uno scudo usato e il secondo no.
- **Dipende da:** T06, T10, T11.

### [x] T15 – Annullamento
- **Obiettivo:** sapere cosa e fino a quando si può annullare.
- **Riferimenti:** `analisi-funzionale.md` US-OGGI-04; `modello-dati.md` 4.3; `CLAUDE.md` scelte minori 4 e 5.
- **Da fare:** in `src/rules/undo.ts`: `canUndo(eventGameDay, today)` (solo nella stessa giornata di gioco); `revertDeltas(deltas)` con i segni opposti; elenco dei bonus da annullare insieme (giornata completa e Piano) quando il giorno torna incompleto.
- **Fatto quando:** i test coprono l'annullamento prima e dopo il cambio di giornata e un annullamento che toglie anche il bonus del giorno.
- **Dipende da:** T09, T10.

---

## Fase 2 – Database e azioni di gioco

### [x] T16 – Schema completo e prima migrazione
- **Obiettivo:** tutte le tabelle del modello dati in Drizzle.
- **Riferimenti:** `modello-dati.md` sezioni 2, 3, 4.1, 6 e 8.
- **Da fare:**
  - Installa `drizzle-orm`, `expo-sqlite` (con `npx expo install`), `zod`, `uuidv7`; in sviluppo `drizzle-kit`, `better-sqlite3`, `@types/better-sqlite3`.
  - `src/db/schema.ts` con tutte le tabelle: `hero`, `hero_stats`, `companion`, `settings`, `boss`, `boss_steps`, `missions`, `mission_reminders`, `mission_days`, `day_plan`, `day_summaries`, `inventory` (con `CHECK` sugli scudi ≤ 2), `badges`, `app_notifications`, `scheduled_reminders`, `events`. Le tabelle `rewards` (Could) non si fanno ora.
  - `drizzle.config.ts` con `dialect: 'sqlite'` e `driver: 'expo'`; genera la prima migrazione.
- **Fatto quando:** `npx drizzle-kit generate` crea `drizzle/0000_*.sql` senza errori; i tipi `typeof missions.$inferSelect` compilano; il campo `frequency` usa il tipo `Frequency` del T06.
- **Dipende da:** T06.

### [x] T17 – Client del database e database di test
- **Obiettivo:** aprire il database nell'app e nei test con le stesse migrazioni.
- **Riferimenti:** `modello-dati.md` sezioni 6 (PRAGMA) e 8.
- **Da fare:**
  - `src/db/client.ts`: apertura con expo-sqlite, `PRAGMA foreign_keys = ON` e `journal_mode = WAL`, `migrate()` all'avvio; copia di sicurezza del file prima di una migrazione e ripristino se fallisce (la parte sui file dietro una piccola interfaccia, così si testa).
  - `src/db/types.ts`: il tipo del database comune a expo-sqlite e better-sqlite3.
  - `test/db.ts`: `createTestDb()` con better-sqlite3 in memoria, che applica le stesse migrazioni SQL di `drizzle/`.
- **Fatto quando:** un test applica tutte le migrazioni da zero; un test simula una migrazione che fallisce e verifica il ripristino; `npx expo export --platform android --output-dir dist-check` passa.
- **Dipende da:** T16.

### [x] T18 – Registro in sola aggiunta e vincoli speciali
- **Obiettivo:** rendere impossibile modificare o cancellare il registro.
- **Riferimenti:** `modello-dati.md` 3.8 e 4.3.
- **Da fare:** migrazione personalizzata (`npx drizzle-kit generate --custom`) con i due trigger che rifiutano `UPDATE` e `DELETE` su `events` e l'indice parziale sui boss attivi.
- **Fatto quando:** un test su better-sqlite3 applica le migrazioni e verifica che `UPDATE` e `DELETE` su `events` falliscano e che `INSERT` funzioni.
- **Dipende da:** T17.

### [x] T19 – Impostazioni
- **Obiettivo:** leggere e scrivere le impostazioni validate.
- **Riferimenti:** `modello-dati.md` 3.10; `design-sezioni.md` sezione 10 (valori predefiniti).
- **Da fare:** `src/db/repositories/settings.ts` con uno schema Zod e un valore predefinito per ogni chiave (`language`, `theme` = minimal, `game_mode` = full, `day_change` = 06:00, `week_start` = lunedì, `rest_days`, `quiet_hours`, `evening_summary`, `reduce_motion`, `colorblind`, `backup`, `device_id`); `getSetting`, `setSetting`; il cambio di `day_change` vale da domani (`{ value, next, from_day }`).
- **Fatto quando:** i test coprono valori predefiniti, valore non valido rifiutato e cambio dell'orario che vale dal giorno dopo.
- **Dipende da:** T17.

### [x] T20 – Scrittura degli eventi e idempotenza
- **Obiettivo:** il mattone comune di ogni azione di gioco.
- **Riferimenti:** `modello-dati.md` 4.1, 4.2, 4.3 e 4.5 (`notDeleted`).
- **Da fare:** `src/db/repositories/events.ts`: `appendEvent(tx, input)` con UUID v7, `tz_offset`, `game_day`, `device_id` dalle impostazioni, chiave di idempotenza (se esiste già restituisce «già registrato» senza errori); i tipi di evento del modello come unione TypeScript; `notDeleted(missions)`.
- **Fatto quando:** i test verificano che lo stesso `idem_key` scritto due volte produca una sola riga e che gli UUID siano ordinati nel tempo.
- **Dipende da:** T18, T19.

### [x] T21 – Contenuti fissi: modelli, negozio, titoli
- **Obiettivo:** i contenuti uguali per tutti, nel codice e tipizzati.
- **Riferimenti:** `analisi-funzionale.md` US-ONB-03; `design-sezioni.md` 1.5, 4.11, 7 e 9.3; `statistiche-eroe.md` «Le sei statistiche»; `modello-dati.md` sezione 1.
- **Da fare:** `src/content/templates.ts` con almeno 12 modelli in 4 categorie (Salute, Mente, Lavoro e studio, Casa), ognuno con chiave, frequenza, difficoltà, statistica e obiettivo; i 3 consigliati (Bevi 2 litri d'acqua, Leggi 20 pagine, Meditazione 10 min) segnati. `src/content/shop.ts` con pozione e scudo. `src/content/titles.ts` con 11 chiavi di titolo per tema (i testi vanno nelle lingue, al T28). Contenuti in bozza secondo la scelta minore 7.
- **Fatto quando:** un test valida ogni modello con lo schema della frequenza e controlla che le statistiche siano valide.
- **Dipende da:** T06.

### [x] T22 – Primo avvio: creazione del profilo
- **Obiettivo:** creare eroe, statistiche, compagno, missioni scelte e quest di partenza in una transazione.
- **Riferimenti:** `analisi-funzionale.md` sezione 1 (US-ONB-00…05); `design-sezioni.md` 1.7 e 1.8; `modello-dati.md` 8 («Dati di partenza»).
- **Da fare:** `src/db/repositories/onboarding.ts`: `createProfile({name, language, theme, templateKeys})` crea `hero`, le 6 righe di `hero_stats`, il compagno uovo, le missioni dai modelli (da 1 a 5), il boss `starter` con 3 passi (crea la prima abitudine già fatta, completala, apri le statistiche) e gli eventi relativi. `hasProfile()`.
- **Fatto quando:** i test verificano tutte le righe create, il primo passo già segnato, il rifiuto di 0 o 6 modelli e di un nome vuoto, e che l'eroe coincida con la somma del registro.
- **Dipende da:** T20, T21.

### [x] T23 – Missioni: creare, modificare, pausa, archivio, eliminazione
- **Obiettivo:** il ciclo di vita delle missioni.
- **Riferimenti:** `analisi-funzionale.md` sezioni 3 e 4; `modello-dati.md` 3.3 e 4.5.
- **Da fare:** `src/db/repositories/missions.ts`: `createMission`, `updateMission` (difficoltà e statistica valgono dai completamenti successivi), `pauseMission` con data di fine, `resumeMission`, `archiveMission`, `restoreMission`, `deleteMission` (cancellazione logica: `deleted_at`, promemoria e righe future di `day_plan` cancellati, evento `mission.deleted`), `listTodayMissions(day)` che usa `isDueToday`.
- **Fatto quando:** i test coprono ogni azione con il suo evento, la missione eliminata che sparisce dalle liste ma lascia `mission_days` ed eventi, e la validazione della frequenza con Zod.
- **Dipende da:** T22.

### [x] T24 – Completare, avanzare, saltare, Piano del giorno
- **Obiettivo:** l'azione più importante dell'app, identica da ogni origine.
- **Riferimenti:** `modello-dati.md` 3.5, 3.6 e 4.4; `analisi-funzionale.md` sezione 2; `CLAUDE.md` scelte minori 1–4.
- **Da fare:** `src/db/repositories/completion.ts`:
  - `completeMission({missionId, source, idemKey, now})` in una transazione: evento, `mission_days`, eroe (XP, livello con evento `hero.level_up`, monete, vita), statistiche, compagno (con `companion.stage_up` alla schiusa), serie della missione, danno al boss collegato (e vittoria), bonus giornata completa e Piano se scattano, cancellazione di `scheduled_reminders` di quel giorno;
  - `progressMission` per le misurabili (parziale finché non si raggiunge l'obiettivo);
  - `skipMission` con motivo e limite di 3 a settimana;
  - `setDayPlan` / `removeFromDayPlan` con il limite di 3.
- **Fatto quando:** i test coprono: lo stesso completamento arrivato da notifica e da app che conta una volta; XP con serie e con esausto; schiusa al primo completamento; boss sconfitto dall'ultimo passo; bonus giornata completa e Piano; quarto posto del Piano rifiutato; quarto salto rifiutato; eroe uguale alla somma del registro dopo ogni test.
- **Dipende da:** T09, T10, T12, T13, T23.

### [x] T25 – Annullare, chiudere i giorni, boss e negozio
- **Obiettivo:** le altre azioni che cambiano l'eroe.
- **Riferimenti:** `modello-dati.md` 3.7, 3.8, 3.9 e 4.3; `analisi-funzionale.md` sezioni 5 e 7; `xp-e-monete.md` sezione 2.
- **Da fare:**
  - `undoEvent(eventId)`: evento `event.reverted` con i delta opposti, `mission_days` ripristinato, boss, statistiche, livello, bonus del giorno; rifiutato dopo il cambio di giornata.
  - `closePendingDays(now)`: usa `closeDays` del T14 e scrive `day_summaries` ed eventi `day.closed` e `shield.consumed`.
  - Boss: `createBoss` (massimo 3 attivi), `completeBossStep`, `archiveBoss`, `checkBossDeadlines(today)` con avviso e furto.
  - Negozio: `buyItem` (monete sufficienti, massimo 2 scudi), `usePotion`.
- **Fatto quando:** i test coprono ogni azione e i suoi rifiuti; la chiusura rieseguita non cambia niente; un annullamento dopo il cambio di giornata è rifiutato; eroe uguale alla somma del registro dopo ogni test.
- **Dipende da:** T14, T15, T24.

### [x] T26 – Ricostruzione dal registro e partita simulata
- **Obiettivo:** la garanzia che stato ed eventi non divergano mai.
- **Riferimenti:** `modello-dati.md` 4.3 («Ricostruzione») e 11.
- **Da fare:** `rebuildHeroFromEvents(db)` (la funzione di riparazione) e un test che simula 90 giorni di gioco con un generatore pseudo-casuale a seme fisso: crea missioni e boss, completa, annulla, salta, compra, usa pozioni, chiude i giorni. A ogni giorno controlla le invarianti: monete ≥ 0, vita tra 0 e 50, livello tra 1 e 50, scudi ≤ 2, eroe e statistiche uguali alla somma del registro.
- **Fatto quando:** il test passa con 3 semi diversi in meno di 30 secondi.
- **Dipende da:** T25.

---

## Fase 3 – Base dell'app

### [x] T27 – Temi
- **Obiettivo:** i 6 temi come token tipizzati, disponibili in tutta l'app.
- **Riferimenti:** `temi.json`; `design-temi.md`; `design-sezioni.md` A3 e A4; `stack-tecnologico.md` punto 8.
- **Da fare:** copia `temi.json` in `src/theme/`, tipi ricavati dal file, `ThemeProvider` con il Context di React e `useTheme()`; Minimal segue chiaro o scuro del telefono; il tema scelto si legge dalle impostazioni.
- **Fatto quando:** un test verifica che ogni tema abbia gli stessi token e che ogni coppia testo/sfondo dichiarata abbia contrasto almeno 4,5:1 (le coppie che non passano vanno nel Diario, senza cambiare i colori); un test con React Native Testing Library verifica il cambio di tema.
- **Dipende da:** T19.

### [x] T28 – Lingue e lessico dei temi
- **Obiettivo:** i testi in 5 lingue con le varianti di ogni tema.
- **Riferimenti:** `stack-tecnologico.md` punto 9; `temi.json` («lessico»); `statistiche-eroe.md` «Nomi per tema»; `design-sezioni.md` A10.
- **Da fare:** i18next, react-i18next ed expo-localization (lingua del telefono se è una delle 5, altrimenti inglese); file `it`, `en`, `de`, `fr`, `es`; lessico dei temi con il contesto di i18next (`missions_fantasy`…, la forma base come ripiego); nomi delle statistiche per tema. Italiano dai documenti, inglese tradotto; tedesco, francese e spagnolo in bozza.
- **Fatto quando:** un test controlla che ogni chiave esista in tutte e 5 le lingue e che ogni termine del lessico abbia la variante per ogni tema.
- **Dipende da:** T27.

### [x] T29 – Caratteri
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
| 06/11/2026 | T08 | Fatto | Creato `src/rules/stats.ts` con `statPoints`, `statLevel`, `formArrow` e in più `statPointsToNext` (100 × (n + 1), l'equivalente di `xpToNext` per le statistiche); i valori vengono da `config.ts`. I 17 test verificano la tabella «Punti totali», il tetto a 10 con i punti che continuano ad accumularsi, la secondaria uguale alla principale rifiutata e la freccia esattamente ai bordi del 10%. Scelte: `formArrow` restituisce `'up'`, `'down'` o `null`; `daysOfUse` conta il primo giorno d'uso come 1, quindi la freccia può comparire dal 31° giorno; se nei 30 giorni precedenti non ci sono punti, qualsiasi punto negli ultimi 30 dà ↑; una missione con la sola secondaria e senza principale non dà punti, come dice il documento. |
| 06/11/2026 | T09 | Fatto | Creato `src/rules/completion.ts` con `completionDeltas` (XP, monete, +1 vita, punti statistica e danno al boss) e `measurableProgress`, più `streakMultiplier` e `roundXp`. I 12 test coprono le 3 difficoltà, le soglie di serie 6/7/29/30/99/100, il moltiplicatore che tocca solo gli XP, l'esausto con XP dimezzati (12,5 → 13) e la misurabile che passa da parziale a fatta e oltre. Scelte: l'unico arrotondamento degli XP (scelta minore 1) toglie prima il rumore dei decimali binari, perché con un moltiplicatore tarato a 1,15 `Math.round(50 × 1,15)` darebbe 57 invece di 58; con i valori attuali il risultato è identico al calcolo diretto (verificato su 1.600 combinazioni). Da esausto si dimezzano solo gli XP, mentre monete, vita, statistiche e danno al boss restano pieni, perché il documento dice soltanto «guadagna metà XP». `measurableProgress` riceve il valore raggiunto e un passo positivo, perché le correzioni passano dall'annullamento, e con `completesNow` segnala l'unico passo che raggiunge l'obiettivo. `completionDeltas` restituisce sempre il danno della tabella: lo applica solo chi ha un boss collegato (T24). |
| 06/11/2026 | T10 | Fatto | Creato `src/rules/day.ts` con `hpLoss`, `applyHp`, `isFullDay`, `isPlanComplete`, `canAddToPlan` e `skipsLeft`; aggiunto a `types.ts` il tipo `GameMode` con i valori `full` ed `essential` (i documenti non li fissano: il T19 dovrà usare gli stessi). I 21 test coprono l'esempio del documento (4 punti), il tetto di 10, l'arrotondamento a metà per eccesso, il riposo, Essenziale e la vita tra 0 e 50 con pozione e bonus. `isFullDay` e `isPlanComplete` ricevono gli id delle missioni. Punti aperti per T14 e T24: non è definito se le missioni saltate contano tra le «previste» nel denominatore della vita persa, né se una missione saltata impedisce la giornata completa. |
| 06/11/2026 | T11 | Fatto | Creato `src/rules/streak.ts` con `nextHeroStreak` e `nextMissionStreak`, che restituiscono serie e record; gli esiti possibili sono negli elenchi `DAY_OUTCOMES` e `OCCURRENCES`. I 13 test coprono il riposo che mantiene senza far crescere, «Salta oggi» che non spezza e non fa crescere, lo scudo che salva entrambe le serie, i giorni non previsti che non contano e il record che si aggiorna. Scelta: lo scudo salva la serie ma non la fa crescere, come il riposo, perché il documento dice solo che la «salva». Nota per il T14: la serie dell'eroe conta i giorni con almeno un completamento, quindi un giorno senza missioni previste e senza completamenti la spezzerebbe; va deciso se trattarlo così o come un riposo. |
| 06/11/2026 | T12 | Fatto | Creato `src/rules/boss.ts` con `bossHpMax`, `applyBossDamage`, `victoryReward`, `deadlineSteal`, `shouldWarnDeadline`, `canCreateBoss` e `stepStatPoints`; aggiunti a `config.ts`, e al suo test, il massimo di 3 boss attivi e il limite da 2 a 20 passi della sezione 5 dell'analisi. I 22 test coprono tutti i casi del task. Incoerenza nei documenti: la sezione 5 dell'analisi dice che la vita del boss è «calcolata dai passi e dalla difficoltà», mentre le «Regole di gioco» approvate e il modello dati dicono passi × 20; ho seguito le regole approvate (8 passi = 160 vita, come nel task), quindi la difficoltà cambia solo la ricompensa. Scelte: in `applyBossDamage` i passi rimanenti si contano dopo il colpo; quando non ne restano il boss è sconfitto anche se i dati non tornano, così non resta mai un boss senza passi ma ancora vivo; un colpo non fa mai risalire la vita. L'avviso di scadenza parte una volta sola, da 3 giorni prima fino al giorno della scadenza, così arriva anche se l'app non è stata aperta proprio quel giorno. |
| 06/11/2026 | T13 | Fatto | Creato `src/rules/companion.ts` con `stageFor` e `moodFor`, più gli stadi `egg`, `baby` e `adult` del modello dati. I 10 test coprono 0, 1, 149 e 150 completamenti e i bordi esatti del 30% e del 70%, che danno umore normale. Scelte: `stageFor` riceve anche lo stadio attuale e non torna mai indietro, nemmeno quando un annullamento abbassa il conteggio, perché US-COMP-02 dice che «il compagno non perde mai stadi»; l'umore è la quota delle missioni fatte sul totale delle previste negli ultimi 3 giorni chiusi, come nella frase «hai completato il 55% delle missioni» del design 6.3. Incoerenza nei documenti: US-COMP-02 dice che l'umore «torna felice dopo un giorno con almeno una missione completata» e il design 6.3 promette «Completa una missione oggi e tornerà felice», mentre le «Regole di gioco» e il task usano solo le soglie del 70% e del 30%; ho seguito il task, va deciso quale regola vale. |
| 06/11/2026 | T14 | Bloccato | La chiusura dei giorni richiede quattro regole che i documenti e CLAUDE.md non definiscono, e CLAUDE.md chiede di non inventarle. Per sbloccare serve una decisione di Claudio su: (1) Scudo: il «giorno mancato» che lo consuma è un giorno senza nessun completamento, quando si spezzerebbe la serie dell'eroe («Serie» nelle Regole di gioco e design 2.8, «Lo scudo ha protetto la tua serie ieri»), oppure basta una missione prevista e non fatta (US-OGGI-06: oltre i 3 salti di una missione «servono gli scudi della serie»)? (2) «N volte a settimana»: un giorno in cui non è fatta e N non è ancora raggiunto conta come mancata, con vita persa e serie spezzata, oppure no, e allora quando è mancata (per esempio a fine settimana)? (3) Attività singole scadute: tolgono vita solo il giorno della scadenza, ogni giorno finché non sono fatte, oppure mai (la Proposta «Attività singole in ritardo» non è approvata)? (4) Serie dell'eroe in un giorno senza missioni previste che non è di riposo: si spezza, come dice alla lettera «giorni consecutivi con almeno una missione completata», o resta come in un giorno di riposo? Già chiarito dai documenti, per il prossimo tentativo: nei giorni di riposo nessuna missione è prevista (design 10.5); le missioni saltate e in pausa non contano nel totale del giorno (design 8.3), quindi restano fuori da `scheduled_xp`; alla chiusura del giorno esausto la vita torna a 13 (scelta minore 3). Restano in attesa anche il T25 e i task che ne dipendono (T26, T30–T33). Da allineare a parte: il design 4.6 limita «N volte a settimana» a 1–6 e «Ogni N giorni» a 2–30, mentre lo schema del T06 accetta 1–7 e da 1 in su. Nessun codice scritto, quindi niente da mettere da parte con `git stash`. |
| 06/11/2026 | T15 | Fatto | Creato `src/rules/undo.ts` con `canUndo`, `revertDeltas` e `bonusesToRevert`, che dice quali bonus del giorno (`bonus.full_day`, `bonus.plan`) togliere insieme a un annullamento quando il giorno o il Piano tornano incompleti (scelta minore 4). Gli 11 test coprono l'annullamento alle 5:59 e alle 6:00 del giorno dopo, un annullamento che toglie anche i bonus del giorno, i segni opposti e il doppio annullamento. Scelte: `canUndo` accetta solo lo stesso giorno di gioco, quindi dopo un volo verso ovest che riporta indietro il giorno non si annulla un evento di quello che ora è «domani»; `revertDeltas` nega le variazioni registrate, quindi i completamenti dovranno registrare quelle applicate davvero (per esempio +2 vita se il bonus ha toccato il tetto di 50); il livello che scende con gli XP (scelta minore 5) è già garantito da `applyXp` del T07. I documenti parlano solo di annullare completamenti: quali altri eventi si possono annullare lo decideranno i repository (T25). |
| 06/11/2026 | T16 | Fatto | Creati `src/db/schema.ts` con le 16 tabelle del modello dati (senza `rewards`), `drizzle.config.ts` (`dialect: 'sqlite'`, `driver: 'expo'`) e la prima migrazione `drizzle/0000_initial_schema.sql`, generata col nome `initial_schema` invece di quello casuale; installati `drizzle-orm` 0.45, `expo-sqlite` e `uuidv7` e, in sviluppo, `drizzle-kit`, `better-sqlite3` e `@types/better-sqlite3` (`expo install` ha aggiunto il plugin di `expo-sqlite` in `app.json`). `schema.test.ts` controlla tabelle e vincoli e, tramite `npm run typecheck`, che `frequency` abbia il tipo `Frequency` e che una riga di `missions` vada bene per `isDueToday`. Verificato a parte su better-sqlite3 che la migrazione si applica e che ogni vincolo rifiuta il dato sbagliato. Scelte: le colonne dei giorni di gioco hanno il tipo `GameDay` e quelle delle statistiche `StatKey`; le colonne a scelta usano gli elenchi delle regole (`DIFFICULTIES`, `STAT_KEYS`, `COMPANION_STAGES`); `companion` ha una colonna `id` come `hero`, perché una tabella a riga unica ha bisogno di una chiave; `mission_reminders` ha un `CHECK` che chiede l'orario oppure l'anticipo, come dice il modello; i `CHECK` e i valori predefiniti che ripetono `config.ts` (2 scudi, 3 priorità, vita 50) partono da lì, ma cambiarli richiede una nuova migrazione; nel `CHECK` lo scudo è la chiave `shield`, che il T21 dovrà usare nel negozio; `drizzle/` è escluso da Prettier perché generato. L'indice parziale sui boss attivi resta al T18, come da backlog. |
| 06/11/2026 | T17 | Fatto | Creati `src/db/types.ts` (il tipo `Db` comune a expo-sqlite e better-sqlite3, che `tsc` verifica con entrambi), `src/db/migrateWithBackup.ts` (copia di sicurezza prima di una migrazione e ripristino se fallisce, con le operazioni sui file dietro l'interfaccia `DatabaseFiles`), `src/db/client.ts` (`openAppDatabase`: expo-sqlite con `foreign_keys` e WAL, file gestiti con expo-file-system) e `test/db.ts` (`createTestDb` in memoria con le migrazioni di `drizzle/`). Installati `expo-file-system` e, in sviluppo, `babel-plugin-inline-import`; aggiunti `babel.config.js` e `metro.config.js` perché Metro includa i file `.sql` delle migrazioni, come indica Drizzle per Expo. I 9 test applicano le migrazioni da zero, controllano le chiavi esterne e, su un file vero, simulano una migrazione che fallisce a metà e verificano il ripristino. `expo export` passa; con un import temporaneo del client in `app/_layout.tsx`, poi tolto, ho verificato che l'SQL delle migrazioni entra nel bundle; `expo-doctor` 20/20. Scelte: la logica della copia sta in `migrateWithBackup.ts` e non in `client.ts`, perché `client.ts` importa moduli nativi che Jest non carica; il client non apre ancora il database all'avvio, lo collegherà il T30; il database si apre con `enableChangeListener` per le query reattive; se fallisce la prima migrazione di un database nuovo il file si cancella, così l'avvio successivo riparte da zero. Nota per i test dei repository: Drizzle avvolge gli errori di SQLite e mette l'originale in `cause`. |
| 06/11/2026 | T18 | Fatto | Aggiunta la migrazione personalizzata `drizzle/0002_events_append_only.sql`, creata con `npx drizzle-kit generate --custom`, con i trigger `events_no_update` ed `events_no_delete` che rifiutano con `RAISE(ABORT)` ogni modifica e cancellazione del registro; aggiunto l'indice parziale `boss_active_idx` sui boss attivi (migrazione `0001_boss_active_index.sql`). I 4 test su better-sqlite3 applicano le migrazioni e verificano che `INSERT` funzioni, che `UPDATE` e `DELETE` su `events` falliscano lasciando il registro intatto e che l'indice esista. Scelte: l'indice parziale sta nello schema Drizzle invece che nell'SQL scritto a mano, così drizzle-kit lo conosce e non lo perde se un giorno ricrea la tabella; un indice non può contare le righe, quindi velocizza elenco e conteggio dei boss attivi, mentre il limite di 3 resta nel codice (`canCreateBoss`), come dice il modello («un indice parziale e un controllo nel codice»). Per le migrazioni future: se drizzle-kit ricreasse la tabella `events`, i trigger andrebbero riscritti, quindi l'SQL generato va riletto, come chiede già la sezione 8. |
| 06/11/2026 | T19 | Fatto | Creato `src/db/repositories/settings.ts` con uno schema Zod e un valore predefinito per ogni chiave, `getSetting`, `setSetting`, `setDayChange` (il nuovo orario vale dal giorno dopo, salvato come `{ value, next, from_day }`), `dayChangeOn` (l'orario in vigore in un giorno di gioco) e `getDeviceId` (UUID v7 creato una volta sola). I 10 test coprono i valori predefiniti, i valori non validi rifiutati senza scrivere nulla, un valore salvato non più valido che torna al predefinito e il cambio dell'orario che vale dal giorno dopo. Valori predefiniti presi dal design 10: tema `minimal`, livello Completo, cambio alle 06:00, settimana dal lunedì, nessun giorno di riposo e nessun intervallo Non disturbare, Riduci movimento come il telefono, colori per daltonici spenti, backup automatico spento. Scelte da confermare: lingua predefinita `en`, il ripiego dello stack quando la lingua del telefono non è tra le 5 (il Primo avvio la imposta comunque); `theme` vale `minimal` per «Automatico» e `minimal-chiaro` o `minimal-scuro` per le altre due scelte del design 10.3; il riepilogo serale è acceso alle 21:00, perché i documenti danno l'orario ma non dicono se è acceso di default; il cambio di giornata accetta solo orari dalle 00:00 alle 06:00 ogni 30 minuti, come il selettore del design 10.5; `week_start` vale 1 o 7, come `weekday` del T05. Incoerenza da decidere: il design 10.5 dice che «ogni cambio della giornata vale da domani», quindi anche primo giorno della settimana e giorni di riposo, mentre il modello dati e il task lo prevedono solo per `day_change`; ho seguito il task. Le altre chiavi del design (suoni, vibrazioni, promemoria, richiamo dopo 3 giorni) arriveranno con le loro funzioni. Nota per il T20: per il giorno di gioco di un istante con un cambio in attesa, la giornata in corso finisce con l'orario vecchio e il nuovo vale dal giorno `from_day`. |
| 06/11/2026 | T20 | Fatto | Creato `src/db/repositories/events.ts` con `appendEvent` (UUID v7, fuso, giorno di gioco, id del dispositivo dalle impostazioni, chiave di idempotenza), i 31 tipi di evento del modello in `EVENT_TYPES` e nell'unione `EventType` (ora anche tipo della colonna `events.type`, senza cambiare l'SQL) e `notDeleted(missions)`; aggiunta alle impostazioni `gameDayOf`, che calcola il giorno di gioco di un istante anche con un cambio di orario in attesa. I test verificano che la stessa `idem_key` scritta due volte dia una sola riga e la risposta `already_recorded` senza errori, che gli UUID seguano l'ordine di scrittura, che una transazione fallita non lasci l'evento, il giorno di gioco dell'1:00 e con il cambio di orario, e il filtro delle missioni eliminate. Scelte: `appendEvent` usa `INSERT … ON CONFLICT DO NOTHING` sulla chiave di idempotenza, quindi due scritture uguali non possono passare entrambe; un'azione può indicare il proprio `gameDay` (per esempio la chiusura di un giorno passato), altrimenti si calcola; le variazioni devono essere interi, quelle mancanti valgono 0 e le statistiche vuote si salvano come `null`; con un nuovo orario di cambio giornata la giornata in corso finisce con l'orario vecchio e non si torna mai a un giorno prima di `from_day`. |
| 06/11/2026 | T21 | Fatto | Creati `src/content/templates.ts` (17 modelli in 4 categorie, Salute, Mente, Lavoro e studio e Casa, ognuno con chiave, frequenza, difficoltà, statistica e obiettivo; i 3 consigliati segnati), `src/content/shop.ts` (pozione e scudo con prezzi e limite presi da `config.ts`, chiavi `potion` e `shield` come nel `CHECK` dell'inventario) e `src/content/titles.ts` (11 chiavi di titolo per ciascuno dei 5 temi del lessico, con un solo Minimal per le due varianti); nomi e testi arriveranno nelle lingue col T28. Il test valida ogni frequenza con `frequencySchema` e controlla statistiche, difficoltà, obiettivi, chiavi uniche, consigliati, negozio e titoli. Contenuto da rivedere da Claudio (scelta minore 7): i modelli e le loro statistiche vengono dagli esempi della tabella «Le sei statistiche», e lettura, meditazione e studio hanno la difficoltà degli esempi di XP e monete; categorie, frequenze, le altre difficoltà, gli obiettivi (per esempio 2 litri a passi di 0,25 e 20 pagine a passi di 5) e i titoli dal quarto in poi sono invece una proposta. Il modello dei 10.000 passi indica `steps` come dato di salute che potrà completarlo. Nessun modello usa «Ogni N giorni», che richiede una data di partenza. |
| 06/11/2026 | T22 | Fatto | Creato `src/db/repositories/onboarding.ts` con `createProfile` e `hasProfile`: in una transazione crea l'eroe, le 6 statistiche, il compagno uovo, lingua e tema nelle impostazioni, le missioni dai modelli (da 1 a 5) e la quest di partenza, un boss `starter` di 3 passi con il primo già fatto (vita da 60 a 40), più gli eventi relativi. Aggiunti a `test/db.ts` `heroTotals` e `totalsFromLog`, che confrontano l'eroe con la somma del registro e serviranno ai task successivi. I 10 test coprono tutte le righe create, il primo passo già segnato, il rifiuto di 0 o 6 modelli, di modelli sconosciuti o ripetuti, di un nome vuoto e di un secondo profilo, un valore non valido che non lascia nulla scritto, e l'eroe uguale alla somma del registro. Scelte da confermare: (1) ho aggiunto il tipo di evento `hero.created`, che non è nella sezione 4.2 del modello: porta nel registro i 50 punti vita di partenza, altrimenti la somma del registro non potrebbe mai coincidere con l'eroe come chiede la sezione 4.3; (2) le missioni ricevono il nome già tradotto tramite una funzione `translate` passata dalla schermata, mentre nome e passi della quest restano chiavi (`starter_quest…`), perché il design 1.8 dà alla quest un nome diverso per ogni tema; (3) la difficoltà della quest non è nei documenti: l'ho messa `easy`, contenuto da rivedere. Incoerenza per T24 e T25: US-ONB-04 e il design 1.8 dicono che vincere la quest dà «il primo livello e le prime monete», ma con la ricompensa normale (3 passi × 10 XP × difficoltà) si arriva al massimo a 60 XP, lontano dai 200 del livello 2; serve una regola per la vittoria della quest. |
| 06/11/2026 | T23 | Fatto | Creato `src/db/repositories/missions.ts` con `createMission`, `updateMission`, `pauseMission`, `resumeMission`, `archiveMission`, `restoreMission`, `deleteMission` e `listTodayMissions`: ogni azione è una transazione con il suo evento. I 22 test coprono ogni azione con il suo evento, la missione eliminata che sparisce dalle liste ma lascia `mission_days` ed eventi, la frequenza validata con Zod e i casi d'errore. Scelte: con il solo nome si crea un'abitudine giornaliera media (US-EDT-01); `updateMission` registra nell'evento quali campi sono cambiati e non tocca il passato; una pausa con data di fine deve finire dopo oggi; si ripristinano solo le missioni archiviate, perché il ripristino delle eliminate non è ancora esposto (modello 4.5); l'archivio non tocca i promemoria, così tornano con il ripristino; l'eliminazione toglie dal Piano le righe da oggi in poi, lascia quelle passate e restituisce gli id delle notifiche da annullare nel sistema fuori dalla transazione (modello 4.4); `listTodayMissions` restituisce un elenco vuoto nei giorni di riposo, come dice il design 10.5 («Nei giorni di riposo nessuna missione è prevista»), anche se il task non lo cita. La conversione dell'obiettivo nelle colonne `goal_*` è ora condivisa con il primo avvio del T22. |
| 06/11/2026 | T24 | Fatto | Creati `src/db/repositories/completion.ts` (`completeMission`, `progressMission`, `skipMission`, `setDayPlan`, `removeFromDayPlan`), `hero.ts` (variazioni dell'eroe con quelle applicate davvero ed evento `hero.level_up`) e `boss.ts` (danno delle missioni collegate e `markStepDone` con vittoria e ricompensa), che servono anche al T25. Un completamento, in una transazione, scrive l'evento, `mission_days`, eroe, statistiche, compagno (schiusa con `companion.stage_up`), serie della missione, danno al boss collegato e bonus del giorno, e cancella i promemoria di quel giorno restituendo gli id da annullare nel sistema. I 21 test coprono tutti i casi del task e verificano ogni volta che l'eroe coincida con la somma del registro. Scelte da confermare: lo stesso completamento conta una volta anche con chiavi diverse (notifica e app), perché una missione già fatta oggi non si completa di nuovo; si completano solo le missioni previste oggi (contano al massimo N completamenti a settimana, xp-e-monete) e non una missione saltata oggi; per la giornata completa le missioni saltate non contano, come nel totale del giorno della heatmap (design 8.3), e il bonus arriva solo con un completamento; il primo completamento segna il secondo passo della quest di partenza, come dice il design 1.8; `completeMission` su una misurabile la porta all'obiettivo; i motivi del salto sono le chiavi `illness`, `travel`, `rest` e `other` del design 2.5; il Piano accetta solo missioni previste oggi e non scrive eventi, perché il modello non ha un tipo per il Piano; la serie dell'eroe non cambia al completamento, la aggiornerà la chiusura dei giorni (T14). Ancora da decidere (vedi T22): la ricompensa della vittoria della quest di partenza, che oggi seguirebbe la formula normale. |
| 06/11/2026 | T27 | Fatto | Copiato `temi.json` in `src/theme/`, identico all'originale ed escluso da Prettier per poterlo confrontare; creati `contrast.ts` (contrasto WCAG), `themes.ts` (i 6 temi come token tipizzati con i ruoli di colore del design A4, la tipografia della tabella A3 e `resolveTheme`) e `ThemeProvider.tsx` con `useTheme()`. Minimal segue chiaro o scuro del telefono, e il provider riceve il valore dell'impostazione `theme`, che collegherà lo store del T30. I test verificano che ogni tema abbia gli stessi token, i valori presi da `temi.json`, la tipografia e, con React Native Testing Library, il cambio di tema. Incoerenza in `temi.json`: la nota dice «stessi nomi in ogni tema», ma i colori dei sei temi hanno chiavi diverse (Arcade non ha `bordo` né `monete`, Minimal non ha `esperienza` né `boss`, Cyberpunk e Lovecraft ne hanno 9); i ruoli mancanti sono una bozza ricavata dalla tavolozza dello stesso tema con le regole di `colorsOf`, da rivedere da Claudio, e anche la spaziatura 1 dei titoli «spaziati» è una bozza. Coppie testo/sfondo sotto 4,5:1, colori non cambiati: Arcade vita su sfondo (2,96) e su superficie (1,91) e fatto su superficie (4,22); Fantasy monete (oro, in bozza) su sfondo (2,54) e su superficie (2,85); Lovecraft vita su sfondo (4,28) e su superficie (3,84); Minimal chiaro vita (3,65 e 3,91), monete (3,12 e 3,35) e fatto (2,94 e 3,16). Testo, testo tenue e testo sul primario superano 4,5:1 in tutti i temi. Le correzioni proposte nel design A4 (per esempio Minimal chiaro vita #ce2c31) restano da applicare quando Claudio le conferma. |
| 06/11/2026 | T28 | Fatto | Installati i18next, react-i18next ed expo-localization (`expo install` ha aggiunto il suo plugin in `app.json`); creati `src/i18n/index.ts` (`createI18n`, `pickLanguage` e `deviceLanguage`: lingua del telefono se è una delle 5, altrimenti inglese) e un file JSON per lingua in `src/i18n/locales/`, con lessico dei temi (contesto di i18next, forma base come ripiego), nomi delle statistiche per tema, nomi e categorie dei modelli, titoli dell'eroe, quest di partenza e motivi del salto. I 10 test controllano che ogni chiave esista in tutte e 5 le lingue, che ogni termine del lessico abbia la variante per ogni tema, che il lessico italiano coincida con `temi.json` e che le chiavi salvate dai repository si traducano. Scelte: il lessico comprende gli 8 termini di `temi.json` e i 7 della sezione A10 (Piano del giorno, giornata completa, pozione, scudo, esausto, Sala dei trofei, Salta oggi); conta solo la prima lingua del telefono, come dice l'analisi; i nomi propri dei compagni non si traducono; le chiavi della quest salvate dal T22 sono ora `starter_quest.name` e `starter_quest.steps.*`, perché in i18next una chiave non può essere insieme un testo e un gruppo. Contenuto da rivedere da Claudio (scelta minore 7): l'inglese tradotto da me; tedesco, francese e spagnolo in bozza; i titoli dal quarto in poi e il nome generico della quest («Quest di partenza»). I titoli italiani sono al maschile (Cavaliere, Studioso…): va deciso come trattare il genere dell'eroe. |
| 06/11/2026 | T29 | Fatto | Installati i 9 pacchetti `@expo-google-fonts/*` e creato `src/theme/fonts.ts`, che carica solo i 19 pesi usati dai token dei temi, importati dalle sottocartelle perché i pesi inutili non entrino nell'app; `fontNameOf` ricava il nome del carattere da famiglia, peso e corsivo del token e `textStyleOf` dà lo stile pronto per React Native. `app/_layout.tsx` carica i caratteri con `useFonts` e tiene la splash screen finché non sono pronti; se un carattere non si carica, l'app parte con quello di sistema. I 4 test verificano che ogni stile di ogni tema abbia il suo carattere e che non ce ne siano altri. `expo export` passa e il bundle contiene i 19 file `.ttf` dei temi, più Material Symbols portato da una dipendenza di Expo. Verifica chiesta dal design A3 prima dello sviluppo: con opentype.js, installato solo in una cartella temporanea, ho controllato che tutti i 19 caratteri, IM Fell English SC compreso, abbiano i segni di italiano, tedesco, francese e spagnolo (ß, œ, ñ, ¿, ¡ e accenti); ci sono tutti, quindi il ripiego sul carattere di testo non serve. |
| 06/11/2026 | T14 | Fatto | Creato `src/rules/closeDays.ts` con `closeDays`, che chiude in ordine i giorni interi tra l'ultimo chiuso e oggi e restituisce per ogni giorno il riepilogo di `day_summaries` (senza `closed_at`), la vita cambiata davvero, l'esaurimento, la serie dell'eroe e le serie di missione cambiate, più eroe, scudi e serie finali; applica le scelte minori 3 e 8–11. I 20 test coprono i casi del task e anche riposo, Essenziale, missioni saltate, in pausa, eliminate o non ancora create, misurabili parziali, «N volte a settimana» (anche con settimana dalla domenica) e attività singole. Scelte da confermare: in input ho aggiunto `createdDay` delle missioni (la missione non conta prima di esistere) e `bonuses`, i giorni con bonus già dati presi dal registro, perché `full_day` e `plan_complete` dicono se il bonus è stato dato; una missione completata nel giorno conta sempre tra previste e fatte, anche un'attività scaduta o completata prima della scadenza, e fa crescere la serie dell'eroe; una «N volte a settimana» conta nei giorni della settimana solo quando è fatta; la chiusura non fa crescere la serie di una missione completata (lo fa già `completeMission`) ma solo la spezza, tranne per le «N volte a settimana», che crescono di 1 a fine settimana riuscita; alla chiusura del giorno esausto la vita diventa 13 qualunque fosse, e `hp_lost` registra comunque la perdita calcolata; stato, pausa e giorni di riposo sono quelli attuali, anche per i giorni passati. Punti aperti per Claudio: se l'ultimo giorno della settimana è di riposo, quel giorno nessuna missione è prevista e la «N volte a settimana» non si valuta (né vita né serie), quindi chi riposa la domenica non viene mai giudicato su queste missioni; una «N volte a settimana» creata a metà settimana perde comunque (N − fatti) occorrenze; non è definito se i «Salta oggi» riducono N. Da sistemare nel T25 o a parte: `completeMission` (T24) fa crescere la serie di ogni missione a ogni completamento, anche delle «N volte a settimana» (che secondo la scelta 9 contano le settimane) e delle attività singole (che non hanno serie). |
| 06/11/2026 | T25 | Fatto | Creati `src/db/repositories/undo.ts` (`undoEvent`), `closing.ts` (`closePendingDays`) e `shop.ts` (`buyItem`, `usePotion`), aggiunti a `boss.ts` `createBoss`, `completeBossStep`, `archiveBoss` e `checkBossDeadlines`, e a `src/rules/boss.ts` `starterQuestReward` (scelta 12, costante in `config.ts`), ora usata da `markStepDone` per la quest di partenza; aggiunto `test/game.ts` con gli helper comuni ai nuovi test. I 26 nuovi test coprono ogni azione e i suoi rifiuti, la chiusura rieseguita che non cambia niente, l'annullamento rifiutato dopo il cambio di giornata e l'eroe uguale alla somma del registro. Corretto anche il difetto segnalato nel T14: `completeMission` non fa più crescere la serie delle «N volte a settimana» né delle attività singole. Scelte da confermare: si annullano solo i completamenti (`mission.completed`); l'evento di completamento ora salva nel payload lo stato del giorno e la serie di prima, e `boss.damaged` il danno inflitto davvero (`dealt`), per poterli ripristinare; l'annullamento è rifiutato se le monete da restituire sono già state spese (le monete non vanno sotto 0); il compagno torna indietro di un completamento ma non perde lo stadio, e il passo della quest di partenza segnato dal primo completamento resta fatto; il limite di 3 boss attivi comprende la quest di partenza; la scadenza di un boss deve essere oggi o dopo; l'avviso a 3 giorni e il furto scrivono una riga in `app_notifications` (`boss.deadline_warning`, `boss.deadline_missed`) e restituiscono gli id per la notifica di sistema; il furto avviene una volta per scadenza (chiave di idempotenza con boss e data), dal giorno dopo la scadenza, e il boss resta attivo; la pozione si può usare anche a vita piena (non ho inventato un divieto); la chiusura scrive anche `hero.exhausted` quando la vita arriva a 0 e usa come primo giorno quello dell'evento `hero.created`. |
| 06/11/2026 | T26 | Fatto | Creato `src/db/repositories/rebuild.ts` con `rebuildHeroFromEvents(db, now)`, che in una transazione ricalcola XP, livello, monete, vita e statistiche dalla somma del registro senza scrivere eventi, restituisce `{ repaired }` e rifiuta un registro con somme impossibili (monete o XP sotto 0, vita fuori da 0–50); 5 test. Creato `test/simulation.test.ts`: 90 giorni con un generatore Mulberry32 a seme fisso (semi 1, 42 e 2026) che crea missioni e boss, completa, avanza, salta, annulla, mette priorità, compra, usa pozioni, archivia boss, salta alcune aperture dell'app e chiude i giorni; a ogni apertura e a fine giornata controlla monete ≥ 0, vita 0–50, livello 1–50, scudi ≤ 2 ed eroe uguale al registro, che la chiusura rieseguita non cambi niente, e alla fine che la riparazione non trovi niente da sistemare. I 3 semi passano in circa 23 s da soli. Scelte: ho aggiunto `now` alla firma per aggiornare `updated_at`; ho tolto da un ciclo di `listTodayMissions` il calcolo di `weekStartOf`, che si ripeteva per ogni riga (stesso risultato). Da sapere: ogni completamento costa circa 10 ms nei test, perché esegue molte query e Drizzle ne ricostruisce ogni volta l'SQL (`listTodayMissions` gira due volte per completamento); per stare sotto i 30 s la simulazione usa al massimo 7 missioni. Se servirà più velocità, si possono preparare le query più usate o passare la lista di oggi a `giveDayBonuses`. |
