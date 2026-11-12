# GHQ – Registro delle decisioni

Una riga per ogni scelta presa, con la data e il motivo. Le scelte più recenti vanno in fondo a ogni area. Ricostruito il 06/11/2026 dalle discussioni del progetto; dove una decisione ne sostituisce un'altra, la vecchia resta barrata.

Decide sempre Claudio; «Claude» indica le scelte minori prese in autonomia e motivate nel documento indicato.

## Progetto e organizzazione

| Data | Decisione | Motivo | Dove |
| --- | --- | --- | --- |
| 15/10 | Nome Good Habits Quest Mobile, abbreviato GHQ Mobile | Distinguerlo da Task Quest e dalla web app | proposta XP e monete |
| 15/10 | Niente multiplayer, niente AI, niente annunci | Concept personale, offline, senza distrazioni | Analisi funzionale, Scopo e vincoli |
| 15/10 | Ogni aspetto va rivisto da Claudio prima di essere deciso | Controllo punto per punto delle scelte | Thread Analisi funzionale |
| 16/10 | Riferimento su Drive nella cartella nuova (account c.defrancesco.dev), non più quella vecchia | Cambio di account Google | Istruzioni di progetto |
| 30/10 | Usare superpowers soprattutto in fase di codice; niente agenti in parallelo di default | Consumo di token | Thread Modello dati |
| 06/11 | Cartella di progetto come fonte di verità, Drive come copia sempre aggiornata | I thread leggono e scrivono la cartella direttamente; Drive è più comodo da consultare | [00-indice.md](00-indice.md) |
| 06/11 | (Claude) Backlog di 33 task preliminari da eseguire in loop con Claude Code, un task per giro; fuori dal loop i passi che richiedono Claudio | Richiesta di Claudio | [sviluppo/README.md](sviluppo/README.md) |
| 12/11 | Analisi dei concorrenti estesa a Habitica e Finch, con tabella di posizionamento di GHQ; la proposta di priorità del 15/10 resta solo come storico, fa fede il MoSCoW | Le 6 app già analizzate non avevano valutazioni; la proposta e alcuni spunti erano in contrasto con le decisioni del 16/10 | [analisi/analisi-funzionalita-habitica-finch.md](analisi/analisi-funzionalita-habitica-finch.md) |

## Funzionalità e regole di gioco

