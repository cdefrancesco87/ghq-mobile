# GHQ Mobile – Backlog delle schermate

Secondo backlog del loop di Claude Code: le schermate dell'app, dopo le fondamenta di `docs/backlog-task.md` (T01–T33). Si esegue con lo stesso `docs/prompt-loop.md`, un task per giro. Scritto il 07/11/2026 dalle sezioni 1–12 di `analisi-funzionale.md` e `design-sezioni.md`; riallineato l'08/11/2026 ai mockup dei lotti 0–8 di Claude Design e alle decisioni dell'08/11 (`registro-decisioni.md`).

**Stati:** `[ ]` da fare · `[~]` in corso · `[x]` fatto · `[!]` bloccato (motivo nel Diario in fondo a questo file).

**Ordine:** prima il task T33b di allineamento, poi gli elementi **Must** (fasi 4 e 5), poi gli **Should** (fase 6), poi i **Could** (fase 7, task etichettati «(Could)»). Le dipendenze possono riferirsi a task dell'altro backlog.

**Mockup:** la cartella `docs/mockup/` (copia di `sviluppo/mockup-per-claude-code/`, task C12) dice **come appare** ogni schermata; leggi prima `docs/mockup/LEGGIMI.md` e l'`elenco-schermate.md`. I codici **B** (`schermate-per-tema/B<n>-<tema>.png`, 6 temi) e **D** (`flussi-minimal/D<nn>.png`, Minimal) sono citati nei task come «Mockup». Il comportamento resta in `design-sezioni.md` e `analisi-funzionale.md`; se mockup e testo si contraddicono, segui il testo e scrivilo nel Diario. Colori, caratteri e forme vengono da `temi.json` v2 e da `docs/riferimenti/misure-componenti.md`, mai dai pixel. Sprite e icone si prendono da `docs/mockup/asset/` (SVG), mai ridisegnati.

**Decisioni dell'08/11 che valgono più dei testi vecchi:** barra in basso a 4 voci più il [+] al centro (Oggi, Abitudini, [+], Obiettivi, Profilo): **Statistiche non è più una scheda** ma una rotta in pila, aperta dal Profilo e dalla scheda dell'eroe in Oggi; compagni Pixel (Arcade), Rocky (Fantasy), Glitchy (Cyberpunk), Lumin (Lovecraft), Cloudy (Minimal), con stadi Uovo, Cucciolo, Adulto; boss con nomi propri per tema; Minimal senza sprite dei boss (icona a linea in un cerchio); 4 livelli di heatmap (0–3). Sono segnaposto da isolare in un solo punto: logo, sprite intermedi di evoluzione, titoli dell'eroe, testi inventati nei mockup (vanno nei file di lessico).

**Regole comuni a tutti i task di questo file:**

- I componenti stanno in `src/features/<sezione>/` (`shared`, `onboarding`, `today`, `habits`, `editor`, `bosses`, `companion`, `shop`, `stats`, `profile`, `settings`, `notifications`, `backup`, `widgets`, `health`). Le rotte in `app/` restano sottili: leggono dagli store o dalle query e chiamano le azioni dei repository.
- Ogni nuova query o azione in `src/db/repositories/` si scrive in TDD con il database di test; ogni nuova regola in `src/rules/` è una funzione pura con i suoi test. Le schermate si testano con React Native Testing Library (render, tocchi, testi, etichette di accessibilità), usando il database di test e l'orologio finto.
- Si usano solo i ruoli di colore e i caratteri del tema (`useTheme()`), mai valori fissi; ogni testo passa da i18next con il lessico del tema. Le chiavi nuove vanno in tutte e 5 le lingue (tedesco, francese e spagnolo in bozza, scelta minore 7).
- Ogni elemento toccabile ha un `testID` stabile (servono a Maestro) e un'etichetta di accessibilità con nome, stato e azione (`design-sezioni.md` A8).
- Le scelte segnate ★ nel design sono quelle approvate: si sviluppa quella, non l'alternativa.
- Contenuti non ancora scritti (frasi del compagno, battute del boss, saluti, testi delle notifiche): bozza secondo la scelta minore 7, segnalata nel Diario.
- Oltre ai comandi del «Fatto quando», alla fine di ogni task devono passare `npm run check` e `npx expo export --platform android --output-dir dist-check` (poi cancellare `dist-check/`).

---

## Fase 4 – Basi delle schermate (Must)

### [x] T33b – Allineare tema, lessico e navigazione al design
- **Obiettivo:** portare il codice delle fondamenta (T27, T28, T29, T31) sul design approvato, prima di costruirci sopra le schermate.
- **Riferimenti:** `docs/riferimenti/colori-v2.json`; `docs/riferimenti/temi.json` (forme, caratteri, lessico aggiornati); `docs/riferimenti/misure-componenti.md`; `docs/riferimenti/lessico-v2.json`; `docs/riferimenti/lacune-design-schermate.md` (L01); `design-sezioni.md` A3, A4, A6, A11; `docs/mockup/LEGGIMI.md`.
- **Da fare:**
  - **Temi:** componi `src/theme/temi.json` v2 unendo i 18 ruoli uguali in ogni tema di `colori-v2.json` (più `vitaTesto`, `fattoTesto`, `moneteTesto`, `pericoloTesto`, `infoTesto`) con caratteri, `forma`, lessico e nomi di compagni e boss di `docs/riferimenti/temi.json`; adegua tipi e `ThemeProvider`. Porta tutto il codice sui 18 ruoli: i ruoli non uniformi (Arcade `superficieRiga`, Fantasy `oro` e `navigazione`, Cyberpunk `viola`) spariscono; il testo sui colori grafici usa la versione `…Testo`. Heatmap a 4 livelli (0–3).
  - **Test del tema:** aggiorna parità dei token e coppie testo/sfondo (contrasto 4,5:1 per testo, 3:1 per elementi grafici); togli dal Diario del T27 le coppie corrette dalla v2.
  - **Lessico (T28):** sostituisci il lessico con `lessico-v2.json` (approvato, A11.2): ogni voce ha singolare, plurale e genere (m/f) per lingua e per tema; italiano definitivo, inglese proposto, tedesco, francese e spagnolo in bozza (completali, scelta minore 7 e Diario). Aggiungi le chiavi di A11.2: parola della vittoria, titolo del Profilo e di Statistiche, «Modifica» + termine al singolare, «Missioni di oggi» = plurale + «di oggi». I nomi dei compagni e dei boss restano in `temi.json`. Il test «ogni chiave in tutte e 5 le lingue» resta e controlla anche singolare e plurale.
  - **Navigazione (T31):** barra a 4 voci più il [+] centrato (Oggi, Abitudini, [+], Obiettivi, Profilo); le etichette della barra non si tematizzano; Statistiche diventa una rotta in pila (non una scheda); etichette su una riga con scala ferma a 1,3 e troncate con «…», etichetta completa al lettore di schermo (A11.1). Riscrivi il test «5 voci» per 4 voci più il [+].
  - **Caratteri (T29):** verifica che quelli del tema siano gli stessi di `temi.json`; annota nel Diario le differenze.
  - Le icone e gli sprite non si toccano qui: arrivano nel T35.
- **Fatto quando:** `npm run check` passa; i test verificano 18 ruoli in tutti e 6 i temi, la barra con 4 voci più il [+] e Statistiche raggiungibile come rotta; nel codice non resta nessun ruolo di colore fuori dai 18 (ricerca con Grep dei nomi vecchi).
- **Dipende da:** T33.

