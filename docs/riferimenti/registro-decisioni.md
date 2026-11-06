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

## In attesa di decisione

- Come evolve la faccina di Arcade: per risoluzione (consigliata), per power-up o per corpo.
- Soggetti dei compagni per Fantasy, Cyberpunk, Lovecraft e Minimal (proposte in design/compagni/ricerca-candidati-compagni.md).
- Valori di badge, regali e prezzi delle ricompense personali.
- Proposte ancora aperte nella proposta XP e monete (limite ai cambi di difficoltà, XP dimezzati dopo 10 missioni facili, penalità per ritardi e completamenti a posteriori).
- Se e dove mostrare le missioni eliminate.