| Data | Decisione | Motivo | Dove |
| --- | --- | --- | --- |
| 16/10 | Mappa a 12 sezioni con l'ordine delle sottosezioni scelto da Claudio | Approvazione della bozza | Analisi funzionale, Mappa |
| 16/10 | Priorità con MoSCoW invece di MVP/F2/F3 | Priorità per singolo elemento | Analisi funzionale, Priorità MoSCoW |
| 16/10 | Nessun account, dati sul telefono; quest di partenza in 3 passi; compagno che parte come uovo | Partenza immediata e tutorial giocato | Analisi, sez. 1 |
| 16/10 | «Salta oggi» fino a 3 volte a settimana per missione | Richiesta di Claudio (la bozza diceva 2) | Analisi, sez. 2 |
| 16/10 | Bonus «giornata completa» (non bonus di serie da 2 giorni) | Claudio ha confermato la proposta iniziale | Analisi, sez. 2 |
| 16/10 | Annullare un completamento fino al cambio di giornata | Correggere i tocchi sbagliati | Analisi, sez. 2 |
| 16/10 | Missioni perse: al massimo 10 punti vita al giorno, in proporzione agli XP mancati; dopo un giorno «esausto» la vita torna al 25% | Penalità che non scoraggiano | Analisi, Regole di gioco |
| 16/10 | Pozione a +10 vita (non 20) | Bilanciamento | proposta XP e monete |
| 16/10 | ~~Il boss a scadenza fugge e si cura~~ → il boss non «fugge»: sbeffeggia e ruba il 10% delle monete, massimo 500, senza curarsi | Scelta di tono e bilanciamento | proposta XP e monete |
| 16/10 | Badge sbloccati danno monete bonus (valore da definire) | Ricompensa per i traguardi | proposta XP e monete |
| 16/10 | Regali per il compagno al posto dei cosmetici (Could); comprare altri compagni è Won't | Monete spese sul compagno | Analisi, sez. 7 |
| 16/10 | Ricompense personali Could, con prezzo automatico per entità (piccola, media, grande, epica) | Prezzi coerenti | proposta XP e monete |
| 16/10 | Cambio di giornata alle 6:00, modificabile | Chi va a dormire tardi | proposta XP e monete |
| 16/10 | ~~Classi semplici~~ eliminate, sostituite da 6 statistiche dell'eroe (Forza, Costituzione, Intelligenza, Saggezza, Carisma, Disciplina), senza bonus su XP | Progressione senza vantaggi di gioco | Statistiche dell'eroe |
| 16/10 | Prestigio Won't | Fuori ambito | Analisi, Priorità MoSCoW |
| 16/10 | Solo backup nel cloud personale, sincronizzazione tra telefoni Won't | Niente server né account | Analisi, Decisioni sulle domande aperte |
| 16/10 | App gratuita e completa; in futuro al massimo un acquisto unico per temi o regali | Mai annunci né XP in vendita | Analisi, Decisioni sulle domande aperte |
| 16/10 | Serie: basta una missione completata al giorno | Serie facile da mantenere | Analisi, Decisioni sulle domande aperte |
| 16/10 | Tutti e 6 i temi al lancio (Must) | Il tema è parte del concept | Analisi, Decisioni sulle domande aperte |
| 16/10 | Penalità di vita attive di default in modalità Completo; chi non le vuole usa Essenziale | Scelta lasciata all'utente | Analisi, Decisioni sulle domande aperte |
| 30/10 | Attività singole completate visibili per 7 giorni, poi in archivio da sole | Regola mancante nell'analisi | Analisi, sez. 3 |
| 30/10 | Sprite personalizzati per il ritratto dell'eroe come idea futura | Richiesta di Claudio | Analisi, idee non prioritizzate |
| 30/10 | Nessuna integrazione con i calendari (RRULE tolto) | Non c'era un requisito | Thread Modello dati |
| 06/11 | Eliminare una missione è una cancellazione logica (US-ABI-03 corretta) | Allineamento al modello dati | Analisi, sez. 3 |
| 06/11 | Scudo della serie: si consuma solo in un giorno con zero completamenti e salva tutte le serie | Sbloccare la chiusura dei giorni (T14) | [regole-per-sbloccare-t14.md](sviluppo/regole-per-sbloccare-t14.md) |
| 06/11 | «N volte a settimana»: nessuna penalità nei giorni intermedi, valutazione a fine settimana; la serie conta le settimane riuscite | Come sopra | idem |
| 06/11 | Attività singole scadute: tolgono vita una volta sola, il giorno della scadenza | Come sopra | idem |
| 06/11 | Giorno senza missioni previste: vale come giorno di riposo | Come sopra | idem |
| 06/11 | Quest di partenza: XP fino al livello 2 e 50 monete | Il «primo livello» non era raggiungibile con la formula dei boss | idem |
| 06/11 | Umore del compagno: felice se oggi c'è almeno un completamento, altrimenti soglie sui 3 giorni | Allineare regole, US-COMP e design 6.3 | idem |
| 06/11 | Vita del boss: passi × 20, la difficoltà cambia solo la ricompensa | Refuso nella sezione 5 dell'analisi, corretto | Analisi, sez. 5 |
| 06/11 | «N volte a settimana»: si valuta sempre a fine settimana, anche se l'ultimo giorno è di riposo | Altrimenti chi riposa la domenica non viene mai valutato | [scelte-aperte-dopo-t33.md](sviluppo/scelte-aperte-dopo-t33.md) |
| 06/11 | «N volte a settimana» creata a metà settimana: la prima settimana non toglie vita; se arriva a N la serie cresce, altrimenti non si spezza | Le penalità non devono scoraggiare | idem |
| 06/11 | Ogni «Salta oggi» riduce di 1 il numero richiesto nella settimana di una «N volte a settimana» | Il salto deve servire anche su queste missioni | idem |
| 06/11 | Annullamento rifiutato se le monete da restituire sono già state spese | Evita il trucco completo-compro-annullo | idem |
| 06/11 | Il boss ruba dal giorno dopo la scadenza, una volta per scadenza | Confermata la scelta del loop | idem |
| 06/11 | La pozione non si può usare a vita piena | Evita di sprecare 50 monete | idem |
| 06/11 | Impostazioni: lingua del dispositivo se tra le 5 (altrimenti inglese), tema Minimal automatico, riepilogo serale acceso alle 21:00, settimana da lunedì | Confermate con una correzione alla lingua | idem |
| 12/11 | Pausa generale per vacanza o malattia: congela vita, umore e notifiche; scadenze dei boss spostate in avanti. ~~Congela le serie~~: le serie seguono le regole normali e gli scudi non si consumano; inizio oggi o futuro, scelto con un calendario (Claudio, 12/11) | Spunto da Habitica e Finch: chi si ferma rischia di abbandonare | Analisi funzionale, sez. 10 e Regole di gioco |
| 12/11 | Uno scudo della serie a ogni boss sconfitto (100 monete se se ne hanno già 2) | Lo scudo si guadagna anche giocando, come in Finch | Analisi funzionale, sez. 5; xp-e-monete |
| 12/11 | Il compagno racconta la giornata: riepilogo serale e fumetto del mattino in Oggi | Fidelizzazione, spunto da Finch | Analisi funzionale, sez. 6 e 11 |
| 12/11 | Ricompense personali da Could a Should | Le monete devono avere valore fuori dall'app | Analisi funzionale, sez. 7; xp-e-monete |

