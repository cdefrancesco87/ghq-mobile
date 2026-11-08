# Elenco delle schermate da disegnare

Tre gruppi. **B** = aspetto per tema (6 temi ciascuna). **D** = flussi e stati, solo in **Minimal chiaro** (la struttura è uguale negli altri temi). Colonna «Sez.» = punti di `design-sezioni.md` da seguire. M = Must, S = Should, C = Could.

## B · Schermate per tema (lotto 5, dopo il foglio dei componenti del lotto 2)

| Cod. | Schermata | Cosa deve far vedere | Sez. | Pr. |
| --- | --- | --- | --- | --- |
| B2 | Oggi | Intestazione, scheda dell'eroe nella veste del tema, Piano con 2 priorità, boss compatto, 4 missioni (una misurabile, una fatta) | 2.1–2.5, 2.9 | M |
| B3a | Obiettivi | 2 boss attivi, 1 posto libero, anteprima trofei | 5.1, 5.9 | M |
| B3b | Scheda del boss | Arena, barra con vita protetta a righe, passi, missioni collegate | 5.3, 5.9 | M |
| B4 | Abitudini | Categorie nella veste del tema, filtri, righe con serie e % | 3.1, 3.2, 3.9 | M |
| B5 | Editor (mezza altezza) | Foglio nella veste del tema, titolo e pulsante nel lessico | 4.2, 4.13 | M |
| B6 | Negozio | Saldo, benvenuto, griglia pozione e scudo | 7.2, 7.3, 7.8 | M |
| B7 | Profilo | Emblema, scheda del personaggio 2×3, collegamenti | 9.1–9.4, 9.8 | M |
| B8 | Compagno | Habitat, compagno a 6×, nome, stadio, crescita, umore | 6.2, 6.3, 6.10 | M |
| B9 | Statistiche | Riepilogo 2×2, heatmap, andamento missioni | 8.1–8.4, 8.10 | M/S |
| B10 | Widget piccolo e medio | Le 5 vesti, più la versione monocroma iPhone | 12.1–12.4 | S |

## D · Flussi e stati in Minimal chiaro (lotto 6)

