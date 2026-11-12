# GHQ Mobile – Lacune del design per le schermate

08/11/2026 · per Claudio · stato: **da approvare**

Controllo incrociato dei task T34–T87 (`sviluppo/pacchetto-claude-code/docs/backlog-schermate.md`) con `design/design-sezioni.md` v1.2, `design/temi.json` e le scelte minori di `CLAUDE.md`. Le copie in `docs/riferimenti/` del pacchetto sono identiche a quelle del progetto.

## In breve

- Il design è solido: tutte le sottosezioni citate dal backlog esistono, e quasi ogni schermata ha struttura, stati e accessibilità decisi.
- I buchi veri sono **trasversali**: `temi.json` non ha metà dei ruoli di colore che A4 richiede, le forme dei temi sono descritte a parole e non misurate, manca la soglia del «testo molto grande», il lessico non ha plurali, generi e altre lingue, e diversi asset del percorso Must non esistono. Su questi Claude Code improvviserebbe in **ogni** schermata.
- Ci sono poi 2 contraddizioni nel design (L08, L12) e alcuni riferimenti mancanti nel backlog (L22).
- **Come rispondere:** «ok a tutto», oppure «ok tranne L05, L09…» con le modifiche. Dopo il tuo ok aggiorno `design-sezioni.md` (nuova sezione A11 «Regole di dettaglio») e `temi.json` v2, e correggo i riferimenti del backlog.

Priorità: **P1** = percorso Must, tocca molte schermate · **P2** = Must, una schermata · **P3** = Should e Could.

---

## P1 – Percorso Must, trasversali

