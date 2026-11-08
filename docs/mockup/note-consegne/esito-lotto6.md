# Esito lotto 6 · Flussi e stati in Minimal chiaro

Frame in `frame/` (es. `D09.png`, 390×844; D43 è 900×640), una tavola per gruppo in `tavole/lotto6-d1…d6.png`. Sorgenti: `sorgenti/scr_d1…d6.py`, `dc.py`, `build6.py`. Dove il documento non decide ho scelto la soluzione più semplice con i componenti del lotto 2 e l'ho segnalata qui sotto.

## Elenco dei frame
| Frame | Schermata | Nota / scelta mia |
| --- | --- | --- |
| D01 | Lingua | lingua del telefono preselezionata (Italiano); logo segnaposto. |
| D02 | Nome dell'eroe |  |
| D03 | Tema | il carosello mostra schede-anteprima semplificate; le anteprime vere di Oggi per tema sono nel lotto 5. Frasi dei toni da definire. |
| D04 | Prime missioni | messaggio «Massimo 5» mostrato come riquadro; comparirebbe al sesto tocco (stato D04 con 5 selezionate: stessa schermata). |
| D05 | Notifiche | i due messaggi d'esempio sono inventati; «Non ora» ha un'area di 44 sotto il pulsante. |
| D06 | Oggi · primo giorno | suggerimento unico del compagno vicino alla prima missione; il primo passo parte già spuntato. Il compagno qui è l'uovo, il fumetto è del testo del sistema. |
| D07 | Oggi · barra fissa | la scheda dell'eroe si riduce alla barra fissa con livello, vita ed esperienza; sotto, le ultime missioni da fare e il gruppo «Fatte (2)» con l'ora. |
| D08 | Oggi · dopo un completamento | la spunta è appena fatta: «+25 XP» e monete volano verso la scheda, sul boss compare «−5», in basso «Fatto» con Annulla per 5 secondi. |
| D09 | Oggi · stati particolari | stati mostrati insieme per confronto: furto del boss con due scelte, avviso scudo chiudibile, «Altri 2 avvisi» (con più di 2 avvisi se ne vedono 2), eroe esausto, missione scaduta in colore pericolo. In uso non compaiono tutti insieme. |
| D10A | Giornata completa | giornata completa: la scheda celebrativa prende il posto del contatore e resta fino al cambio di giornata. |
| D10B | Giorno di riposo | giorno di riposo: nessuna missione prevista, la serie non si interrompe. |
| D10C | Nessuna missione | elenco vuoto: stato vuoto con il compagno e «Crea una missione». |
| D11A | Menu a pressione lunga | menu a pressione lunga sulla riga «Bevi 2 litri d'acqua»; la stessa scelta si ha scorrendo a sinistra per «Salta oggi». |
| D11B | Salta oggi |  |
| D12A | Scegli una priorità |  |
| D12B | Tre priorità già scelte | con 3 priorità già scelte il pulsante resta ma è spento (non cliccabile) e il messaggio spiega perché. |
| D13A |  | foglio a mezza altezza con tastiera aperta; la barra con ricompense e Salva sta sempre sopra la tastiera, Invio salva. Qui il nome è «Leggi 20 pagine», Intelligenza scelta. |
| D13B |  | stato senza statistica: Salva è attivo ma l'avviso spiega che l'eroe non cresce. Il nome vuoto spegnerebbe Salva (non mostrato). |
| D14A |  | foglio a tutta altezza con «Altre opzioni» aperte: una riga per campo con valore a destra; in modifica si apre già così se un campo avanzato non è al default. |
| D14B |  | Frequenza con «Giorni della settimana» scelto: 7 cerchi con l'iniziale (qui Lun, mer, ven). Non mostro le frequenze non previste. |
| D14C |  |  |
| D15A |  |  |
| D15B |  |  |
| D16A |  | modifica: sotto i campi Archivia (secondario) ed Elimina (testo in colore pericolo). |
| D16B |  | modifica: sotto i campi Archivia (secondario) ed Elimina (testo in colore pericolo). |
| D17 |  | il tocco su un modello riempie l'editor senza salvare, così si ritocca prima di Salva. |
| D18A |  | elenco completo: categorie richiudibili e gruppo «In pausa» in fondo, con il lucchetto sulla serie congelata. |
| D18B |  |  |
| D19A |  |  |
| D19B |  | filtro Archiviate: righe tenui con data e Ripristina; serie e percentuale restano come ricordo. |
| D19C |  | per una missione non archiviata il dialogo propone «Archivia invece» (in evidenza); per una già archiviata ci sono solo Annulla (in evidenza) ed Elimina. |
| D20A |  |  |
| D20B |  |  |
| D21 |  | una sola schermata a blocchi; scadenza e statistica facoltative sono sotto (non visibili senza scorrere). In Minimal il boss è l'icona in un cerchio: cambiando difficoltà cambia solo l'icona. |
| D22A |  | tre boss attivi: il posto «+ Nuovo obiettivo» non c'è e al suo posto una riga spiega il limite. Le scadenze entro 3 giorni sono in colore pericolo. |
| D22B |  |  |
| D23 |  | schermo intero e saltabile: l'anello si chiude e piovono coriandoli sobri (animazione nel lotto 7). XP e monete salgono con un conteggio. |
| D24 |  | foglio dal basso alla prima apertura dopo la scadenza (non schermata intera). In Minimal non c'è la battuta del boss: testo neutro. |
| D25A |  | trofei in miniatura su un piedistallo (qui un'icona su una base: il disegno del piedistallo è nel lotto 8). |
| D25B |  |  |
| D26A |  |  |
| D26B |  | umore triste: l'umore dipende dal tasso di completamento degli ultimi 3 giorni; la soglia esatta è nel documento analisi. |
| D26C |  |  |
| D26D |  |  |
| D27A |  |  |
| D27B |  |  |
| D27C |  | al massimo di scudi il pulsante è spento e una riga spiega perché; il limite di 2 è un esempio. |
| D28A |  |  |
| D28B |  | vita piena: «Usa» spento sulla pozione. Lo scudo non si usa a mano, scatta da solo. |
| D28C |  |  |
| D29 |  | primi giorni: numeri a 1/–, heatmap vuota e una frase; senza confronti con periodi precedenti. |
| D30 |  |  |
| D31 |  | dettaglio di una missione misurabile: anello del giorno e barre della settimana (il periodo Mese ha lo stesso grafico su 30 giorni). |
| D32 |  |  |
| D33A |  |  |
| D33B |  |  |
| D34A |  | badge sbloccati con colore, bloccati come sagoma tratteggiata col lucchetto; i nomi sono esempi. |
| D34B |  | badge sbloccati con colore, bloccati come sagoma tratteggiata col lucchetto; i nomi sono esempi. |
| D35A |  | salita di livello: il titolo nuovo è un segnaposto (Minimal usa solo «Livello»); animazione nel lotto 7. |
| D35B |  |  |
| D35C |  | evoluzione del compagno: stadio Adulto. Lo stadio intermedio è nel lotto 8. |
| D36A |  | pagina a gruppi (in questa schermata se ne vedono 4 su 7: Accessibilità, Dati e Informazioni sono sotto). Righe alte 52, valore a destra in testo tenue. |
| D36B |  |  |
| D36C |  |  |
| D37A |  |  |
| D37B |  | modalità Essenziale: niente livello, vita, XP, monete né boss; restano compagno, serie, Piano e missioni. In «Primi passi» niente ricompensa. |
| D38A |  |  |
| D38B |  |  |
| D39A |  |  |
| D39B |  |  |
| D40A |  | in alto il promemoria con i due pulsanti; sotto la conferma breve dopo «Completa», che sparisce da sola. Le notifiche usano l'aspetto del sistema: cambia solo il testo. |
| D40B |  |  |
| D41 |  | il tocco sul widget piccolo con notifiche non viste apre questo foglio su Oggi; il numero del bollino si azzera alla chiusura. |
| D42A |  | testo al 200%: la scheda dell'eroe si dispone in colonna e le barre vanno a capo; l'area di tocco dei controlli resta 44×44 almeno. Etichette della barra di navigazione limitate al 130% (scelta mia, per non spezzarle). |
| D42B |  | riga missione al 200%: il nome va su due righe, la riga cresce in altezza, spunta e icona restano a dimensione fissa. |
| D42C |  | editor al 200%: i tre pulsanti di difficoltà passano in colonna, il nome può andare su più righe; la barra con Salva resta fissa. |
| D43 |  | tablet oltre 840 di larghezza: due colonne, a sinistra eroe e boss, a destra le missioni; la barra di navigazione diventa laterale (non disegnata). Frame 900×640 (non 390×844). |

## Cose da sapere
- **Segnaposto:** il logo (D01), il piedistallo e la forma dei badge (D25, D34: nel lotto 8), le icone di scudo e pozione (D27, D28: uso icone esistenti, mancano quelle giuste).
- **Testi inventati da me:** frasi di tono dei temi (D03), notifiche d'esempio (D05, D40), battute e nomi dei trofei e dei badge (D25, D34), testi dei fogli di conferma (D37, D39).
- **Minimal non ha sprite dei boss:** boss e trofei sono icone a linea in un cerchio.
- **D42 (testo al 200%):** simulato ingrandendo i caratteri; le etichette della barra di navigazione sono limitate al 130%.
- **D43 (tablet):** disegnata solo la vista a due colonne, senza barra laterale.