## Stack tecnologico (tutte del 30/10)

| Decisione | Motivo | Dove |
| --- | --- | --- |
| ~~Flutter (proposta del 16/10)~~ → React Native con Expo, in TypeScript | Il progetto serve anche per trovare lavoro: più annunci per React e React Native in Italia e in Ticino | Stack (definitivo), punto 1 |
| Expo Router, regole di gioco in TypeScript puro, Zustand | Meno codice; Claudio conosce già Zustand | punto 2 |
| SQLite con expo-sqlite e Drizzle | Semplice da mantenere, compatibile con altri sistemi, scalabile (criterio generale) | punto 3 |
| Backup con react-native-cloud-storage (iCloud e Google Drive) | Una sola API, nessun server | punto 4 |
| expo-notifications, da provare subito con un prototipo | Libreria ufficiale; il caso iPhone va verificato | punto 5 |
| expo-widgets per widget e Live Activity; smartwatch nativo | Resta in TypeScript | punto 6 |
| Due librerie per la salute dietro un'interfaccia comune | Ognuna è la più completa per il suo sistema | punto 7 |
| Temi con il Context di React, animazioni con Reanimated, sprite PNG già ingranditi (niente Skia) | Leggero e facile da mantenere | punto 8 |
| i18next con il contesto per il lessico dei temi | Standard diffuso | punto 9 |
| EAS Build, Jest, React Native Testing Library, Maestro, GitHub Actions | Claudio ha solo Windows e Linux: niente Mac necessario | punto 10 |

## Modello dati (tutte del 30/10)

| Decisione | Motivo | Dove |
| --- | --- | --- |
| Tabelle di stato più registro degli eventi in sola aggiunta, nella stessa transazione | Letture veloci, storico completo, base per una futura sincronizzazione | Modello dati, scelta 1 |
| Identificativi UUID v7 in testo | Nessun doppione tra dispositivi o con un futuro server | scelta 2 |
| Frequenza in un campo JSON tipizzato con Zod | Copre le 6 frequenze senza migrazioni | scelta 3 |
| Eliminazione logica con `deleted_at`; dove mostrare le eliminate è da decidere | I progressi non si perdono | scelta 4 |
| (Claude) Date come `AAAA-MM-GG`, istanti in ms UTC più fuso; contenuti fissi nel codice; impostazioni chiave-valore | Motivate nel documento | scelte 5–7 |
| 06/11: `tz_offset` in minuti a est di UTC (anche nel registro); `paused_until` è il primo giorno di nuovo attivo; `week_start` intero 1–7 (1 = lunedì); nuovo evento `hero.created` | Confermate le scelte del loop | [scelte-aperte-dopo-t33.md](sviluppo/scelte-aperte-dopo-t33.md) |

## Design