| Cod. | Schermata o stato | User story | Sez. | Pr. |
| --- | --- | --- | --- | --- |
| D01 | Primo avvio · Lingua | US-ONB-01 | 1.1, 1.2 | M |
| D02 | Primo avvio · Nome dell'eroe con tastiera, Continua spento | US-ONB-00 | 1.3 | M |
| D03 | Primo avvio · Tema (carosello, chip Automatico/Chiaro/Scuro) | US-ONB-02 | 1.4 | M |
| D04 | Primo avvio · Prime missioni (3 di 5 selezionati, messaggio «Massimo 5») | US-ONB-03 | 1.5 | M |
| D05 | Primo avvio · Notifiche (due notifiche d'esempio) | US-ONB-05 | 1.6 | M |
| D06 | Oggi · primo giorno: quest di partenza e fumetto del compagno | US-ONB-04 | 1.7, 1.8 | M/S |
| D07 | Oggi · giornata tipo (stessa di B2) scorsa fino a «Fatte (2)», con barra fissa dell'eroe | US-OGGI-01 | 2.2, 2.5 | M |
| D08 | Oggi · subito dopo un completamento: «+25 XP», danno «−5» sul boss, avviso «Fatto · Annulla» | US-OGGI-03, 04, 05 | 2.6 | M |
| D09 | Oggi · stati particolari: eroe esausto, avviso scudo, furto del boss, missione scaduta, «Altri 2 avvisi» | US-BOSS-03 | 2.8, L08–L10 | M |
| D10 | Oggi · giornata completa; giorno di riposo; nessuna missione | – | 2.7, 2.8 | M/S |
| D11 | Menu a pressione lunga e foglio «Salta oggi» con i motivi | US-OGGI-06 | 2.5, L11 | M/S |
| D12 | Foglio «Scegli una priorità» e messaggio «Hai già 3 priorità» | US-OGGI-02 | 2.3 | M |
| D13 | Editor · mezza altezza con tastiera, anteprima ricompense, statistica mancante | US-EDT-01, 02, 06 | 4.1–4.4, 4.10 | M |
| D14 | Editor · tutta altezza con Altre opzioni; fogli Frequenza (giorni della settimana) e Promemoria (permesso negato) | US-EDT-04 | 4.5, 4.6, 4.8 | M |
| D15 | Editor · Obiettivo misurabile (quantità) e Boss collegato | US-EDT-03, 05 | 4.7, 4.9 | M/S |
| D16 | Editor · modifica con Archivia ed Elimina; dialogo «Scartare le modifiche?» | – | 4.12 | M |
| D17 | Libreria dei modelli | US-ONB-03 | 4.11 | S |
| D18 | Abitudini · elenco completo con gruppo «In pausa»; ricerca senza risultati con «Crea “…”» | US-ABI-01 | 3.1–3.3 | M/S |
| D19 | Abitudini · foglio «Fino a quando?», filtro Archiviate con Ripristina, dialogo Elimina con «Archivia invece» | US-ABI-02, 03 | 3.6, 3.7 | M/S |
| D20 | Abitudini · stato vuoto e filtro vuoto | – | 3.8 | M |
| D21 | Obiettivi · creazione del boss (passi 5 di 20, difficoltà con sprite, barra «Vita 160 · Ricompensa…») | US-BOSS-01 | 5.2 | M |
| D22 | Obiettivi · 3 boss attivi con «Massimo 3 boss»; obiettivi archiviati | – | 5.1, L16 | M |
| D23 | Vittoria sul boss (schermo intero) | US-BOSS-02 | 5.5 | M |
| D24 | Foglio della scadenza mancata | US-BOSS-03 | 5.6 | S |
| D25 | Sala dei trofei, piena e vuota | US-BOSS-04 | 5.7 | S |
| D26 | Compagno · uovo; cucciolo triste con la spiegazione dell'umore; fumetto; nome in modifica | US-COMP-01, 02, 03 | 6.2–6.7 | M/S |
| D27 | Negozio · foglio «Compra per 50» con «Usa subito»; monete insufficienti; scudo al massimo | US-NEG-01, 02 | 7.3, 7.4 | M |
| D28 | Inventario · pozione con Usa (e spento a vita piena), scudo, inventario vuoto | US-NEG-02 | 7.5 | M |
| D29 | Statistiche · primi giorni (stati vuoti) | US-STAT-01 | 8.9 | M |
| D30 | Statistiche · foglio del giorno della heatmap con «+ Completamento dimenticato» | US-STAT-03 | 8.3, 8.6 | S |
| D31 | Dettaglio della missione misurabile (periodi Settimana e Mese) | US-STAT-02 | 8.5, L15 | M |
| D32 | Registro con filtri a chip e voci raggruppate per giorno | US-STAT-03 | 8.6 | S |
| D33 | Profilo · foglio di dettaglio di una statistica; nome in modifica | US-PROF-03, 04, 05 | 9.2, 9.5 | M |
| D34 | Badge · griglia e dettaglio | US-PROF-02 | 9.6 | S |
| D35 | Momenti a schermo intero: salita di livello con «Nuovo titolo», badge sbloccato, compagno cresciuto | US-PROF-01 | A7, L14 | M/S |
| D36 | Impostazioni · pagina a gruppi con ricerca; pagina Non disturbare; riga «Notifiche bloccate dal telefono» | US-IMP-01 | 10.1–10.6 | M |
| D37 | Impostazioni · foglio di cambio a Essenziale; Oggi in modalità Essenziale | US-IMP-02 | 10.4, 2.10 | S |
| D38 | Backup e ripristino, con errore e Riprova | US-IMP-03 | 10.8 | M |
| D39 | Elimina tutti i dati: primo foglio e seconda conferma con ELIMINA | US-IMP-05 | 10.8 | M |
| D40 | Notifiche sulla schermata di blocco: promemoria con Completa e Posticipa, conferma «Fatto!», raggruppata, riepilogo serale | US-NOT-01, 02, 03 | 11.2–11.5 | M/S |
| D41 | Foglio «Notifiche recenti» | – | 11.7, 12.1 | S |
| D42 | Testo al 200%: Oggi, riga missione, barra di navigazione, editor | – | A3, L03 | M |
| D43 | Oggi su tablet (sopra 840 di larghezza, due colonne) | – | A2 | C |

In tutto: **9 schermate per tema** (54 frame più i widget) e **43 schermate in Minimal**.