### L01 · Ruoli di colore mancanti in `temi.json` — ✅ approvata l'08/11 (temi.json v2 unica fonte, il codice si adegua)
**Task:** T27 (già fatto, in bozza), T34 e tutti i successivi.
**Cosa manca:** A4 definisce 18 ruoli, `temi.json` ne ha 9–11 per tema e con nomi diversi (Arcade `superficieRiga`, Fantasy `oro` e `navigazione`, Cyberpunk `viola`). Mancano ovunque `superficieAlta`, `suPrimario`, `pericolo`, `saltato` e `heatmap0–4`; mancano anche `fatto` (Fantasy, Cyberpunk, Lovecraft), `monete` (tutti tranne Minimal), `esperienza` e `boss` (Minimal), `info` (tutti tranne Arcade), `bordo` e `traccia` (Arcade). Le versioni «testo» corrette in A4 non sono nel file, e per Arcade `fatto` A4 dice solo «va schiarito leggermente». Il T27 ha probabilmente riempito i buchi con valori inventati, che nessuno ha approvato.
**Proposta:** `temi.json` v2 con gli stessi 18 ruoli in ogni tema, più `<ruolo>Testo` per vita, fatto, monete e pericolo. Regole:
- `superficieAlta` = superficie schiarita del 4% nei temi scuri e scurita del 3% in Fantasy e Minimal chiaro (fogli e menu).
- `suPrimario`: Arcade #1a1c2c (11,4:1), Cyberpunk #0a0a12 (16,4), Lovecraft #0c1412 (6,2), Fantasy #ffffff (9,2), Minimal chiaro #ffffff (5,2), Minimal scuro #111214 (6,1). Il bianco sul primario di Minimal scuro arriva solo a 3,1.
- `pericolo`: il colore vita dove è già rosso (Arcade testo #ffa0ac, Fantasy #a8322a, Cyberpunk #ff2a6d, Minimal #ce2c31 / #ff6369). Lovecraft ha la vita viola, quindi serve un rosso a parte: #d46a6a (4,8 sulle schede).
- `fatto`: Arcade #5ad37f (5,8; corregge #38b764 che fa 4,2), Fantasy #2f6b3a (5,6), Cyberpunk #39ff9c, Lovecraft il primario #4fa38c (5,5).
- `monete`: Arcade il primario #ffcd75, Fantasy oro grafico #b8862b e oro testo #8a6418 (4,7; #b8862b fa solo 2,9), Cyberpunk il primario #f9f002, Lovecraft #c9a85a (7,4).
- `saltato` = `testoTenue` con l'icona salta, in tutti i temi.
- `info`: Fantasy #2f5f8a, Cyberpunk il viola #b847ff, Lovecraft #7fa7c9, Minimal il primario.
- `heatmap0–4`: da `traccia` al `primario` in 4 passi uguali (mescolanza lineare), per ogni tema.
- Minimal `esperienza` = primario, Minimal `boss` = primario (anello, 5.9).

### L02 · Forme dei temi non misurate
**Task:** T34 (Card, Button, Bar, Difficulty, Chip, Sheet), T31 (indicatore della barra).
**Cosa manca:** `temi.json` dice «cornice pixel 3px a gradini», «angoli tagliati», «doppio filetto», ma non quanto è grande il taglio, quanto distano i filetti, quanto è spessa una barra, quanti segmenti ha, che raggio hanno pulsanti, chip e fogli. Le tacche della difficoltà usano icone che non esistono (occhi, blocchi, barre).
**Proposta:** un blocco `forma` completo per tema:

| | Minimal | Arcade | Fantasy | Cyberpunk | Lovecraft |
| --- | --- | --- | --- | --- | --- |
| Scheda | raggio 18, bordo 1 | raggio 0, cornice 3 a gradini | raggio 8, bordo 1 oro + filetto interno a 3 | taglio 12 in alto a sinistra e in basso a destra, filo 1 | raggio 0, due filetti da 1 a 3 di distanza |
| Pulsante, campo | raggio 14 | 0, cornice 2 | 8 | taglio 8 | 0, filetto 1 |
| Chip | pillola | 0 | 8 | taglio 6 | 0 |
| Foglio dal basso | raggio 18 in alto | cornice 3 in alto | 8 in alto | taglio 12 | doppio filetto in alto |
| Barra: spessore | 8 (sottile 4) | 12, segmenti da 8 con spazio 2 | 10 con contorno 1 | 6, 20 segmenti, alone 4 | 4 piatta |
| Tacche difficoltà | punti | quadrati pixel | spade (icona spada) | barrette | cerchi (al posto degli occhi) |

Indicatore della voce attiva nella barra: pillola 32×4 sotto l'icona (Minimal), cornice 2 (Arcade), rombo 6 (Fantasy), linea 2 con alone (Cyberpunk), punto a stella 6 (Lovecraft).

### L03 · «Testo molto grande» senza soglia — ✅ approvata l'08/11 (barra a 4 voci + [+], non 5)
**Task:** T36, T39, T43, T51, T53, T54, T55 e la barra di navigazione del T31.
**Cosa manca:** molte sezioni dicono «con testo molto grande il layout cambia», ma nessuna dice da quale dimensione. Mancano poi i casi della barra di navigazione (5 voci + [+] con etichette, in tedesco), della riga missione (nome, XP e controllo da 48 sulla stessa riga) e della scheda del boss compatta.
**Proposta:**
- Soglia unica: `fontScale ≥ 1,3` attiva tutti i layout alternativi già descritti.
- Barra di navigazione: etichette su una riga, scala ferma a 1,3, troncate con «…»; l'etichetta completa resta per il lettore di schermo.
- Riga missione: il controllo resta a destra; XP e difficoltà vanno sotto il nome; il nome può andare su 3 righe.
- Boss compatto in Oggi: lo sprite sparisce e il resto va in colonna.
- Press Start 2P: corpo arrotondato per difetto al multiplo di 2.

### L04 · Lessico incompleto — ✅ approvata l'08/11
**Task:** T28 (già fatto, in bozza) e ogni schermata con testo tematizzato.
**Cosa manca:** il lessico ha solo il singolare in italiano. Mancano plurali e generi: le intestazioni usano «Orrori», «Grandi obiettivi», e frasi come «Trasforma un obiettivo in un boss» in Fantasy diventano «in una Nemesi». Mancano le altre 4 lingue e diversi termini usati dal design: la parola della vittoria (5.5 dice «nel lessico del tema» ma non la dà), il titolo «Missioni di oggi», il titolo «Modifica missione» per tema, i titoli di Profilo e Statistiche.
**Proposta:**
- Ogni voce del lessico con `singolare`, `plurale` e `genere`, per lingua; inglese tradotto, tedesco, francese e spagnolo in bozza (scelta minore 7).
- Le etichette della barra di navigazione **non** si tematizzano (Oggi, Abitudini, Obiettivi, Statistiche, Profilo): servono a orientarsi e «Conoscenza proibita» non ci starebbe. Si tematizzano i titoli delle schermate.
- Vittoria: Arcade «YOU WIN!», Fantasy «Vittoria!», Cyberpunk «ACCESSO OTTENUTO», Lovecraft «L'Orrore è ricacciato», Minimal «Obiettivo raggiunto».
- Titolo del Profilo: «PLAYER 1», «Scheda dell'eroe», «Dossier», «Diario dell'investigatore», «Profilo». Statistiche: «HIGH SCORE» in Arcade, «Statistiche» negli altri.
- Modifica: «Modifica» + nome del tema al singolare («Modifica impresa»).

### L05 · Misure dei componenti
**Task:** T34, T36, T39, T41.
**Cosa manca:** A2 dà la griglia, ma non le misure di intestazioni, chip, controllo segmentato, avviso con Annulla, barra fissa dell'eroe, riga di priorità «più grande», anello di avanzamento.
**Proposta:**
- Intestazione grande 96, compatta 56. Chip alto 32 con area toccabile 44/48. Controllo segmentato 40.
- Avviso con Annulla: alto 48, 16 dai bordi, 8 sopra la barra di navigazione o sopra la tastiera; un avviso nuovo sostituisce il precedente, che si considera confermato.
- Barra fissa dell'eroe: alta 44, livello, barre da 4 e numeri in Didascalia.
- Riga di priorità: alta 72, nome in Titolo sezione, numero 1–3 in Numeri a sinistra.
- Anello: 40 di diametro nel controllo da 48, tratto 4 (3 in Lovecraft).
- Maniglia dei fogli 36×4, a 8 dal bordo.

### L06 · Compagni in ridisegno
**Task:** T35, T38, T39, T50, T64, e la firma delle notifiche (T80).
**Cosa manca:** il 31/10 hai deciso di sostituire i compagni (Blob, Brace, BIT-0, Glub, Goccia); la ricerca propone Gettone, Golem di muschio, Axolotl neon, Falena, Nuvola, ma i soggetti per 4 temi sono ancora aperti nel registro. Il design (6.7, 6.10, A10) e `temi.json` usano ancora i vecchi nomi e stadi.
**Proposta:** non bloccare. Claude Code sviluppa con i soggetti attuali, ma nomi, nomi degli stadi, habitat e chiavi degli sprite stanno solo in `src/content/companions.ts`, così cambiare soggetto vuol dire cambiare un file. Quando scegli i soggetti aggiorno design e `temi.json`.

### L07 · Asset del percorso Must che non esistono
**Task:** T35, T38, T39, T47, T48, T50, T51, T54.
**Cosa manca:** oltre agli sprite 32×32 e ai 3 boss per tema (già nel C15), non esistono: il logo di GHQ (1.2), gli emblemi dell'eroe (9.2), le icone delle 6 statistiche e delle 4 categorie, le icone Must tra le 29 nuove (archivio, ripristina, cerca, filtro, nota, lingua, backup, non disturbare, informazioni, accessibilità), le icone pixel di Arcade oltre alle 10 di navigazione, il boss della quest di partenza, l'habitat del compagno (6.2), l'arena del boss (5.3), il sigillo del Piano (2.3), lo zaino vuoto (7.5). Il T35 dice solo «segnaposto neutro».
**Proposta:** segnaposti espliciti, disegnati in codice con i token, senza file nuovi:
- Logo: la scritta «GHQ» nel carattere Display del tema.
- Emblema: forma SVG semplice per tema (cerchio, scudo, rettangolo con cornice a gradini, badge ad angoli tagliati, sigillo a 12 punte) con l'iniziale.
- Arcade: le icone pixel che mancano usano le icone a linea di Minimal con tratto 2 e angoli squadrati.
- Habitat e arena: fondo in `superficie` con una linea di pavimento in `bordo`; niente sfumature in Arcade.
- Boss della quest: lo sprite del boss attuale a 2×. Sigillo del Piano: l'icona completa dentro un cerchio in `primario`. Zaino vuoto: l'icona negozio.
- Icone di statistiche e categorie: la prima lettera in un cerchio, finché il C15 non le consegna.
Il Diario elenca ogni segnaposto, come già chiede il T35.

### L08 · Furto del boss: avviso o foglio? (contraddizione)
**Task:** T39 (avviso, Must), T65 (foglio, Should).
**Cosa manca:** 2.8 dice che in Oggi compare un avviso in cima con la battuta, «Nuova scadenza» e «Archivia». 5.6 dice che alla prima apertura si apre un foglio dal basso con le stesse cose. Non si capisce se compaiono tutti e due.
**Proposta:** alla prima apertura il foglio (5.6). Se l'utente lo chiude senza scegliere, resta in Oggi l'avviso di 2.8 finché non fissa una nuova scadenza o archivia. Fino al T65 c'è solo l'avviso.

### L09 · Più avvisi insieme in Oggi
**Task:** T39.
**Cosa manca:** possono capitare insieme furto del boss, scudo usato, compagno cresciuto, missione tornata dalla pausa. Il design non dice l'ordine né quanti se ne vedono.
**Proposta:** al massimo 2 avvisi visibili, poi la riga «Altri 2 avvisi» che li apre. Ordine: furto del boss, missione tornata dalla pausa, scudo usato, compagno cresciuto. La fascia «Esausto» non è un avviso: sta nella scheda dell'eroe, con colore `info` e icona vita (non `pericolo`, per non colpevolizzare).

### L10 · Ordine e stati delle missioni in Oggi
**Task:** T40, T41.
**Cosa manca:** «con orario in ordine di ora» non dice qual è l'orario di un'abitudine con più promemoria. Non è detto in che ordine stanno le fatte, cosa fa una priorità fatta, né cosa dice l'etichetta di una scaduta da più giorni.
**Proposta:**
- Orario di un'abitudine = il suo primo promemoria del giorno; di un'attività singola = l'ora della scadenza.
- «Fatte»: dalla più recente.
- Una priorità fatta resta nel suo posto del Piano in testo tenue con la spunta, e non entra in «Fatte».
- Scaduta: «Scaduta ieri», poi «Scaduta da 3 giorni».

### L11 · Forma del menu a pressione lunga
**Task:** T40, T46, T67, T48.
**Cosa manca:** il design dice «menu» ma non se è un foglio, un popover o il menu del sistema.
**Proposta:** un componente unico `ActionSheet` in `shared`: foglio dal basso con il nome della missione come titolo, righe da 52 con icona, la voce distruttiva in fondo in `pericolo`. Si aggiunge al T34.

### L12 · Vita del boss in Cyberpunk: percentuale o numero? (contraddizione)
**Task:** T42, T47, T48.
**Cosa manca:** 5.9 dice che in Cyberpunk la vita è «integrità in percentuale»; A4 e A6 dicono che ogni barra mostra sempre il numero (32/50).
**Proposta:** in Cyberpunk «62%» grande e «100/160» piccolo accanto; il lettore di schermo legge sempre i numeri.

### L13 · Decorazioni di tema: cosa entra nel Must
**Task:** T34, T39, T46, T47, T48.
**Cosa manca:** il design cita scanline, griglia di fondo, titoli sdoppiati magenta e ciano, vignettatura, nebbia che si dirada sul boss (Lovecraft), capolettera ornata, ornamento a rombo, timestamp. Nessun task dice quali fare; il T37 dice «niente asset nuovi».
**Proposta:** nel Must solo quelle che si fanno con testo e forme semplici: timestamp mono di Cyberpunk, rombo «◆» nei titoli di Fantasy, caselle tratteggiate di Lovecraft, cornici delle schede. Scanline (già facoltative), griglia, sdoppiamento, vignettatura, nebbia e capolettera vanno in un task Could nuovo, «Decorazioni di tema», tutte spente con Riduci movimento e contrasto elevato (A8).

### L14 · Momenti a schermo intero senza layout
**Task:** T37 (e poi T48, T63, T64, T70).
**Cosa manca:** solo la vittoria sul boss (5.5) ha un layout. Salita di livello, nuovo titolo, cambio di stadio del compagno e badge no.
**Proposta:** un modello unico: fondo `sfondo` al 92%, figura al centro (emblema, compagno o badge, 128), titolo in Display, sottotitolo in Corpo, numeri che contano, pulsante «Continua» in basso, tocco ovunque per saltare. La vittoria aggiunge «Vedi il trofeo».

### L15 · Statistiche: confronti e periodo Settimana
**Task:** T52, T53.
**Cosa manca:** 8.2 dà un solo esempio di confronto e non dice con cosa si confronta ogni riquadro. 8.5 dice il grafico per i periodi Mese e Anno, non per Settimana, che pure c'è nel selettore.
**Proposta:**
- Serie attuale: nessun confronto, ma «Nuovo record!» quando eguaglia il record. Record: nessun confronto. Completate questa settimana: rispetto alla settimana scorsa. 30 giorni: rispetto ai 30 precedenti, in punti percentuali. Sempre solo se positivo.
- Dettaglio, periodo Settimana: 7 caselle, una per giorno (fatta, mancata, saltata, non prevista) al posto delle colonne; per le misurabili colonne giornaliere come negli altri periodi.
- Colori dei grafici: colonne in `primario`, linea dell'obiettivo in `testoTenue` tratteggiata, assi in `bordo`.

### L16 · Obiettivi archiviati senza schermata
**Task:** T47, T48.
**Cosa manca:** 5.1 mette gli obiettivi archiviati nel menu «Altro», ma non dice come appaiono né se si possono riprendere. Nemmeno l'analisi lo dice.
**Proposta:** elenco semplice (sprite piccolo o anello, nome, «Archiviato il …», passi fatti su totali) in sola lettura. Riprendere un obiettivo archiviato è una funzione nuova: se la vuoi, va prima nell'analisi.

### L17 · Missioni senza categoria nel Must
**Task:** T36, T43, T46.
**Cosa manca:** la riga mostra «l'icona della categoria», ma il campo Categoria arriva solo nel T78 (Could): nel Must ogni missione creata dall'editor è «Senza categoria», e non c'è un'icona per questo caso. Abitudini raggruppa per categoria anche quando c'è solo «Senza categoria».
**Proposta:** icona di default «abitudini». Con un solo gruppo, Abitudini non mostra le intestazioni di categoria.

---

## P2 – Must, singole schermate

| # | Task | Cosa manca | Proposta |
| --- | --- | --- | --- |
| L18 | T38 | Il carosello (1.4) elenca Minimal per ultimo ma Minimal è preselezionato; non dice quanto è grande la scheda né come si fa l'anteprima. Le notifiche d'esempio (1.6) non hanno un aspetto. Le transizioni per tema (1.7) contro la dissolvenza del T38. | Minimal primo e già al centro. Scheda alta il 60% dello schermo, con i componenti veri (scheda dell'eroe e 2 righe) non toccabili. Notifiche d'esempio come schede generiche con icona, «GHQ», «ora» e testo, uguali sui due sistemi. Nel Must solo la dissolvenza; le transizioni per tema nel task Could delle decorazioni (L13). |
| L19 | T46 | Il menu «Altro» (⋯) contiene solo Riordina, che è Could (T77). Il tocco apre il dettaglio, che arriva dopo (T53). | ⋯ nascosto fino al T77. Fino al T53 il tocco apre l'editor in modifica. |
| L20 | T55 | «Suoni del tema» (10.4, A7) non ha un task né i suoni. Contatti (10.9) senza indirizzo; testo della Privacy non scritto. | Riga dei suoni nascosta finché i suoni non esistono (fuori dal loop). Contatti: dimmi un indirizzo email, altrimenti la riga non c'è. Privacy in bozza dalla frase di 10.9. |
| L21 | T57 | «Sceglie un backup» (10.8) non dice quanti backup si tengono. | Uno solo, sovrascritto a ogni backup: il ripristino mostra quello. |
| L22 | backlog | Riferimenti mancanti: T34 non cita A3 e A4; T39 e T40 non citano 2.9 (Oggi per tema: HUD Arcade, medaglione Fantasy…); T48 non cita 5.9; T52 non cita 8.10; T68 non cita 8.3 e 8.6. Senza, il loop salta le varianti di tema. | Aggiungo i riferimenti al backlog. |
| L23 | T39 | Colori di barra di stato e barra di sistema di Android per tema non definiti. | **Approvata da Claudio il 12/11** (design A11.3, scelta minore 24, task T38b): icone chiare sui temi scuri, scure su Fantasy e Minimal chiaro; fondo = `sfondo`. |
| L24 | T40, T44 | Errori generici (un'azione rifiutata o un salvataggio fallito) senza aspetto; definiti solo quelli del backup. | Azione rifiutata: avviso in basso come L05, senza Annulla, colore `info`, con il motivo. Errore imprevisto: «Qualcosa è andato storto, riprova» e una riga nel log. |
| L25 | T48 | La nebbia di Lovecraft (5.9) cambia lo sprite a ogni passo: serve un effetto o più immagini. | Nel Must lo sprite si vede tutto; la nebbia nel task Could delle decorazioni. |
| L26 | design | In 12.1 un paragrafo («Il tocco apre l'app…») è scritto come titolo `###`. | Correggo il refuso. |

---

## P3 – Should e Could

| # | Task | Cosa manca | Proposta |
| --- | --- | --- | --- |
| L27 | T59, T77 | Colori delle azioni con scorrimento (Salta, Pausa, Archivia, Modifica). | Salta e Pausa in `info`, Archivia in `testoTenue`, Modifica in `primario`; testo in `suPrimario`. |
| L28 | T70 | 9.6 mostra «12 di 38» ma il T70 chiede almeno 20 badge; le forme dei badge per tema (9.6) non esistono come asset. | Numero dei badge = quello del file dei contenuti; forme disegnate in codice come gli emblemi (L07). |
| L29 | T79, T87 | Icone play e pausa per il timer non ci sono tra le 29 icone. | Aggiungerle al C15; intanto triangolo e due barre in SVG. |
| L30 | T81 | Il titolo del riepilogo settimanale c'è solo per Fantasy. | Arcade «WEEKLY SCORE», Cyberpunk «Report settimanale», Lovecraft «Cronaca della settimana», Minimal «La tua settimana». |
| L31 | T82 | Scala blu–arancio per daltonici senza valori (il T82 lo sa già). | La preparo con `temi.json` v2: 5 livelli dal blu all’arancio, da verificare con un simulatore di deuteranopia e protanopia prima di approvarli. |
| L32 | T83, T86 | Corona della Main Quest, regali (biscotto, caramella, palla) e posa di esultanza non esistono. | Restano nel C15; il T86 è già bloccato sui prezzi. |
| L33 | T71 | Scheda dell'eroe in Essenziale «una riga» (2.10) senza misure. | Riga alta 52: nome, serie con icona, «Livello 4» in Didascalia. |

---

## Cosa non serve formalizzare

- Le schermate non hanno bisogno di mockup: struttura, stati, accessibilità ed Essenziale sono già decisi per tutte e 12 le sezioni.
- I contenuti testuali (saluti, frasi del compagno, battute, titoli) restano in bozza con la scelta minore 7 e la revisione C14.
- I task già bloccati su regole di gioco (T49, T68, T70, T86 per il C13) non dipendono dal design.

## Dopo il tuo ok

1. Aggiungo ad `design-sezioni.md` la sezione **A11 «Regole di dettaglio»** con L02, L03, L05, L09–L17 e L23–L24, e correggo 2.8, 5.6, 5.9 e 12.1.
2. Scrivo `temi.json` v2 (L01, L04, L31) e controllo di nuovo tutti i contrasti.
3. Aggiorno il backlog (L19, L22, il componente `ActionSheet` nel T34, il task Could «Decorazioni di tema») e il registro delle decisioni.
4. Ti ricordo di ricopiare i file in `docs/riferimenti/` del repository prima di avviare il loop, e aggiorno Drive.