| Data | Decisione | Motivo | Dove |
| --- | --- | --- | --- |
| 15/10 | 6 temi (Arcade, Fantasy, Cyberpunk, Lovecraft, Minimal chiaro e scuro), Minimal di default, ognuno con il suo lessico | Richiesta di Claudio | design/README.md |
| 16/10 | La prima proposta di schermate è superata: si riparte con un documento di design sezione per sezione | Claudio la riteneva obsoleta | Design delle sezioni |
| 30/10 | Area toccabile 44 su iOS e 48 su Android | Misure native delle piattaforme | Design, basi comuni |
| 30/10 | Basi comuni e tutte le 12 sezioni approvate con le raccomandazioni ★ | Revisione sezione per sezione | Design delle sezioni v1.2 |
| 30/10 | Compagno: umori felice, normale, triste; quando riceve un regalo esulta sempre, con effetto diverso per tema; 9 pose per tema | Richiesta di Claudio | Design, sez. 6 |
| 30/10 | Lovecraft: la Saggezza diventa «Lucidità», la vita «Vitalità» | Evitare il doppione «Sanità mentale» | Design, sez. 9; temi.json |
| 30/10 | Eroe rappresentato da un emblema del tema con l'iniziale | Niente scelta di aspetto o genere | Design, sez. 9 |
| 30/10 | Notifiche: solo l'icona dell'app; complimento serale se tutto è fatto | Modifiche di Claudio alla sez. 11 | Design, sez. 11 |
| 30/10 | Widget piccolo con il compagno nel suo umore e il numero delle notifiche; al tocco apre «Notifiche recenti» | Modifica di Claudio alla sez. 12 | Design, sez. 12 |
| 30/10 | Missioni collegate alla salute si completano con una notifica «Obiettivo raggiunto» | Rendere evidente il progresso | Design, sez. 12 |
| 30/10 | Il numero delle notifiche compare anche sull'icona dell'app | Coerenza con il widget | Design, sez. 11.7 |
| 31/10 | Ridisegno solo dei compagni, con un soggetto diverso per ogni tema | I soggetti attuali non convincono | Thread Ridisegnare gli sprite |
| 31/10 | Arcade: una faccina pixel disegnata da noi (non emoji di sistema) | Umore leggibilissimo a 48 px | Thread Ridisegnare gli sprite |
| 08/11 | Ruoli di colore completi per i 6 temi (`colori-v2.json`, poi `temi.json` v2 come unica fonte; il codice si adegua) | Lacuna L01: metà dei ruoli di A4 mancava | design/lacune-design-schermate.md, design/claude-design/ |
| 08/11 | Asset, mockup e animazioni prodotti con Claude Design in 9 lotti | Ciò che non si definisce a parole | design/design-da-disegnare.md, design/claude-design/ |
| 08/11 | Compagni: Golem di muschio (Fantasy), Axolotl neon (Cyberpunk), Falena dai mille occhi (Lovecraft), Nuvola (Minimal) | Lotto 0: sagome più leggibili a 48 px | design/consegne/0/ |
| 08/11 | Faccina Arcade: evolve per risoluzione (8×8 → 16×16 → 32×32 in un riquadro da 64) | Lotto 0: la più semplice, resta una faccina | design/consegne/0/ |
| 08/11 | Lovecraft: tacche della difficoltà a cerchi e stellina come indicatore della barra, come nel brief | Design allineato agli altri temi | design/consegne/1/ |
| 08/11 | Colori: colori-v2 per l'interfaccia, palette sprite (18 colori per tema, allineata a colori-v2 dove coincide) per la pixel art | colori-v2 non ha le sfumature e i colori che servono ai disegni | design/consegne/0/palette-sprite.json |
| 08/11 | 10 icone in più (lotto 1-bis): indietro, avanti, chiudi, lucchetto, avviso, esausto, riposo, notifiche bloccate, quantità, sole | Usate dalle schermate ma assenti dal lotto 1 | design/consegne/1/ |
| 08/11 | Misure e forme dei componenti nei 6 temi, con 7 correzioni (ruolo «Etichetta barra», `fatto` di Minimal chiaro #2b9a66, numero di priorità in Numeri, anello quadrato in Arcade, stati premuto/spento senza colori nuovi, intestazione grande in Titolo schermata, neon Cyberpunk solo su voce attiva e fogli) | Lotto 2; sostituiscono L02 e L05 | design/consegne/2/misure.md |
| 08/11 | Boss: approvati i 16 nomi; tutti ridisegnati a figura intera nello stile dei difficili v2 (Disco volante, Drago rosso, Mech ICE, L'Antico) | Claudio: i primi difficili «sono brutti», i nuovi «molto belli» | design/consegne/3/ |
| 08/11 | Nomi dei compagni: Pixel (Arcade), Rocky (Fantasy), Glitchy (Cyberpunk), Lumin (Lovecraft), Cloudy (Minimal); l'utente può rinominarli | Scelti da Claudio | design/temi.json |
| 08/11 | Nomi propri dei boss: Arcade Dring, Gloop, Rocket, Zorg; Fantasy Snooze, Spore, Grunk, Ignis; Cyberpunk Bugsy, Cubit, Blaze, Titan; Lovecraft Shade, Peeper, Jelly, Krakko (quest, facile, medio, difficile). La descrizione resta dopo il nome | Scelti da Claudio, stesso stile dei compagni | design/consegne/3/esito.md |
| 08/11 | Logo: si usa il segnaposto (spilla con la spunta) del lotto 4; il definitivo si disegna più avanti | Claudio | design/consegne/4/ |
| 08/11 | Lotto 4 approvato. Habitat: vasca illuminata dal basso a Cyberpunk (Glitchy), scrittoio con lampada a olio a Lovecraft (Lumin); stadi Uovo, Cucciolo, Adulto in tutti i temi | Compagni nuovi; Claudio: «sì ai cambi» | design/design-sezioni.md 6.10, design/consegne/4/ |
| 08/11 | Barra di navigazione a 4 voci con il [+] al centro: Oggi, Abitudini, [+], Obiettivi, Profilo. Statistiche si apre da Profilo e dalla scheda dell'eroe | Con 6 posti il [+] stava al 42% della larghezza (Claudio) | design/design-sezioni.md A6, design/consegne/5/ |
| 12/11 | ~~(Claude, da approvare) Design delle 4 funzioni Should del 12/11: pausa generale da oggi con fascia e «Riprendi» in Oggi e riga in Giornata; scudo alla vittoria mostrato nella schermata, non dato dalla quest di partenza; racconto del compagno con 8 situazioni del mattino e 3 serali, testi uguali per ogni umore; ricompense dopo gli Aiuti, massimo 20~~ Superata dalla riga «Design delle 4 funzioni approvato con modifiche» | Portare in design e backlog le funzioni decise il 12/11 | design/aggiunte-12-11.md, design-sezioni 2.8, 5.5, 6.14, 7.6, 10.5 |
| 12/11 | (Claude) Backlog: task T88–T92 in fase 6; ricompense personali tolte dal T86 | Sono Should; il T86 resta solo regali (Could) | sviluppo/aggiunta-backlog-12-11.md |
| 12/11 | Design delle 4 funzioni approvato con modifiche: pausa con calendario inizio e fine e serie non protette; scudo anche dalla quest di partenza; varianti per umore nelle frasi del mattino (3.300 frasi) e 3 situazioni in più; ricompense dopo gli Aiuti, senza limite (lista caricata a pezzi), solo prezzo; prezzi 100, 250, 600, 1.500 | Scelte una per una da Claudio | design/aggiunte-12-11.md |
| 12/11 | Pausa generale: ogni giorno di pausa riduce di 1 le missioni «N volte a settimana» (minimo 0); se N arriva a 0 la serie della missione quella settimana non cresce e non si interrompe; un completamento in pausa rende felice il compagno, i giorni vuoti in pausa non abbassano l'umore. Con le correzioni del controllo di Claude Code (scelta minore 23) | Incoerenze trovate da Claude Code nel repo | CLAUDE.md scelte 12, 22, 23; backlog T88–T92 |

## In attesa di decisione

- Valori di badge e regali. Prezzi delle ricompense personali approvati il 12/11.
- Proposte ancora aperte nella proposta XP e monete (limite ai cambi di difficoltà, XP dimezzati dopo 10 missioni facili, penalità per ritardi e completamenti a posteriori).
- Se e dove mostrare le missioni eliminate.

- 08/11: lotto 5, B2 approvata; B3a–B10 consegnate in consegne/5 (frame/ e tavole/), in attesa di feedback.
- 08/11: lotto 6 avviato; gruppo D01–D06 consegnato in consegne/6.
- 08/11: lotto 6 completo (D01–D43) consegnato in consegne/6, in attesa di feedback di Claudio.
- 08/11: lotto 7 (storyboard 5 temi) consegnato in consegne/7; canvas con lotti 5–7 pubblicato.
- 08/11: lotto 8 (piedistallo, badge, regali, corona, 2 sprite intermedi per tema) consegnato in consegne/8; intermedi sono bozze per resampling.
- 08/11: Claudio: sprite intermedi (lotto 8) restano placeholder per ora, come il logo; da rifinire in seguito.
- 08/11: pacchetto mockup per Claude Code in sviluppo/mockup-per-claude-code/ (+zip); il thread «Secondo backlog: schermate» riallinea backlog-schermate.md ai frame. Da copiare nel repo in docs/riferimenti/mockup/.
- 08/11: Claudio approva L03 (soglia testo grande fontScale ≥ 1,3; barra a 4 voci + [+]) e L04 (lessico con singolare/plurale/genere, etichette barra non tematizzate). Percorso mockup nel repo: docs/mockup/.
- 08/11: aggiunta A11 (L03 e L04) a design-sezioni.md e design/lessico-v2.json (it definitivo, en proposto, de/fr/es da fare in T28).