### [x] T34 – Componenti comuni
- **Obiettivo:** i mattoni che tutte le schermate condividono, già nei 6 temi.
- **Riferimenti:** `design-sezioni.md` A1, A2, A3, A4, A6, A8; `temi.json` v2 (`forma`); `docs/riferimenti/misure-componenti.md`. Mockup: `docs/mockup/componenti/` (fogli dei componenti per tema).
- **Da fare:** in `src/features/shared/`:
  - `Card` (bordo del tema: angoli 18 in Minimal, cornice pixel in Arcade, filetto in Fantasy, angoli tagliati in Cyberpunk, doppio filetto in Lovecraft; misure e forme da `temi.json` v2 e `misure-componenti.md`);
  - `Button` (primario, secondario, solo testo, distruttivo; altezza 48; da spento può spiegare il perché al lettore di schermo);
  - `Bar` (vita, esperienza, boss, statistica) sempre con il numero accanto, forma per tema;
  - `Difficulty` (1–3 tacche più la parola), `Chip`, `SegmentedControl`, `ScreenHeader` (titolo grande che si riduce scorrendo);
  - `Sheet` (foglio dal basso con maniglia, mezza altezza e tutta altezza) con `Modal` di React Native, Reanimated e react-native-gesture-handler (`npx expo install`);
  - `ActionSheet` (menu a pressione lunga e scelte rapide), `useLargeText()` (vero con `fontScale ≥ 1,3`, soglia unica di A11.1: tutti i layout alternativi la usano e nessun task ne inventa un'altra), `ConfirmDialog` (solo per azioni che non si annullano), `UndoToast` (avviso in basso con «Annulla» per 5 secondi, uno alla volta), `EmptyState` (compagno, frase, una sola azione).
- **Fatto quando:** i test con React Native Testing Library verificano ogni componente in Minimal e in Arcade, l'altezza minima delle aree toccabili, l'etichetta di accessibilità di `Bar` («Vita 32 su 50») e la scadenza di `UndoToast` dopo 5 secondi con i timer finti.
- **Dipende da:** T33b.

### [x] T35 – Icone e sprite
- **Obiettivo:** mostrare icone, compagno e boss del tema attivo con un solo componente.
- **Riferimenti:** `design-sezioni.md` A5; `stack-tecnologico.md` punto 8; asset in `docs/mockup/asset/` (lotto 1 icone, lotto 3 compagni e boss, lotto 4 habitat, arene, emblemi e logo, lotto 8 badge, regali, corona, piedistallo; `palette-sprite.json`), da copiare in `assets/` del progetto. Non usare `design/icone-sprite/`: è superato.
- **Da fare:**
  - `Icon` in `src/features/shared/`: icone a linea con il tratto del tema e icone pixel in Arcade, da SVG con react-native-svg; corpi 24, 20 e 16.
  - `CompanionSprite` (tema, stadio, umore) e `BossSprite` (tema, difficoltà) con PNG già ingranditi e scalati solo a multipli interi; descrizione per il lettore di schermo («Blob, cucciolo, felice»).
  - Segnaposto da isolare in un solo punto di codice: logo e icona dell'app, sprite intermedi di evoluzione (`lotto8/compagno-evoluzione-*`). Minimal non ha sprite dei boss: icona a linea in un cerchio. Mancano scudo e pozione veri: usa le icone esistenti e annotalo nel Diario.
- **Fatto quando:** un test controlla che ogni chiave di icona usata nell'app abbia un file o un segnaposto dichiarato; un test verifica la descrizione di accessibilità del compagno in 2 temi.
- **Dipende da:** T34.

### [~] T36 – Riga missione
- **Obiettivo:** la riga usata da Oggi, Abitudini, Piano del giorno e widget.
- **Riferimenti:** `design-sezioni.md` A6 («Riga missione»), 2.5, 3.2, 3.11; `analisi-funzionale.md` sezione 2 (Expected output). Mockup: B2 (riga missione nei 6 temi), D07, D42 in `docs/mockup/`.
- **Da fare:**
  - `MissionRow` in `src/features/shared/` con le varianti `today`, `priority` (più grande, con il numero 1–3), `list` (serie e percentuale a 30 giorni invece del controllo) e `done` (testo tenue con l'ora).
  - Controllo di completamento 48×48 a destra, con l'anello di avanzamento per le misurabili; XP in palio; categoria come icona; nome su due righe al massimo con «…».
  - `describeFrequency(frequency, t)` che scrive la frequenza leggibile per le 6 forme e la scadenza delle attività singole.
  - Etichetta di accessibilità completa («Meditazione, media, 25 XP, da fare. Tocca due volte per completare») e azioni del lettore di schermo passate dal genitore.
- **Testo molto grande:** Con `useLargeText()` il controllo resta a destra, XP e difficoltà vanno sotto il nome e il nome può andare su 3 righe (A11.1); in Arcade il corpo si arrotonda per difetto al multiplo di 2.
- **Fatto quando:** i test coprono le 4 varianti, `describeFrequency` con ogni forma e l'etichetta di accessibilità. Un test con `fontScale` 1,3 verifica il layout alternativo.
- **Dipende da:** T35.

### [ ] T37 – Celebrazioni e momenti a schermo intero
- **Obiettivo:** il riscontro di gioco dopo ogni azione, uguale in tutte le schermate.
- **Riferimenti:** `design-sezioni.md` A7, A8; `stack-tecnologico.md` punto 8; `analisi-funzionale.md` US-OGGI-03. Mockup: D08, D35; storyboard in `docs/mockup/storyboard/` (durate e curve in didascalia valgono)
- **Da fare:**
  - `useCelebration()`: «+25 XP» e monete che volano verso la scheda dell'eroe, animazione della spunta per tema (forme semplici, niente asset nuovi), vibrazione leggera con expo-haptics; tutto parte entro 300 ms.
  - `MomentQueue`: momenti a schermo intero (salita di livello con l'eventuale nuovo titolo, vittoria sul boss, cambio di stadio del compagno, badge), al massimo 2,5 secondi, saltabili con un tocco, in fila dal più importante. Si alimenta dagli eventi restituiti dalle azioni dei repository (`hero.level_up`, `boss.defeated`, `companion.stage_up`).
  - `useReduceMotion()`: legge l'impostazione del sistema (`AccessibilityInfo`) e quella dell'app se esiste; con Riduci movimento niente particelle, scosse e zoom, solo dissolvenze di 150 ms.
- **Fatto quando:** i test verificano l'ordine della coda, il salto con un tocco, l'assenza delle particelle con Riduci movimento e che la celebrazione parta nello stesso ciclo del tocco (timer finti).
- **Dipende da:** T36.

---

## Fase 5 – Schermate Must

### [ ] T38 – Primo avvio
- **Obiettivo:** dalla prima apertura a Oggi in meno di 2 minuti, senza account.
- **Riferimenti:** `analisi-funzionale.md` sezione 1; `design-sezioni.md` 1.1–1.7 e 1.10. Mockup: D01–D05 in `docs/mockup/`.
- **Da fare:**
  - 5 passi a schermo intero (lingua, nome, tema, prime missioni, notifiche) con indicatore a segmenti, Indietro dal passo 2, «Continua» alto 56 sopra la tastiera, «Salta» sui passi 3–5.
  - Lingua preselezionata (scelta minore 19) che cambia subito i testi; nome obbligatorio fino a 20 caratteri; passi 1 e 2 in Minimal, dal passo 3 il tema scelto.
  - `ThemeCarousel` in `src/features/shared/` (servirà anche nelle Impostazioni): anteprima vera di Oggi con il nome appena scritto, l'uovo del tema e due missioni d'esempio; chip Automatico, Chiaro, Scuro sotto Minimal.
  - Modelli per categoria con i 3 consigliati già selezionati, contatore «3 di 5», al sesto tocco il messaggio «Massimo 5».
  - Notifiche: due notifiche d'esempio e «Attiva i promemoria», che chiede il permesso con expo-notifications; «Non ora» prosegue senza avvisi.
  - Alla fine `createProfile` e arrivo su Oggi con una dissolvenza. Se l'app si chiude a metà, si riparte dal passo lasciato (bozza salvata nelle impostazioni con uno schema Zod).
- **Fatto quando:** un test percorre tutto il flusso e verifica `hasProfile()` e 3 missioni create; altri test coprono Continua spento con il nome vuoto, il sesto modello rifiutato, il permesso rifiutato e la ripresa dal passo 4 dopo un nuovo montaggio.
- **Dipende da:** T37.

### [ ] T39 – Oggi: dati della schermata e scheda dell'eroe
- **Obiettivo:** la parte alta di Oggi, con tutti i dati della schermata da una sola query.
- **Riferimenti:** `analisi-funzionale.md` sezione 2 e US-OGGI-01; `design-sezioni.md` 2.1, 2.2, 2.8, 2.9, 2.11; `modello-dati.md` 3.5–3.7. Mockup: B2, D07, D09, D10, D42 in `docs/mockup/`.
- **Da fare:**
  - `getTodayView(db, now)` in `src/db/repositories/todayView.ts`: eroe, missioni di oggi con stato (da fare, fatta con ora, saltata, scaduta), Piano, boss attivi, avvisi (eroe esausto, scudo usato ieri, monete rubate da un boss, compagno cresciuto, missione tornata dalla pausa).
  - Intestazione con data e saluto nel tono del tema; scheda dell'eroe con compagno (64, 40 in Minimal; il tocco apre la sua scheda), nome, titolo, livello, barre di vita ed esperienza, chip della serie e delle monete (il tocco sulle monete apre il Negozio; un tocco sulla serie o un collegamento apre Statistiche, che non è più nella barra).
  - Barra fissa sottile con livello, vita ed esperienza quando si scorre.
  - Stati particolari: fascia «Esausto», avviso dello scudo chiudibile, giorno di riposo o senza missioni con `EmptyState`.
- **Testo molto grande:** Con `useLargeText()` la scheda dell'eroe va su due righe e la barra fissa mostra solo il livello (2.11, A11.1).
- **Fatto quando:** i test della query coprono giorno normale, riposo, eroe esausto, scudo usato e missioni eliminate escluse; i test della schermata coprono la scheda dell'eroe, la barra fissa e l'ordine di lettura. Un test con `fontScale` 1,3 verifica il layout alternativo.
- **Dipende da:** T37.

### [ ] T40 – Oggi: missioni e completamento
- **Obiettivo:** completare e annullare una missione con un tocco, il cuore dell'app.
- **Riferimenti:** `analisi-funzionale.md` US-OGGI-03, US-OGGI-04, US-OGGI-05; `design-sezioni.md` 2.5, 2.6, 2.9, 2.11; `CLAUDE.md` scelte minori 4, 5 e 20. Mockup: B2, D08, D11 in `docs/mockup/`.
- **Da fare:**
  - Sezione «Missioni di oggi» con contatore «2 di 5» e anello; ordine: attività scadute («Scaduta ieri» in colore pericolo), con orario per ora, senza orario per ordine manuale; gruppo «Fatte (n)» aperto e richiudibile.
  - Tocco sul controllo: `completeMission` con `source: 'app'` e una chiave di idempotenza, aggiornamento degli store, celebrazione del T37, danno sul boss collegato e momento di vittoria se lo sconfigge; annuncio a voce del completamento.
  - `UndoToast` «Fatto · Annulla» per 5 secondi con `undoEvent`; dopo, «Annulla completamento» dal menu della riga fino al cambio di giornata. Messaggi chiari quando l'annullamento è rifiutato (giornata cambiata, monete già spese).
  - Pressione lunga: menu con Annulla completamento, Aggiungi alle priorità, Modifica, Andamento (le altre voci arrivano nei task Should). Il tocco sul nome apre il dettaglio della missione.
- **Fatto quando:** i test verificano completamento, XP e monete nello store e nel database, annullamento entro 5 secondi e dal menu, rifiuto dopo il cambio di giornata e con monete spese, eroe uguale alla somma del registro.
- **Dipende da:** T39.

### [ ] T41 – Oggi: Piano del giorno
- **Obiettivo:** scegliere fino a 3 priorità e vederle in evidenza.
- **Riferimenti:** `analisi-funzionale.md` US-OGGI-02; `design-sezioni.md` 2.3. Mockup: B2, D12 in `docs/mockup/`.
- **Da fare:** tre posti numerati con il posto vuoto «+ Scegli una priorità», che apre un foglio con le missioni di oggi; righe in variante `priority`; le priorità non si ripetono nell'elenco sotto ma il contatore le conta; con 3 priorità «Hai già 3 priorità: togline una»; sigillo e «+25 XP» quando sono tutte fatte; frase di spiegazione quando il Piano è vuoto. Usa `setDayPlan` e `removeFromDayPlan`.
- **Fatto quando:** i test coprono aggiunta, rimozione, quarta priorità rifiutata, bonus del Piano assegnato e annullato insieme all'ultimo completamento.
- **Dipende da:** T40.

### [ ] T42 – Oggi: boss in corso
- **Obiettivo:** vedere e colpire il boss da Oggi.
- **Riferimenti:** `analisi-funzionale.md` US-OGGI-05, US-BOSS-01; `design-sezioni.md` 2.4, 5.4. Mockup: B2, B3a in `docs/mockup/`.
- **Da fare:** `BossCard` compatta in `src/features/bosses/` (sprite 48, nome, barra con numero, «Passi 3 di 8», prossimo passo con il suo controllo, giorni alla scadenza in colore pericolo con icona a 3 giorni o meno); con più boss la scheda scorre in orizzontale con i punti, dal boss con la scadenza più vicina; passo completato da qui con `completeBossStep`, numero del danno, barra che scende e `UndoToast`; senza boss la riga «Trasforma un obiettivo in un boss» verso Obiettivi. La quest di partenza per ora appare come un boss normale (la scheda dedicata è nel T63).
- **Fatto quando:** i test coprono uno e tre boss, l'ordine per scadenza, il passo completato e annullato, la vittoria dall'ultimo passo, la riga senza boss.
- **Dipende da:** T40.

### [ ] T43 – Editor missione: campi base
- **Obiettivo:** creare una missione scrivendo solo il nome e un tocco.
- **Riferimenti:** `analisi-funzionale.md` sezione 4, US-EDT-01, US-EDT-02, US-EDT-06; `design-sezioni.md` 4.1–4.4, 4.10, 4.12, 4.13, 4.15. Mockup: B5, D13 in `docs/mockup/`.
- **Da fare:**
  - Foglio a mezza altezza dal [+] con il cursore nel nome e la tastiera aperta; titolo e pulsante nel lessico del tema («Nuovo stage», «START»…).
  - Nome (Salva spento se vuoto, contatore oltre 60, avviso non bloccante per un nome già usato), tipo (Abitudine, Attività singola), difficoltà (3 pulsanti con gli XP, Media preselezionata), statistica principale (6 pulsanti con l'invito se manca).
  - Barra fissa sopra la tastiera con l'anteprima delle ricompense (valori base da `completionDeltas` senza serie) e Salva; Invio salva.
  - Al salvataggio `createMission`, chiusura del foglio, risalto della riga in Oggi e «Missione creata · Annulla» (Annulla elimina la missione appena creata con `deleteMission`).
- **Testo molto grande:** Con `useLargeText()` il foglio si apre subito a tutta altezza e i pulsanti di difficoltà vanno uno sotto l'altro (4.15, A11.1).
- **Fatto quando:** un test scrive solo il nome, preme Invio e trova un'abitudine giornaliera media senza promemoria (US-EDT-01, un tocco dopo il nome); altri test coprono anteprima che cambia con la difficoltà, statistica mancante e nome duplicato. Un test con `fontScale` 1,3 verifica il layout alternativo.
- **Dipende da:** T36.

### [ ] T44 – Editor missione: altre opzioni e modifica
- **Obiettivo:** le impostazioni avanzate Must e la modifica di una missione.
- **Riferimenti:** `analisi-funzionale.md` US-EDT-04, US-EDT-05; `design-sezioni.md` 4.5, 4.6, 4.8, 4.9, 4.12, 4.14; `modello-dati.md` 3.3. Mockup: D14, D15, D16 in `docs/mockup/`.
- **Da fare:**
  - Sezione «Altre opzioni» che porta il foglio a tutta altezza; righe con valore attuale che aprono un piccolo foglio.
  - Frequenza: solo «Ogni giorno» e «Giorni della settimana» (7 cerchi dal primo giorno impostato); le altre forme compaiono solo quando i loro task sono fatti. Attività singola: Scadenza con data e ora facoltative.
  - Promemoria: uno o più orari come chip eliminabili; per le attività singole con orario i chip di anticipo 0, 5, 15, 30 minuti. Se il permesso è negato la riga lo dice e porta alle Impostazioni; se non è mai stato chiesto, lo chiede con la spiegazione del Primo avvio. Se `createMission` e `updateMission` non salvano ancora `mission_reminders`, aggiungilo nel repository in TDD.
  - Boss collegato: boss attivi con sprite e vita, «Nessuno», oppure «Nessun boss attivo · Crea un obiettivo»; aperto dalla scheda di un boss, quel boss è già scelto.
  - Modifica: stesso foglio a tutta altezza con «Modifica missione», «Vale dai prossimi completamenti» al cambio di difficoltà, Archivia ed Elimina (dialogo); «Scartare le modifiche?» chiudendo con modifiche non salvate.
- **Fatto quando:** i test coprono giorni della settimana salvati e letti, promemoria aggiunti e tolti, permesso negato, boss collegato e spostato, modifica con difficoltà cambiata, scarto delle modifiche.
- **Dipende da:** T43.

### [ ] T45 – Promemoria: programmazione
- **Obiettivo:** i promemoria arrivano nei giorni giusti, rispettano Non disturbare e spariscono a missione fatta.
- **Riferimenti:** `analisi-funzionale.md` sezione 11 e US-NOT-01, US-NOT-03; `design-sezioni.md` 11.1, 11.4, 11.7; `modello-dati.md` 3.9; `stack-tecnologico.md` punto 5. Mockup: D40 in `docs/mockup/`.
- **Da fare:**
  - `src/rules/reminders.ts`: `plannedReminders({missions, reminders, done, fromDay, days, quietHours, dayChange, tzOffset})` che restituisce gli istanti dei promemoria nei giorni previsti dalla frequenza, sposta quelli dentro Non disturbare alla fine dell'intervallo, salta le missioni già fatte, calcola l'anticipo delle attività singole.
  - `src/features/notifications/scheduler.ts`: allinea expo-notifications e `scheduled_reminders` su una finestra di qualche giorno (iOS tiene al massimo 64 notifiche programmate); si chiama all'avvio, dopo ogni modifica di una missione o delle impostazioni e dopo ogni completamento, che cancella i promemoria rimasti del giorno.
  - Riusa il task in background del T32 per «Completa» dalla notifica.
- **Fatto quando:** i test delle regole coprono giorni della settimana, cambio di giornata alle 06:00, Non disturbare 22:00–07:00, missione già fatta e anticipo di 15 minuti; un test dello scheduler con expo-notifications finto verifica programmazione, cancellazione dopo il completamento e il limite di 64.
- **Dipende da:** T44.

### [ ] T46 – Abitudini: elenco, archivio ed eliminazione
- **Obiettivo:** tutte le missioni in un posto, con archivio e ripristino.
- **Riferimenti:** `analisi-funzionale.md` sezione 3, US-ABI-01, US-ABI-03; `design-sezioni.md` 3.1, 3.2, 3.7, 3.8, 3.9, 3.11. Mockup: B4, D18, D19, D20 in `docs/mockup/`.
- **Da fare:**
  - Query `listHabitsView` con serie e percentuale degli ultimi 30 giorni (saltate e giorni in pausa esclusi), per categoria.
  - Intestazione con il nome del tema e «12 attive»; chip Tutte, Abitudini, Attività singole, Archiviate con i numeri (i filtri sono Should ma servono per l'archivio); categorie richiudibili; righe in variante `list` senza controllo di completamento.
  - Tocco: dettaglio della missione. Pressione lunga: Modifica, Archivia, Elimina. Archiviate in testo tenue con la data e Ripristina. Dialogo di eliminazione con «Archivia invece».
  - Attività singole completate visibili 7 giorni, poi archiviate da sole: `archiveCompletedSingles(today)` in TDD, chiamata all'avvio dopo `closePendingDays`.
  - Stati vuoti con il compagno, Crea una missione e Usa un modello (il secondo apre l'editor finché la libreria non c'è).
- **Fatto quando:** i test coprono percentuale a 30 giorni, filtri, archiviazione con `UndoToast`, ripristino, eliminazione che toglie la missione da Oggi e da Abitudini, archiviazione automatica dopo 7 giorni.
- **Dipende da:** T44.

### [ ] T47 – Obiettivi: elenco e creazione del boss
- **Obiettivo:** trasformare un grande obiettivo in un boss.
- **Riferimenti:** `analisi-funzionale.md` sezione 5, US-BOSS-01; `design-sezioni.md` 5.1, 5.2, 5.9, 5.11; `xp-e-monete.md` «Bonus». Mockup: B3a, D21, D22 in `docs/mockup/`.
- **Da fare:**
  - Schermata Obiettivi: titolo del tema, «2 di 3 attivi», schede grandi dei boss attivi (sprite 96), posti liberi tratteggiati, messaggio a 3 boss, obiettivi archiviati nel menu «Altro». Minimal: anello di avanzamento grande al posto della creatura.
  - Creazione a tutta altezza: nome; passi (Invio aggiunge il passo e apre il successivo, riordino con maniglie o con «Sposta su/giù» se il trascinamento non regge, contatore «5 di 20», minimo 2); difficoltà con ×1, ×1,5, ×2 e sprite in anteprima; scadenza facoltativa; statistica con «+10 punti a ogni passo»; missioni collegate con il danno di ognuna e lo spostamento da un altro boss.
  - Barra in fondo con «Vita 160 · Ricompensa 120 XP e 24 monete» e il pulsante nel lessico del tema.
- **Fatto quando:** i test coprono creazione con 2 e 20 passi, 1 e 21 passi rifiutati, quarto boss rifiutato, anteprima di vita e ricompensa, missione spostata da un altro boss.
- **Dipende da:** T42.

### [ ] T48 – Scheda del boss e vittoria
- **Obiettivo:** combattere il boss passo dopo passo e festeggiare la vittoria.
- **Riferimenti:** `analisi-funzionale.md` US-BOSS-02; `design-sezioni.md` 5.3, 5.4, 5.5, 5.9, 5.11; `CLAUDE.md` scelta minore 12. Mockup: B3b, D23 in `docs/mockup/`.
- **Da fare:** arena con sprite 128, barra con il tratto a righe della vita protetta e la nota «Serve l'ultimo passo per il colpo finale», chip di passi, scadenza e difficoltà; passi con spunta, data dei fatti e prossimo in evidenza; missioni collegate con danno per completamento e danni totali; menu con Archivia (Modifica, Nuova scadenza ed Elimina arrivano nel T49). Momento della vittoria nel lessico del tema con XP e monete che contano e i pulsanti «Vedi il trofeo» e «Continua». Annunci a voce dei colpi.
- **Fatto quando:** i test coprono il tratto protetto (10 per passo rimasto), il passo completato e annullato, la vittoria con le ricompense giuste (anche la quest di partenza con la scelta minore 12), l'archiviazione.
- **Dipende da:** T47.

### [ ] T49 – Modifica del boss
- **Obiettivo:** cambiare passi, scadenza e boss dopo la creazione (US-BOSS-01).
- **Riferimenti:** `analisi-funzionale.md` US-BOSS-01, US-BOSS-03; `design-sezioni.md` 5.3; `CLAUDE.md` scelta minore 21 (aggiunta da Claudio, task C13). Mockup: B3b, D21 in `docs/mockup/`.
- **Da fare:** in TDD `updateBoss` (nome, passi aggiunti, tolti, riordinati e rinominati), `setBossDeadline` e l'eliminazione del boss, secondo la scelta minore 21 su vita e danni quando cambiano i passi e su come si elimina un boss. Modifica nella stessa schermata della creazione; «Nuova scadenza» con il selettore di data; Elimina con dialogo. **Se in `CLAUDE.md` non c'è la scelta minore 21, segna il task `[!]`.**
- **Fatto quando:** i test coprono un passo aggiunto e uno tolto dopo un danno, il riordino, la nuova scadenza che azzera l'avviso a 3 giorni, l'eliminazione, eroe uguale alla somma del registro.
- **Dipende da:** T48.

### [ ] T50 – Compagno: scheda
- **Obiettivo:** il compagno con aspetto, stadio, crescita e nome.
- **Riferimenti:** `analisi-funzionale.md` sezione 6, US-COMP-01, US-COMP-03; `design-sezioni.md` 6.1, 6.2, 6.4, 6.7, 6.9, 6.10, 6.12. Mockup: B8, D26 in `docs/mockup/`.
- **Da fare:** scheda a schermo intero con l'habitat del tema, sprite grande, nome con matita (fino a 20 caratteri, Invio conferma; `renameCompanion` in TDD con evento se non esiste), stadio con il nome del tema («Cucciolo · stadio 2 di 3»), barra della crescita «87 di 150 missioni» e la frase sulle missioni mancanti; tocco con piccola reazione e fumetto (frasi in bozza, mai rimproveri); al cambio di tema il nome di default passa al nuovo tema, quello scelto dall'utente resta (regola in TDD).
- **Fatto quando:** i test coprono uovo, cucciolo e adulto, la barra di crescita, il cambio di nome con evento, il cambio di tema con nome di default e con nome scelto.
- **Dipende da:** T39.

### [ ] T51 – Negozio e inventario
- **Obiettivo:** spendere le monete in modo chiaro e usare gli oggetti.
- **Riferimenti:** `analisi-funzionale.md` sezione 7, US-NEG-01, US-NEG-02; `design-sezioni.md` 7.1–7.5, 7.7, 7.8, 7.10; `CLAUDE.md` scelta minore 18. Mockup: B6, D27, D28 in `docs/mockup/`.
- **Da fare:** saldo grande e benvenuto del tema; schede Negozio e Inventario con i nomi del tema; griglia a 2 colonne (1 con testo molto grande) con pozione e scudo (lo scudo è Should ma è la stessa scheda): sprite, nome, descrizione, prezzo, «Ne hai 1», «Ti mancano 20 monete», «Ne hai già 2, il massimo»; foglio di conferma «Compra per 50» con il saldo dopo e, per la pozione, «Usa subito»; inventario con quantità, Usa per la pozione (spento a vita piena), spiegazione dello scudo, stato vuoto. Saldo annunciato dopo ogni acquisto.
- **Testo molto grande:** Con `useLargeText()` la griglia passa a una colonna (7.10, A11.1).
- **Fatto quando:** i test coprono acquisto, monete insufficienti, terzo scudo rifiutato, pozione usata e rifiutata a vita piena, saldo aggiornato nella scheda dell'eroe. Un test con `fontScale` 1,3 verifica il layout alternativo.
- **Dipende da:** T39.

### [ ] T52 – Statistiche: riepilogo e andamento delle missioni
- **Obiettivo:** la costanza a colpo d'occhio e le missioni su cui lavorare.
- **Riferimenti:** `analisi-funzionale.md` sezione 8, US-STAT-02; `design-sezioni.md` 8.1, 8.2, 8.4, 8.9, 8.10, 8.12. Mockup: B9, D29 in `docs/mockup/`.
- **Da fare:** la schermata è una rotta in pila (`app/statistiche`), non una scheda della barra: si apre dal Profilo e dalla scheda dell'eroe in Oggi (decisione dell'08/11). Query in `src/db/repositories/statsView.ts` (serie e record dell'eroe, completate nella settimana, percentuale a 30 giorni, percentuale per missione nel periodo; saltate e pause escluse) in TDD; schede Panoramica e Registro (il Registro è un segnaposto fino al T67); riepilogo 2×2 con confronti solo positivi; selettore Settimana, Mese, Anno; elenco delle missioni dalla meno costante; stati vuoti dei primi giorni.
- **Fatto quando:** i test delle query coprono settimana con `week_start` lunedì e domenica, saltate escluse, missioni eliminate escluse; i test della schermata coprono confronto positivo mostrato e negativo nascosto.
- **Dipende da:** T36.

### [ ] T53 – Dettaglio della missione
- **Obiettivo:** l'andamento di una missione, da Statistiche, Abitudini e Oggi.
- **Riferimenti:** `analisi-funzionale.md` US-STAT-02, US-EDT-03; `design-sezioni.md` 8.5, 8.12. Mockup: D31 in `docs/mockup/`.
- **Da fare:** schermata intera con Modifica in alto; icona, nome, frequenza e difficoltà; riquadri con serie, record e percentuale nel periodo; grafico a colonne per settimana o mese con react-native-svg, assi numerati e valore al tocco; per le misurabili il grafico dei valori giornalieri con la linea tratteggiata dell'obiettivo; storico della missione dal registro; note. Descrizione testuale e tabella dei valori per il lettore di schermo; con testo molto grande i grafici diventano elenchi.
- **Testo molto grande:** Con `useLargeText()` i grafici diventano elenchi di valori (8.12, A11.1).
- **Fatto quando:** i test coprono una missione semplice e una misurabile, il cambio di periodo e la descrizione accessibile del grafico. Un test con `fontScale` 1,3 verifica il layout alternativo.
- **Dipende da:** T52.

### [ ] T54 – Profilo
- **Obiettivo:** chi è l'eroe, la scheda del personaggio e i collegamenti.
- **Riferimenti:** `analisi-funzionale.md` sezione 9, US-PROF-01, US-PROF-03, US-PROF-04; `design-sezioni.md` 9.1–9.5, 9.7, 9.8, 9.11; `statistiche-eroe.md`. Mockup: B7, D33 in `docs/mockup/`.
- **Da fare:** emblema del tema con l'iniziale; nome con matita fino a 24 caratteri (`renameHero` con evento `hero.renamed`, in TDD se manca); titolo, livello e «320 di 500 XP al livello 8»; serie, completamenti totali, boss sconfitti; scheda del personaggio a griglia 2×3 con icona, nome del tema, «Lv 4», barra, «Max» al livello 10 e frase iniziale a 0; foglio di dettaglio con punti, punti mancanti, ultimi guadagni dal registro e missioni che la alimentano; collegamenti a Statistiche, Compagno, Negozio, Sala dei trofei (segnaposto fino al T65), Impostazioni, più l'ingranaggio in alto.
- **Testo molto grande:** Con `useLargeText()` la griglia della scheda del personaggio diventa un elenco a una colonna (9.11, A11.1).
- **Fatto quando:** i test coprono titolo per livello, statistiche a 0 e al massimo, dettaglio con gli ultimi guadagni, cambio del nome con evento, griglia a una colonna con testo molto grande. Un test con `fontScale` 1,3 verifica il layout alternativo.
- **Dipende da:** T50.

### [ ] T55 – Impostazioni
- **Obiettivo:** le scelte Must in una sola pagina a gruppi.
- **Riferimenti:** `analisi-funzionale.md` sezione 10, US-IMP-01; `design-sezioni.md` 10.1, 10.2, 10.3, 10.5, 10.6, 10.9, 10.10, 10.12. Mockup: D03, D36 in `docs/mockup/`.
- **Da fare:** pagina a gruppi (Aspetto, Giornata, Notifiche, Dati, Informazioni; Gioco e Accessibilità arrivano nei task Should) con campo Cerca; righe alte 52 con valore a destra; titolo del tema. Tema: pagina con `ThemeCarousel`, «Usa questo tema», chip di Minimal, «Stessi dati, nuova veste». Lingua: foglio con cambio immediato. Giornata: cambio dalle 00:00 alle 06:00 a passi di 30 minuti con l'esempio, primo giorno della settimana, giorni di riposo, ogni cambio «Dal …» (vale da domani). Notifiche: interruttore generale o «Notifiche bloccate dal telefono» con il pulsante verso le impostazioni del sistema; riepilogo serale (interruttore e orario salvati, l'invio arriva nel T73); Non disturbare con la sua pagina di intervalli. Informazioni: versione, privacy, licenze. Ogni cambio che tocca i promemoria richiama lo scheduler del T45.
- **Testo molto grande:** Con `useLargeText()` il valore di ogni riga va sotto il nome invece che a destra (10.12, A11.1).
- **Fatto quando:** i test coprono cambio di tema, lingua, cambio di giornata valido da domani, giorni di riposo, intervallo di Non disturbare aggiunto e tolto con lo scheduler richiamato, ricerca delle righe. Un test con `fontScale` 1,3 verifica il layout alternativo.
- **Dipende da:** T45, T38.

### [ ] T56 – Elimina tutti i dati
- **Obiettivo:** ricominciare da zero davvero (US-IMP-05).
- **Riferimenti:** `analisi-funzionale.md` US-IMP-05; `design-sezioni.md` 10.8; `modello-dati.md` 4.3 («l'unica eccezione è Elimina tutti i dati»). Mockup: D39 in `docs/mockup/`.
- **Da fare:** riga in rosso in fondo a Dati; primo foglio con cosa si perde e «Fai prima un backup»; seconda conferma scrivendo ELIMINA. `wipeAllData` chiude il database, cancella il file (il registro non si può svuotare con `DELETE`), cancella le notifiche programmate, azzera gli store, riapre il database con le migrazioni e porta al Primo avvio. La parte sui file dietro l'interfaccia del T17.
- **Fatto quando:** i test coprono le due conferme, il pulsante spento senza la parola giusta e, con il file system finto, database ricreato vuoto e reindirizzamento al Primo avvio.
- **Dipende da:** T55.

### [ ] T57 – Backup e ripristino
- **Obiettivo:** cambiare telefono senza perdere niente.
- **Riferimenti:** `analisi-funzionale.md` US-IMP-03; `design-sezioni.md` 10.8; `stack-tecnologico.md` punto 4; `modello-dati.md` sezione 8 («Backup e ripristino»). Mockup: D38 in `docs/mockup/`.
- **Da fare:**
  - `src/features/backup/`: file di backup (database compresso con la versione dello schema) più un riepilogo (data, numero di missioni, livello); ripristino che rifiuta un backup più nuovo dell'app e migra uno più vecchio; tutto dietro un'interfaccia `CloudStore` con una versione in memoria per i test.
  - Implementazione reale con react-native-cloud-storage (iCloud su iPhone, spazio nascosto dell'app su Google Drive su Android, plugin in `app.json`); backup automatico giornaliero con expo-background-task, spento finché l'utente non lo accende.
  - Pagina Backup: dove e quando è stato fatto l'ultimo, «Fai un backup ora», interruttore automatico, stato dell'ultimo tentativo, errore in una riga con Riprova. Ripristina: anteprima con data, missioni e livello, «Sostituirà i dati di questo telefono», poi l'app si ricarica su Oggi.
  - Le credenziali di Google (ID client) vengono da Claudio (task C17): metti un segnaposto in configurazione e annotalo nel Diario.
- **Fatto quando:** i test con `CloudStore` in memoria coprono backup e ripristino andata e ritorno con eroe e registro identici, backup più nuovo rifiutato, errore con Riprova.
- **Dipende da:** T56.

---

## Fase 6 – Should

### [ ] T58 – Flussi Maestro
- **Obiettivo:** avere i test dei flussi completi pronti per l'emulatore.
- **Riferimenti:** `stack-tecnologico.md` punto 10 («Test»).
- **Da fare:** cartella `.maestro/` con un flusso per: primo avvio, completa e annulla da Oggi, crea una missione col solo nome, crea un boss e sconfiggilo, compra e usa una pozione, cambia tema e lingua, elimina tutti i dati. Usa i `testID` (aggiungi quelli mancanti). Script `npm run e2e` (`maestro test .maestro/`) e una sezione nel README su come lanciarli. Il loop non li esegue: li prova Claudio (task C16).
- **Fatto quando:** ogni file YAML si legge con il pacchetto `yaml` senza errori e ogni `testID` citato esiste nel codice (un test Jest lo controlla con una ricerca nei sorgenti).
- **Dipende da:** T57.

### [ ] T59 – Oggi: Salta oggi e giornata completa
- **Obiettivo:** saltare senza punizioni e festeggiare la giornata piena.
- **Riferimenti:** `analisi-funzionale.md` US-OGGI-06; `design-sezioni.md` 2.5 («Salta oggi»), 2.7, 2.12; `CLAUDE.md` scelte minori 4 e 17. Mockup: D10, D11 in `docs/mockup/`.
- **Da fare:** «Salta oggi» nel menu e con lo scorrimento a sinistra sulla riga; foglio con i motivi (Malattia, Viaggio, Riposo, Altro) e i salti rimasti; riga saltata tra le fatte con «Saltata»; quarto salto rifiutato con un messaggio. Scheda «Giornata completa» con compagno felice, nome del tema, «+10 monete +5 vita» e animazione breve, fino al cambio di giornata; sparisce se un annullamento riapre il giorno.
- **Fatto quando:** i test coprono salto con motivo, salti rimasti, quarto rifiutato, giornata completa che compare e sparisce dopo un annullamento.
- **Dipende da:** T41.

### [ ] T60 – Missioni misurabili (quantità)
- **Obiettivo:** tracciare quantità e non solo un sì.
- **Riferimenti:** `analisi-funzionale.md` US-EDT-03, US-OGGI-03, US-NOT-01; `design-sezioni.md` 4.7, 2.5, 11.3. Mockup: D15 in `docs/mockup/`.
- **Da fare:** nell'editor «Obiettivo misurabile» con Sì/No e Quantità (Durata arriva nel T79): valore, unità da chip più una personalizzata, incremento proposto e modificabile (proposta: circa un ottavo dell'obiettivo arrotondato a un numero comodo; annotalo nel Diario). In Oggi il tocco aggiunge l'incremento con `progressMission` e l'anello avanza; la pressione lunga apre «Inserisci valore»; avanzamento «1,2 di 2 L» con i decimali della lingua. Dalla notifica il pulsante diventa «+250 ml».
- **Fatto quando:** i test coprono parziale, raggiungimento con ricompensa una volta sola, superamento senza altro, valore inserito a mano, etichetta della notifica.
- **Dipende da:** T45.

### [ ] T61 – Editor: altre frequenze e libreria dei modelli
- **Obiettivo:** frequenze flessibili e partenza da un modello.
- **Riferimenti:** `analisi-funzionale.md` US-EDT-04; `design-sezioni.md` 4.6, 4.11; `CLAUDE.md` scelte minori 9, 15, 16. Mockup: D14, D17 in `docs/mockup/`.
- **Da fare:** frequenze «N volte a settimana» (contatore 1–6) e «Ogni N giorni» (contatore 2–30 e data di inizio). Libreria «Usa un modello» a tutta altezza con ricerca, 4 categorie e schede con frequenza, difficoltà e statistica; il tocco riempie l'editor senza salvare. Il pulsante «Usa un modello» delle Abitudini vuote apre la libreria.
- **Fatto quando:** i test coprono le due frequenze salvate e lette, il modello che riempie l'editor senza creare la missione, la ricerca nella libreria.
- **Dipende da:** T44.

### [ ] T62 – Abitudini: ricerca e pausa
- **Obiettivo:** trovare in fretta una missione e sospenderla durante una vacanza.
- **Riferimenti:** `analisi-funzionale.md` US-ABI-02; `design-sezioni.md` 3.3, 3.6, 3.11. Mockup: D18, D19 in `docs/mockup/`.
- **Da fare:** Cerca che filtra mentre si scrive nel filtro attivo (con Tutte anche le archiviate in fondo), «Crea “…”» che apre l'editor col nome, filtro ricordato. Pausa: foglio «Fino a quando?» (3 giorni, 1 settimana, 2 settimane, data, senza fine), gruppo «In pausa» in fondo, riga «In pausa fino al 12 novembre» con il lucchetto sulla serie, «Riprendi» come prima azione del menu, avviso in Oggi alla riattivazione.
- **Fatto quando:** i test coprono ricerca, nessun risultato con Crea, pausa con e senza data, riattivazione automatica alla data con avviso, serie congelata.
- **Dipende da:** T46.

### [ ] T63 – Quest di partenza e schiusa
- **Obiettivo:** insegnare l'app giocando nei primi minuti.
- **Riferimenti:** `analisi-funzionale.md` US-ONB-04; `design-sezioni.md` 1.7, 1.8, 1.9, 6.5; `CLAUDE.md` scelta minore 12. Mockup: D06, D26 in `docs/mockup/`.
- **Da fare:** scheda dedicata della quest in Oggi con il nome del tema e i 3 passi (il primo già fatto), fumetto del compagno sulla prima missione che sparisce al primo completamento; schiusa a schermo intero al primo completamento con scelta o conferma del nome; il collegamento a Statistiche nella scheda dell'eroe pulsa una volta e aprire la schermata completa il terzo passo; vittoria più piccola di un boss; poi la riga «Trasforma un obiettivo in un boss».
- **Fatto quando:** un test percorre la quest dall'arrivo su Oggi alla vittoria con le ricompense della scelta minore 12; altri test coprono il fumetto e la schiusa con Riduci movimento.
- **Dipende da:** T42, T50, T52.

### [ ] T64 – Compagno: umore ed evoluzione
- **Obiettivo:** un umore chiaro e mai colpevolizzante, e il passaggio ad adulto.
- **Riferimenti:** `analisi-funzionale.md` US-COMP-01, US-COMP-02; `design-sezioni.md` 6.3, 6.6; `CLAUDE.md` scelta minore 13. Mockup: B8, D26, D35 in `docs/mockup/`.
- **Da fare:** scheda dell'umore con la parola, la percentuale degli ultimi 3 giorni e, se triste, «Completa una missione oggi e tornerà felice»; sprite e fumetti nell'umore giusto in Oggi e nella scheda; al passaggio ad adulto una dissolvenza tra i due sprite con «Blob è cresciuto!» (l'animazione completa è il T85) e l'avviso in Oggi.
- **Fatto quando:** i test coprono i tre umori, il ritorno a felice dopo un completamento e il momento dell'evoluzione a 150 completamenti.
- **Dipende da:** T50.

### [ ] T65 – Boss: Sala dei trofei e scadenze
- **Obiettivo:** rivedere i boss sconfitti e rendere leggera la scadenza mancata.
- **Riferimenti:** `analisi-funzionale.md` US-BOSS-03, US-BOSS-04; `design-sezioni.md` 5.1 (anteprima), 5.6, 5.7, 11.6. Mockup: D24, D25, D22 in `docs/mockup/`.
- **Da fare:** Sala dei trofei a griglia di 3 colonne con nome, data e giorni impiegati, dettaglio, stato vuoto; anteprima degli ultimi 3 sotto i boss attivi e collegamento dal Profilo. Scadenza vicina: chip pericolo e «Mancano 3 giorni». Scadenza mancata: foglio alla prima apertura con battuta del tema, monete rubate, «I tuoi 5 passi restano», «Fissa una nuova scadenza» in evidenza e «Archivia l'obiettivo». Notifica dell'avviso a 3 giorni sul canale Boss tramite lo scheduler, una sola per boss.
- **Fatto quando:** i test coprono trofei in ordine, sala vuota, foglio del furto mostrato una volta, nuova scadenza, notifica programmata una sola volta.
- **Dipende da:** T49, T45.

### [ ] T66 – Statistiche: heatmap
- **Obiettivo:** la costanza dell'anno a colpo d'occhio.
- **Riferimenti:** `analisi-funzionale.md` US-STAT-01; `design-sezioni.md` 8.3, 8.10, 8.12. Mockup: B9, D30 in `docs/mockup/`.
- **Da fare:** query giornaliera da `day_summaries` e `mission_days`; striscia a settimane con gli ultimi 5 mesi visibili e scorrimento fino a 12, oggi a destra con il contorno; 4 livelli di colore (heatmap 0–4 del tema) e cella vuota per i giorni senza missioni previste; legenda; tocco su un giorno con foglio di data, percentuale e missioni (fatta, mancata, saltata). Lettura per settimana con il lettore di schermo.
- **Fatto quando:** i test coprono i 4 livelli, giorno senza missioni, saltate escluse dal totale, foglio del giorno, annuncio della settimana.
- **Dipende da:** T52.

### [ ] T67 – Statistiche: Registro
- **Obiettivo:** lo storico completo, filtrabile.
- **Riferimenti:** `analisi-funzionale.md` sezione 8 («Registro»); `design-sezioni.md` 8.6, 8.11; `modello-dati.md` 4.2, 4.3. Mockup: D32 in `docs/mockup/`.
- **Da fare:** scheda Registro con voci raggruppate per giorno («Oggi», «Ieri», «Lunedì 27 ottobre»), icona del tipo, testo nel lessico del tema e variazioni a destra; coppie annullate nascoste insieme; chip Tutto, Completamenti, Salti, Boss, Oggetti; foglio Filtra per missione e date; annullamento dal menu della voce con conferma, con le regole del T40. Missioni eliminate escluse.
- **Fatto quando:** i test coprono raggruppamento, filtri, coppia annullata nascosta, annullamento dalla voce, eliminate escluse.
- **Dipende da:** T52.

### [ ] T68 – Completamento dimenticato
- **Obiettivo:** correggere un giorno dimenticato fino a 7 giorni prima (US-STAT-03).
- **Riferimenti:** `analisi-funzionale.md` US-STAT-03; `design-sezioni.md` 8.3 e 8.6; `xp-e-monete.md` sezione 1 («Proposta» sui completamenti dimenticati); `modello-dati.md` 4.2 (`mission.backfilled`). Mockup: D30, D32 in `docs/mockup/`.
- **Da fare:** `backfillCompletion` in TDD con evento `mission.backfilled`, senza vita restituita e senza riparare una serie spezzata; pulsante «+ Completamento dimenticato» nel Registro e nel foglio del giorno della heatmap, con le missioni previste negli ultimi 7 giorni e non fatte e la riga che spiega cosa non restituisce. **Le ricompense dipendono da una regola ancora «Proposta»: se in `CLAUDE.md` non c'è la scelta minore che la decide (task C13), segna il task `[!]`.**
- **Fatto quando:** i test coprono il limite di 7 giorni, nessuna vita restituita, serie non riparata, ricompense come da scelta minore, eroe uguale alla somma del registro.
- **Dipende da:** T66, T67.

### [ ] T69 – Profilo: freccia di forma
- **Obiettivo:** capire quali statistiche si stanno trascurando, senza punire.
- **Riferimenti:** `analisi-funzionale.md` US-PROF-05; `design-sezioni.md` 9.4; `statistiche-eroe.md`. Mockup: B7, D33 in `docs/mockup/`.
- **Da fare:** query dei punti per statistica negli ultimi 30 giorni e nei 30 precedenti, `formArrow` del T08; ↑ nel colore fatto, ↓ in testo tenue, nessuna freccia nei primi 30 giorni; lettura «in crescita» o «in calo» per il lettore di schermo.
- **Fatto quando:** i test coprono le tre situazioni e i primi 30 giorni.
- **Dipende da:** T54.

### [ ] T70 – Badge
- **Obiettivo:** traguardi con condizioni chiare e monete bonus.
- **Riferimenti:** `analisi-funzionale.md` US-PROF-02; `design-sezioni.md` 9.6; `modello-dati.md` 3.9; `xp-e-monete.md` sezione 2 («Badge sbloccato»). Mockup: D34, D35 in `docs/mockup/`.
- **Da fare:** `src/content/badges.ts` con almeno 20 badge (bozza, scelta minore 7); `checkBadges` puro in `src/rules/` e azione nel repository con evento `badge.unlocked` e monete; controllo dopo ogni azione che può sbloccarli; riga nel Profilo «Badge · 12 di 38», griglia con condizione e avanzamento, dettaglio, momento dello sblocco. **Le monete per badge non sono ancora decise: se in `CLAUDE.md` non c'è la scelta minore (task C13), segna il task `[!]`.**
- **Fatto quando:** i test coprono sblocco con monete, nessuno sblocco doppio, avanzamento dei bloccati, eroe uguale alla somma del registro.
- **Dipende da:** T54.

### [ ] T71 – Modalità Essenziale
- **Obiettivo:** l'app come tracker pulito, senza perdere dati.
- **Riferimenti:** `analisi-funzionale.md` US-IMP-02; `design-sezioni.md` A9, 2.10, 3.10, 4.14, 5.10, 6.11, 7.9, 8.11, 9.9, 10.4, 10.11, 11.8. Mockup: D37 in `docs/mockup/`.
- **Da fare:** gruppo Gioco nelle Impostazioni con Completo ed Essenziale e il foglio di conferma che elenca cosa sparisce; `useGameMode()`; in Essenziale: scheda dell'eroe ridotta a una riga, niente vita, monete, Negozio e scheda del boss; Obiettivi come elenco di passi; scheda del personaggio e collegamenti a Negozio e Sala nascosti; Registro senza voci di vita, boss e monete; «Obiettivo collegato» nell'editor; momenti a schermo intero ridotti a un avviso; testi delle notifiche senza XP, monete e boss. Gli scudi continuano a funzionare.
- **Fatto quando:** i test passano da Completo a Essenziale e ritorno verificando elementi nascosti e dati invariati; un test verifica che in Essenziale non si perda vita alla chiusura del giorno.
- **Dipende da:** T55, T65.

### [ ] T72 – Riduci movimento e vibrazioni
- **Obiettivo:** il gruppo Accessibilità delle Impostazioni.
- **Riferimenti:** `design-sezioni.md` 10.7, A7, A8.
- **Da fare:** Riduci movimento con Come il telefono (default), Sì, No, letto da `useReduceMotion()` del T37; interruttore Vibrazioni (acceso di default) rispettato da `useCelebration()`; riga che rimanda a Colori per daltonici se il T82 è fatto. Controlla che tutte le animazioni dei task precedenti passino da questi hook (annota nel Diario quelle corrette).
- **Fatto quando:** i test coprono le tre scelte e le vibrazioni spente.
- **Dipende da:** T55.

### [ ] T73 – Notifiche: riepilogo serale, Posticipa e testi
- **Obiettivo:** poche notifiche, nel tono del tema, che si chiudono con un tocco.
- **Riferimenti:** `analisi-funzionale.md` sezione 11, US-NOT-02; `design-sezioni.md` 11.1–11.5, 11.9. Mockup: D40 in `docs/mockup/`.
- **Da fare:** canali Android (Promemoria, Riepiloghi, Boss, Richiamo); testi nel lessico del tema con il nome della missione come titolo; Posticipa «Tra 10 min» fino a 3 volte (verifica e completa il codice del T32); conferma breve «Fatto! +20 XP · +5 monete» dopo Completa; 3 o più promemoria nello stesso minuto raggruppati; tocco che apre Oggi con la riga evidenziata. Riepilogo serale all'ora impostata con al massimo 3 missioni e «e altre 2», oppure il complimento se è tutto fatto, riprogrammato dopo ogni completamento e all'avvio.
- **Fatto quando:** i test coprono testi per tema, terzo posticipo senza pulsante, raggruppamento, testo del riepilogo con 0, 2 e 5 missioni rimaste.
- **Dipende da:** T60.

### [ ] T74 – Notifiche recenti e bollino
- **Obiettivo:** ritrovare le notifiche non viste in app, sul widget e sull'icona.
- **Riferimenti:** `design-sezioni.md` 11.7, 12.1; `modello-dati.md` 3.9 (`app_notifications`). Mockup: D41 in `docs/mockup/`.
- **Da fare:** scrittura in `app_notifications` di ogni notifica mandata; foglio «Notifiche recenti» su Oggi (dalla più nuova, con ora, testo e Completa per i promemoria aperti) che si apre se ci sono notifiche non viste quando si arriva dal widget; chiuso il foglio, `seen_at` e bollino a zero (`setBadgeCountAsync` su iPhone).
- **Fatto quando:** i test coprono conteggio delle non viste, apertura del foglio, Completa dal foglio e azzeramento.
- **Dipende da:** T73.

### [ ] T75 – Widget piccolo e medio
- **Obiettivo:** completare le missioni senza aprire l'app.
- **Riferimenti:** `analisi-funzionale.md` sezione 12, US-WID-01; `design-sezioni.md` 12.1–12.4, 12.9, 12.10; `stack-tecnologico.md` punto 6. Mockup: B10 in `docs/mockup/`.
- **Da fare:**
  - `buildWidgetSnapshot(todayView, theme, gameMode)` puro in TDD: serie, livello, missioni rimaste, prime 4 missioni (Piano prima), umore del compagno, notifiche non viste, colori del tema, stati giornata completa e riposo; scritto nello spazio condiviso dopo ogni azione e al cambio di giornata.
  - Widget piccolo 2×2 e medio 4×2 con expo-widgets: cerchio che completa con `completeMission` (`source: 'widget'`, chiave di idempotenza), nome che apre l'app sulla missione, «e altre 3», incremento per le misurabili, versione Essenziale. Se expo-widgets non supporta l'SDK del progetto, segna `[!]` con il motivo (alternativa per Android nello stack: react-native-android-widget).
- **Fatto quando:** i test dello snapshot coprono 0, 3 e 6 missioni, Piano prima, giornata completa, riposo ed Essenziale; un test verifica che il completamento dal widget conti una volta sola. La prova sul telefono la fa Claudio (C18, C19).
- **Dipende da:** T74.

### [ ] T76 – Dati di salute
- **Obiettivo:** passi, attività e sonno che completano da soli le missioni.
- **Riferimenti:** `analisi-funzionale.md` US-WID-02; `design-sezioni.md` 12.7; `stack-tecnologico.md` punto 7.
- **Da fare:** interfaccia `HealthSource` con @kingstinct/react-native-healthkit e react-native-health-connect (plugin in `app.json`) e una versione finta per i test; riga «Collega a Salute» nell'Obiettivo misurabile con passi, minuti di attività e ore di sonno, permesso chiesto solo lì; lettura all'apertura e nel task in background con `progressMission` (`source: 'health'`, chiave di idempotenza per missione e giorno); icona a cuore e valore in Oggi; notifica «Obiettivo raggiunto» che rispetta Non disturbare; permesso negato spiegato nella riga.
- **Fatto quando:** i test con la sorgente finta coprono avanzamento, completamento una sola volta, permesso negato, notifica dentro Non disturbare rimandata.
- **Dipende da:** T60, T73.

---

## Fase 7 – Could

### [ ] T77 – (Could) Abitudini: riordino e scorrimento
- **Obiettivo:** mettere in ordine le missioni con pochi gesti.
- **Riferimenti:** `design-sezioni.md` 3.4, 3.5, 3.11.
- **Da fare:** modalità Riordina da «Altro» con maniglie e Fine, trascinamento dentro e tra categorie (cambia la categoria), «Sposta su/giù» per il lettore di schermo, ordine usato anche in Oggi per le missioni senza orario; scorrimento a sinistra con Pausa e Archivia (lungo archivia subito con Annulla), a destra Modifica.
- **Fatto quando:** i test coprono spostamento nella stessa categoria e in un'altra, ordine in Oggi, archiviazione con lo scorrimento lungo.
- **Dipende da:** T62.

### [ ] T78 – (Could) Editor: frequenze mensile e annuale, categoria, icona, note, statistica secondaria
- **Obiettivo:** gli ultimi campi avanzati dell'editor.
- **Riferimenti:** `design-sezioni.md` 4.4, 4.6, 4.9; `CLAUDE.md` scelta minore 1.
- **Da fare:** Mensile (griglia 1–31 e «Ultimo giorno del mese»), Annuale (giorno e mese); Categoria e icona con griglia; Note su più righe, visibili nel dettaglio; statistica secondaria con la principale spenta e «riceve il 30% dei punti», anche nell'anteprima delle ricompense.
- **Fatto quando:** i test coprono ogni campo salvato e letto e l'anteprima con la secondaria.
- **Dipende da:** T61.

### [ ] T79 – (Could) Missioni a durata con timer
- **Obiettivo:** misurare il tempo, anche a schermo spento.
- **Riferimenti:** `analisi-funzionale.md` US-EDT-03; `design-sezioni.md` 2.5, 4.7.
- **Da fare:** Durata nell'Obiettivo misurabile (chip 5, 10, 15, 30, 60 e contatore); in Oggi il play al posto della spunta, conto alla rovescia e barra sottile; il timer salva l'istante di partenza (sopravvive alla chiusura dell'app) e programma una notifica locale alla fine; alla fine la missione si completa con una vibrazione.
- **Fatto quando:** i test con l'orologio finto coprono avvio, pausa, ripresa dopo il riavvio dell'app e completamento alla fine.
- **Dipende da:** T60.

### [ ] T80 – (Could) Richiamo dopo 3 giorni e firma del compagno
- **Obiettivo:** un solo richiamo gentile e promemoria firmati.
- **Riferimenti:** `design-sezioni.md` 11.2, 11.6, 10.6.
- **Da fare:** notifica di richiamo programmata 3 giorni dopo l'ultima apertura e riprogrammata a ogni apertura, interruttore nelle Impostazioni (acceso di default); firma «— Blob» in fondo ai testi delle notifiche con il nome del compagno.
- **Fatto quando:** i test coprono riprogrammazione all'apertura, interruttore spento e firma con nome di default e scelto.
- **Dipende da:** T73.

### [ ] T81 – (Could) Riepilogo settimanale e andamento delle statistiche
- **Obiettivo:** vedere i successi della settimana e la crescita nel tempo.
- **Riferimenti:** `analisi-funzionale.md` US-STAT-04; `design-sezioni.md` 8.7, 8.8, 10.6.
- **Da fare:** `weeklyRecap` puro (missione più costante, danni ai boss, livelli e punti guadagnati, record battuti; solo successi); scheda in cima alla Panoramica da domenica sera alla domenica dopo, le precedenti nel Registro; notifica della domenica alle 19:00 (impostabile) che apre la scheda. Grafico a linee del livello di una statistica mese per mese, con chip per sceglierla e la frase «Forza: da 3 a 7 negli ultimi 3 mesi».
- **Fatto quando:** i test coprono una settimana buona e una scarsa (solo successi), la scheda visibile nel periodo giusto e i dati del grafico.
- **Dipende da:** T67, T73.

### [ ] T82 – (Could) Esportazione CSV e colori per daltonici
- **Obiettivo:** dati portabili e una palette per chi distingue male i colori.
- **Riferimenti:** `analisi-funzionale.md` US-IMP-04; `design-sezioni.md` A4, 10.2, 10.8.
- **Da fare:** `exportCsv(db)` con missioni e registro completo, condiviso con il foglio di sistema (expo-sharing). Interruttore «Colori per daltonici» che passa heatmap, barre e stati alla scala blu–arancio uguale in tutti i temi. **Se la scala non è in `temi.json`, fai solo il CSV e annota nel Diario che manca la palette (task C15).**
- **Fatto quando:** i test coprono intestazioni e righe del CSV (con virgole e a capo nei nomi) e il cambio dei colori nella heatmap.
- **Dipende da:** T66.

### [ ] T83 – (Could) Main Quest e catene di obiettivi
- **Obiettivo:** un obiettivo principale in cima a Oggi e obiettivi in sequenza.
- **Riferimenti:** `analisi-funzionale.md` sezione 5 e «Funzioni di fasi successive»; `design-sezioni.md` 5.8.
- **Da fare:** colonne nuove sul boss con una migrazione (`is_main`, `chain_prev_id` o simili, motivate nel Diario); «Fissa come Main Quest» con corona e scheda sopra il Piano; boss di una catena uniti da una linea, il successivo bloccato fino alla vittoria del precedente e non contato tra i 3 attivi finché è bloccato (se il limite va contato diversamente, segna `[!]`).
- **Fatto quando:** i test coprono una sola Main Quest alla volta, sblocco del successivo alla vittoria e migrazione applicata da zero.
- **Dipende da:** T65.

### [ ] T84 – (Could) Badge delle statistiche
- **Obiettivo:** traguardi nel lessico del tema per ogni statistica.
- **Riferimenti:** `analisi-funzionale.md` sezione 9; `design-sezioni.md` 9.5; `statistiche-eroe.md`.
- **Da fare:** tre badge per statistica ai livelli 3, 6 e 10 con i nomi del tema (bozza), in fondo al foglio di dettaglio della statistica e nella griglia dei badge.
- **Fatto quando:** i test coprono lo sblocco ai tre livelli e i nomi per tema.
- **Dipende da:** T70.

### [ ] T85 – (Could) Animazione di evoluzione del compagno
- **Obiettivo:** un momento memorabile al passaggio ad adulto.
- **Riferimenti:** `design-sezioni.md` 6.6, A7; `stack-tecnologico.md` punto 8.
- **Da fare:** animazione a sprite con Reanimated (luce, cambio di forma, saluto) per tema al posto della dissolvenza del T64, saltabile e ridotta con Riduci movimento. Se gli sprite intermedi non ci sono, segna `[!]` e annota cosa serve (task C15).
- **Fatto quando:** i test coprono avvio, salto e versione ridotta.
- **Dipende da:** T64.

### [ ] T86 – (Could) Regali per il compagno e ricompense personali
- **Obiettivo:** dare alle monete un uso affettivo e uno nella vita reale.
- **Riferimenti:** `analisi-funzionale.md` US-COMP-04, US-NEG-03; `design-sezioni.md` 6.8, 7.6; `xp-e-monete.md` sezione 2; `modello-dati.md` 3.9 (`rewards`).
- **Da fare:** regali nel Negozio, «Fai un regalo» nella scheda del compagno con esultanza e umore che sale di un livello fino a domani; ricompense personali con nome ed entità, prezzo automatico, riscatto con evento `reward.redeemed`; tabella `rewards` con la sua migrazione. **I prezzi di regali e ricompense non sono decisi: se in `CLAUDE.md` non ci sono (task C13), segna il task `[!]`.**
- **Fatto quando:** i test coprono acquisto e dono del regalo, umore alzato fino al cambio di giornata, riscatto della ricompensa, eroe uguale alla somma del registro.
- **Dipende da:** T64, T51.

### [ ] T87 – (Could) Live Activity del timer (iPhone)
- **Obiettivo:** il timer sulla schermata di blocco e nella Dynamic Island.
- **Riferimenti:** `design-sezioni.md` 12.5; `stack-tecnologico.md` punto 6.
- **Da fare:** Live Activity con expo-widgets avviata dal play, con nome, tempo che manca, Pausa e Completa; chiusura con «Fatto!» alla fine. La prova è di Claudio su iPhone (C19).
- **Fatto quando:** i test della logica di avvio e chiusura con il modulo finto passano e `npx expo export --platform ios --output-dir dist-check` passa.
- **Dipende da:** T79, T75.

**Fuori dal loop:** smartwatch (Could, richiede codice nativo per Apple Watch e Wear OS), quarto stadio del compagno (Could, non ancora approvato), comandi vocali e acquisto di altri compagni (Won't).

---

## Task per Claudio (fuori dal loop)

| # | Cosa | Quando | Sblocca |
| --- | --- | --- | --- |
| C12 | Copiare nel repository `docs/backlog-schermate.md`, il nuovo `docs/prompt-loop.md` e i file nuovi di `docs/riferimenti/` (`temi.json`, `colori-v2.json`, `lessico-v2.json`, `misure-componenti.md`, `lacune-design-schermate.md`, `design-sezioni.md`, `registro-decisioni.md`) senza sovrascrivere `docs/backlog-task.md` (ha gli stati e il Diario); copiare la cartella `sviluppo/mockup-per-claude-code/` in `docs/mockup/` (36 MB, solo riferimento; se pesa troppo per Git, tenerla fuori dal commit e dirlo nel Diario); applicare prima il prompt delle decisioni aperte (scelte minori 15–19) | Prima di riavviare il loop | T33b, T34, T35 |
| C13 | Decidere e aggiungere a `CLAUDE.md` come scelte minori: (a) vita del boss quando si aggiungono o tolgono passi dopo la creazione e come si elimina un boss (il modello dati non ha `deleted_at` né `boss.deleted`) → scelta 21; (b) ricompense dei completamenti dimenticati (proposta aperta di C06); (c) monete per badge; (d) prezzi di regali e ricompense personali | Prima di T49, T68, T70, T86 | quei task |
| C14 | Rivedere i contenuti in bozza delle schermate: saluti, frasi e fumetti del compagno, battute del boss, testi delle notifiche, nomi degli stadi, elenco dei badge, chiavi nuove in tedesco, francese e spagnolo (elenco nel Diario) | Man mano, dopo T50, T65, T70, T73 | – |
| C15 | Far preparare gli ultimi asset: logo e icona dell'app definitivi, sprite intermedi di evoluzione, icone vere di scudo e pozione, elenco dei titoli dell'eroe per livello, scala per daltonici; poi ricopiarli in `assets/` | Quando servono | rifiniture, T82, T85 |
| C16 | Emulatore di Android Studio e Maestro (sostituisce C11): development build sull'emulatore, `npm run e2e`, screenshot di Oggi nei 6 temi | Dopo T58 | test end-to-end |
| C17 | Backup: creare l'ID client OAuth di Google per Drive (Android) e il container iCloud (iOS, serve l'account Apple Developer), metterli nella configurazione, provare backup e ripristino tra due installazioni | Dopo T57 | backup reale |
| C18 | Prova su Android con la development build: promemoria reali con Non disturbare, Posticipa e riepilogo serale, widget, Health Connect | Dopo T73, T75, T76 | uscita Android |
| C19 | iOS: iscrizione all'Apple Developer Program, `eas build --profile development --platform ios` (in cloud, senza Mac), installazione sull'iPhone; prova di azioni delle notifiche, widget (iOS 17+), backup iCloud, Apple Salute e, se fatta, Live Activity | Quando Android regge | uscita iOS |
| C20 | Una settimana d'uso vero e revisione di accessibilità: TalkBack e VoiceOver sui flussi principali, testo al 200%, Riduci movimento, contrasti nei 6 temi; annotare le correzioni come nuovi task | Dopo la fase 5 | rifiniture |

---

## Diario

Una riga per task chiuso o bloccato: data, codice, cosa è stato fatto, scelte minori e contenuti da rivedere.

| Data | Task | Esito | Note |
| --- | --- | --- | --- |
| 2026-11-08 | T33b | ✅ fatto | **Temi:** `temi.json` v2 con 18 ruoli uguali in tutti i temi (più `vitaTesto`, `fattoTesto`, `moneteTesto`, `pericoloTesto`, `infoTesto`), heatmap a 4 livelli, `TEXT_PAIRS` sulle varianti `*Testo` (nessuna coppia sotto 4,5:1, tolte da `KNOWN_LOW_CONTRAST`); nessun ruolo vecchio nel codice (Grep). Compagni Pixel, Rocky, Glitchy, Lumin, Cloudy; `navLabel` nella tipografia. **Lessico (A11.2, `lessico-v2.json`):** ognuno dei 7 termini (vita, esperienza, monete, missioni, boss, serie, livello) ha in tutte e 5 le lingue singolare (`hp_<tema>`), plurale (`hp_pl_<tema>`) e genere (`hp_g_<tema>`), più la forma generica senza tema; it e en copiati dal file e verificati da un test che lo legge; titoli di vittoria, Profilo, Statistiche e «Modifica + singolare» ricavati dal singolare (vittoria Lovecraft: it «L'Orrore è ricacciato», en «The Horror is banished»; missioni Fantasy in en: «Deed», «Edit deed»). Il vecchio `lessico` di `temi.json` tiene solo i compagni. Test «ogni chiave in 5 lingue» invariato (33 termini di base). **Navigazione:** barra a 4 voci più il [+]; etichette non tematizzate, su una riga, scala del testo ferma a `LARGE_TEXT_SCALE` = 1,3 e troncate con «…» (`NavLabel`, A11.1), etichetta completa al lettore di schermo; Statistiche è la rotta in pila `app/stats.tsx`. Test: 4 voci più il [+], Statistiche come rotta, etichette a una riga con scala 1,3. **Caratteri:** quelli del tema coincidono con `temi.json`, nessuna differenza. **Da rivedere (C14):** de, fr, es di tutti i termini (singolare, plurale, genere) e dei titoli, in bozza; in tedesco ho usato anche il genere `n` (neutro), che `lessico-v2.json` non prevede (solo m/f). **Rimandato:** la regola Press Start 2P di A11.1 (corpo arrotondato per difetto al multiplo di 2 con `fontScale ≥ 1,3`) e gli altri layout per testo grande valgono per i componenti dei task successivi; `LARGE_TEXT_SCALE` è già in `src/theme/textScale.ts`. Branch: `task/T33b-align-theme-lexicon-navigation`. |
| 2026-11-08 | T33b | ✅ chiuso | Punto aperto deciso da Claudio l'08/11/2026: il tedesco usa il genere neutro `n` (das Level, das Leben), quindi il lessico ammette `m`/`f`/`n` solo in `de`. Il test di `src/i18n/i18n.test.ts` già lo accetta. Incoerenza nei documenti: `docs/riferimenti/lessico-v2.json` (e la sua nota «genere (m/f)») ammette solo `m`/`f`; va aggiornato nella cartella di progetto di Claudio, la copia qui non si modifica. Il lessico de/fr/es resta bozza (scelta 7). |
| 2026-11-08 | T34 | ✅ fatto | Verifica: `npm run check` verde (532 test) e bundle Android costruito (`dist-check/` poi cancellata). **Fatto:** in `src/features/shared/` Card, Button, Bar, Difficulty, Chip, SegmentedControl, ScreenHeader, Sheet, ActionSheet, useLargeText, ConfirmDialog, UndoToast (con `UndoToastProvider` in `AppProviders`), EmptyState, più gli aiuti ThemedText (limiti A3 e multipli di 2 di Press Start 2P), Frame e touch; forme in `src/theme/shapes.ts`. Jest usa il resolver di Reanimated e `test/setup.ts`. **Scelte minori:** il pulsante distruttivo riempie con `pericoloTesto` e non con `pericolo`: in Minimal chiaro `suPrimario` su `pericolo` sta sotto 4,5:1 (il mockup usa `pericolo`); velo di fogli e dialoghi nero al 45% (`SCRIM`), fisso e fuori dai ruoli; tacche di Lovecraft a cerchi come `misure-componenti.md` e gli asset (A6 dice «occhi»); avviso con Annulla a 16 sopra la barra da 64 anche nelle schermate senza barra; distanze di chiusura del foglio (96 punti o 800 di velocità) e spazio tra i segmenti Cyberpunk (2) in bozza. **Rimandato:** freccia Indietro di ScreenHeader provvisoria fino all'`Icon` del T35; tratto a righe della vita protetta del boss (mockup e 5.11) non incluso in `Bar`; aspetto e trascinamento del foglio non provati su un telefono. **Da rivedere (C14):** chiavi `shared` in de, fr, es, in bozza. Branch: `task/T34-shared-components`. |
| 2026-11-08 | T34 | ✅ corretto dopo la review | Correzioni dalla review della PR #4. **Maniglia di `Sheet`:** con TalkBack era un pulsante che non faceva nulla (`onAccessibilityTap` esiste solo su iOS): ora ha anche l'azione `activate`; area alta almeno 44/48 (`MIN_TOUCH`), che cambia l'aspetto solo dei fogli senza titolo. **Velo di `Sheet` e `ConfirmDialog`:** non è più un secondo «Chiudi» o «Annulla» per il lettore di schermo su Android, dove `accessibilityViewIsModal` non vale; si tocca ancora con il dito. Verifica: `npm run check` verde (538 test) e bundle Android costruito; TalkBack e VoiceOver non provati su un telefono. **Da decidere (Claudio):** `Bash(git switch:*)` permette anche di passare a `main`; `git push` non è in `deny`. |
| 2026-11-08 | T34 | ✅ corretto dopo la seconda review | **Titolo di `Sheet`:** ora il lettore di schermo lo raggiunge, perché il pulsante «Chiudi» gli sta accanto e non intorno; il `testID` del pulsante diventa `<prefisso>-close`, mentre `-handle` resta l'area di trascinamento. **`SegmentedControl`:** come nei fogli `componenti/lotto2-*`, il segmento scelto è un riempimento semplice alto 32, a 4 dal bordo del controllo da 40, senza cornice a pixel né angoli tagliati; raggio = raggio del controllo − 4 (10 in Minimal, 4 in Fantasy, 0 negli altri), ricavato dal mockup. **Incoerenze nei documenti:** in Arcade il mockup disegna chip e controlli con cornice 3 e il segmentato alto circa 44, `misure-componenti.md` dice cornice 2 e alto 40: ho tenuto le misure approvate; il pulsante distruttivo usa `pericoloTesto` e il mockup `pericolo`, da allineare nella cartella di progetto. Verifica: `npm run check` verde e bundle Android costruito; aspetto e lettori di schermo non provati su un telefono. |
| 2026-11-08 | T34 | ✅ corretto dopo la prova su telefono | Prova di Claudio su un telefono Android con una development build, usando una schermata temporanea sul branch `chore/t34-device-test`, da non mergiare. **Difetto corretto:** con TalkBack, toccare il titolo di `Sheet` leggeva «Chiudi»: su Android un testo senza `onPress` non è `accessible` (`Libraries/Text/Text.js` di React Native) e il pulsante copre la stessa zona. Ora il titolo è `accessible`; la riga è stata provata sul telefono con TalkBack. Non serve spostare il pulsante, quindi l'aspetto non cambia. **Esito delle altre voci:** trascinamento, velo e Indietro, «Chiudi» con TalkBack, un solo «Annulla» in `ConfirmDialog`, segmentato nei temi, `UndoToast`, pulsante distruttivo, temi e testo molto grande funzionano. **Da ricontrollare in una build di produzione:** il cambio tema ha un ritardo visibile. **Da decidere (Claudio):** all'apertura del foglio TalkBack seleziona «Chiudi» e non il titolo. VoiceOver resta non provato. Verifica: `npm run check` verde e bundle Android costruito. |
| 2026-11-08 | T34 | Punto chiuso | Deciso da Claudio l'08/11/2026: all'apertura di `Sheet` il focus di TalkBack resta su «Chiudi», senza modifiche al codice. Dalla quarta review della PR #4 nessun punto bloccante; i tre non bloccanti non richiedono modifiche prima del merge. |
| 2026-11-08 | T35 | ✅ fatto | Verifica: `npm run check` verde (574 test) e bundle Android costruito (`dist-check/` poi cancellata); aspetto e lettori di schermo non provati su un telefono. **Fatto:** in `src/features/shared/` Icon (pixel in Arcade, linea con il tratto del tema altrove, corpi 24, 20, 16), Sprite, CompanionSprite, BossSprite (Minimal: icona a linea in un cerchio), Logo; asset copiati in `assets/design/`; `scripts/build-assets.mjs` genera i 60 PNG in `assets/sprites/` e i dati in `src/features/shared/generated/`, da rilanciare a mano quando cambiano gli asset; barra in basso e freccia Indietro di `ScreenHeader` ora usano `Icon` (rimando del T34 chiuso). **Segnaposto, tutti in `placeholders.ts`:** logo e sprite intermedi di evoluzione; a linea in bozza `oggi` (ha solo il file pixel) e `abitudini`, `nuovo`, `boss`, `profilo` (nessun file in `lotto1`); altre 18 icone senza file a linea mostrano il disegno pixel in tutti i temi, tra cui scudo e pozione, che non hanno ancora un disegno vero. L'icona dell'app resta segnaposto in `app.json`, perché gli store leggono file PNG: è l'unica eccezione al punto unico. **Scelte minori:** tratto di Arcade in `shapes.ts` in bozza, serve solo ai segnaposto senza pixel; i nomi delle icone restano in italiano, uguali ai file di `lotto1`, anche se il codice è in inglese; le descrizioni dei boss vengono da `esito-lotto3.md`; timeout di 30 secondi per il test che disegna ogni icona in ogni tema, perché con la coverage ha superato i 5 secondi di Jest. **Incoerenze nei documenti:** il task cita «Blob, cucciolo, felice» e A5 il compagno «Goccia», ho seguito la decisione dell'08/11 (Pixel, Cloudy); A5 chiede tre boss per tema, gli asset ne hanno quattro con quello della quest. **Da rivedere (C14):** chiavi `shared.companionSprite` e `shared.bossSprite` in en, de, fr, es, in bozza, e «esultante» in it. Branch: `task/T35-icons-sprites`. |
| 2026-11-08 | T35 | ✅ icone a linea complete | Claudio ha consegnato dal design 29 icone a linea nei temi Minimal, Fantasy, Cyberpunk e Lovecraft (116 file in `assets/design/lotto1/linea/`). `scripts/build-assets.mjs` le ha controllate e aggiunte a `generated/svgData.ts`, i PNG non cambiano. Tolti `LINE_ICON_PLACEHOLDERS` e `LINE_ICONS_DRAWN_IN_PIXELS`: ora ogni icona ha un file a linea, compresi scudo e pozione, e fuori da Arcade non mostra più il disegno pixel. Il `nuovo` del segnaposto diventa `aggiungi`, il nome del file, con lo stesso disegno. **Da sapere:** 10 icone non hanno ancora un file pixel (`abitudini`, `aggiungi`, `boss`, `compagno`, `completa`, `impostazioni`, `missioni`, `negozio`, `profilo`, `statistiche`), quindi in Arcade si vedono a linea, con il tratto in bozza di `shapes.ts`. **Incoerenze nei documenti:** `docs/mockup/LEGGIMI.md` e C15 danno scudo e pozione come mancanti; `docs/mockup/asset/lotto1/linea/` ha ancora i soli 160 file di prima. Verifica: `npm run check` verde (574 test) e bundle Android costruito; aspetto non provato su un telefono. |
| 2026-11-08 | T35 | ✅ corretto dopo la review | Deciso da Claudio l'08/11/2026: in Arcade un'icona pixel si mostra sempre a 24 (2×), anche quando si chiede 20 o 16, perché 12×12 a quelle misure non scala di un multiplo intero (A5: «mostrate a 24»). `iconSide` in `icons.ts` applica la regola; le icone a linea, anche in Arcade, tengono la misura chiesta. **Da sapere per le schermate:** nelle righe e nei chip di Arcade le icone pixel occupano 24 e non 20 o 16, quindi il layout va controllato in quel tema. **Non corretto:** `shape-rendering="crispEdges"`, proposto dalla review, non compare nei sorgenti di `react-native-svg`; `build-assets.mjs` cancella `assets/sprites/` prima di validare e dà errori poco chiari se manca un file, punto non bloccante. Verifica: `npm run check` verde (576 test) e bundle Android costruito; aspetto non provato su un telefono. |
