<!-- Copia su Drive: https://docs.google.com/document/d/1v0ZlGk5h8MvqffbCXUyDtriWzksLJv1h0aXaH8Slve4/edit — importata il 06/11/2026. Questo file è il riferimento principale. -->

# GHQ Mobile – Design delle sezioni

v1.2 · 30/10/2026 · tutte le sezioni approvate · per Claudio. Basata su [GHQ Mobile – Analisi funzionale v3](https://docs.google.com/document/d/1z-NeKZ1CZ9zxYytlx-HKfgt_uON7znNHniEKtNg_3SE/edit) e su [GHQ Mobile – Statistiche dell'eroe](https://docs.google.com/document/d/1cCj5a95Bc3Ulla4feU_AIODb6MRjq8FKUi74Jkig4ek/edit).

## Come si usa questo documento

Il documento definisce, punto per punto, come appare e come si comporta ogni sezione dell'app nei sei temi (Arcade, Fantasy, Cyberpunk, Lovecraft, Minimal chiaro, Minimal scuro). Sostituisce la proposta di design del 15/10, che resta solo come riferimento per palette, caratteri e icone già disegnati.

  - Si procede una sezione alla volta. Ogni punto ha una proposta; dove ci sono alternative, quella raccomandata è segnata con **★**.
  - Claudio risponde con «ok» o con le modifiche; la sezione passa allora a «Approvata» e si passa alla successiva.
  - Il documento descrive solo il design. Funzioni, regole e priorità MoSCoW restano quelle dell'analisi funzionale, che fa fede.
  - I nomi di gioco sono concettuali (vita, esperienza, monete, missioni, boss, serie, livello, compagno); ogni tema li rinomina secondo il lessico (punto A10).

### Stato delle sezioni e ordine di revisione proposto

L'ordine parte dalle basi comuni e dalla schermata Oggi, che fissano i componenti usati ovunque; il Primo avvio viene rivisto per ultimo tra le sezioni principali perché mostra in anteprima le altre.

  

|  |  |  |
| :-: | :-: | :-: |
| **Ordine** | **Sezione** | **Stato** |
| 1 | A. Basi comuni (sistema di design) | Approvata il 30/10 |
| 2 | 2\\. Oggi | Approvata il 30/10 |
| 3 | 4\\. Editor missione | Approvata il 30/10 |
| 4 | 3\\. Abitudini | Approvata il 30/10 |
| 5 | 5\\. Obiettivi e boss | Approvata il 30/10 |
| 6 | 6\\. Compagno | Approvata il 30/10 |
| 7 | 9\\. Profilo e progressione | Approvata il 30/10 |
| 8 | 7\\. Negozio e inventario | Approvata il 30/10 |
| 9 | 8\\. Statistiche | Approvata il 30/10 |
| 10 | 1\\. Primo avvio | Approvata il 30/10 |
| 11 | 10\\. Impostazioni e dati | Approvata il 30/10 |
| 12 | 11\\. Promemoria e notifiche | Approvata il 30/10 |
| 13 | 12\\. Widget e integrazioni | Approvata il 30/10 |

  
  

### Cosa cambia rispetto alla proposta del 15/10

  - Il design è definito sezione per sezione, con stati, interazioni e varianti di tema, e non più solo sulla schermata Oggi.
  - I colori diventano ruoli uguali in tutti i temi, con una versione «testo» per ogni colore di stato: alcuni colori della proposta precedente non raggiungevano il contrasto richiesto come testo (punto A4).
  - Gli sprite dei temi di gioco passano da 16×16 a 32×32 per compagni e boss, così da mostrare l'umore (punto A5).
  - Si aggiungono le icone mancanti per funzioni approvate dopo il 15/10: statistiche dell'eroe, salta, pausa, non disturbare, backup e altre.
  - Il lessico si estende ai termini nuovi dell'analisi (Piano del giorno, pozione, scudo, esausto, Sala dei trofei).
  - Si definisce l'aspetto della modalità Essenziale e della scala di testo di sistema in ogni tema.

## A. Basi comuni

Stato: **approvata da Claudio il 30/10, con le scelte ★**. Valgono per tutte le sezioni; le sezioni successive descrivono solo ciò che aggiungono o cambiano.

### A1. Principi

1.  **Una struttura, sei vesti.** Posizione degli elementi, navigazione e gesti sono identici in ogni tema. Un tema cambia colori, caratteri, forme, icone, sprite, lessico, animazioni e suoni.
2.  **Il pollice prima di tutto.** Le azioni frequenti (completa, crea, conferma) stanno nella metà bassa dello schermo o a destra della riga, con area toccabile di almeno 44 punti su iOS e 48 dp su Android.
3.  **Il gioco in proporzione al tema.** Nei temi di gioco vita, boss e compagno sono protagonisti; in Minimal ci sono ma sono piccoli e sobri; in modalità Essenziale spariscono.
4.  **Leggibilità prima del costume.** I caratteri decorativi stanno solo su titoli, etichette brevi e numeri; il testo che si legge usa sempre un carattere leggibile.
5.  **Ogni gesto ha una risposta immediata.** Riscontro visivo entro 300 ms; le animazioni lunghe si possono saltare con un tocco e non bloccano mai l'app.

### A2. Griglia e spaziature

  - Unità base 4 punti. Spazi ammessi: 4, 8, 12, 16, 24, 32, 48.
  - Margini laterali dello schermo 16; spazio interno delle schede 16; spazio tra schede 12; spazio tra sezioni 24.
  - Area toccabile minima 44×44 punti su iOS e 48×48 dp su Android, cioè la misura nativa di ciascuna piattaforma (circa 7–9 mm), anche quando l'icona disegnata è più piccola (24 o 32).
  - Riga missione alta almeno 64; riga semplice di elenco (impostazioni, registro) alta almeno 52.
  - Tablet: stesso layout, contenuto centrato con larghezza massima 600; le schede di Oggi e Statistiche si dispongono su due colonne sopra i 840 di larghezza.
  - Zone sicure di iOS e Android sempre rispettate; la barra di navigazione resta sopra l'indicatore di sistema.

### A3. Caratteri

Si confermano le famiglie della proposta precedente: tutte Google Fonts con licenza SIL OFL, quindi incluse nell'app senza costi. Cambia la definizione: ogni tema assegna un carattere e un corpo a sette ruoli fissi, così ogni schermata si descrive una volta sola.

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| **Ruolo** | **Minimal** | **Arcade** | **Fantasy** | **Cyberpunk** | **Lovecraft** |
| Display (livello, vittoria) | Manrope 800, 32 | Press Start 2P, 20 | Cinzel 700, 30 | Chakra Petch 700, 30, maiuscolo | IM Fell English SC, 30 |
| Titolo schermata | Manrope 800, 24 | Press Start 2P, 14 | Cinzel 700, 22 | Chakra Petch 600, 22, maiuscolo | IM Fell English SC, 24 |
| Titolo sezione | Manrope 700, 17 | Press Start 2P, 10, maiuscolo | Cinzel 600, 15, spaziato | Chakra Petch 600, 14, maiuscolo spaziato | IM Fell English SC, 17 |
| Corpo | Manrope 500, 16 | VT323, 22 | Alegreya 400, 17 | Chakra Petch 400, 16 | Crimson Pro 400, 18 |
| Etichetta (pulsanti, chip) | Manrope 600, 14 | VT323, 20, maiuscolo | Alegreya 500, 15 | Share Tech Mono, 14, maiuscolo | Crimson Pro 600, 15 |
| Numeri (XP, monete, barre) | Manrope 700, 15, cifre tabellari | Press Start 2P, 11 | Alegreya 500, 16, cifre allineate e tabellari | Share Tech Mono, 15 | Crimson Pro 600, 16, cifre allineate e tabellari |
| Didascalia | Manrope 500, 12 | VT323, 18 | Alegreya 400 corsivo, 14 | Share Tech Mono, 12 | Crimson Pro 400 corsivo, 14 |

  - **Perché questi caratteri.** Press Start 2P e VT323 sono i caratteri dei cabinati e dei terminali anni '80; Cinzel e Alegreya danno l'aria di pergamena senza perdere leggibilità; Chakra Petch e Share Tech Mono sono squadrati e tecnici; IM Fell riproduce caratteri del Seicento, adatti al tomo antico, con Crimson Pro per leggere; Manrope è neutro e ha cifre tabellari che non ballano nei contatori.
  - **Cifre.** Alegreya e Crimson Pro hanno di serie numeri «antichi» di altezza variabile: nei contatori si attivano le cifre allineate e tabellari.
  - **Testo di sistema più grande.** Corpo, etichette e didascalie seguono la dimensione del testo del telefono fino al 200%; titoli e Display si fermano al 150%, così le parole lunghe non si spezzano. Press Start 2P scala solo a multipli di 2 punti per restare nitido.
  - **Lingue.** Prima dello sviluppo va verificato che ogni carattere abbia tutti i segni di tedesco, francese e spagnolo (ß, œ, ñ, ¿, ¡ e accenti). Dove ne manca uno (il rischio maggiore è IM Fell English SC), quel ruolo ripiega sul carattere di testo del tema.
  - **Lunghezza dei testi.** I layout prevedono testi del 30% più lunghi dell'italiano (tedesco); i nomi delle missioni vanno su due righe e poi si troncano con «…».

### A4. Colori

Ogni tema definisce gli stessi ruoli di colore; lo sviluppo usa solo i ruoli, mai i valori. I valori di partenza sono quelli della proposta del 15/10 (file temi.json), con le correzioni sotto.

|  |  |
| :-: | :-: |
| Ruolo | Uso |
| sfondo, superficie, superficie alta | Fondo dello schermo, schede, fogli e menu |
| bordo, traccia | Contorni, divisori, parte vuota delle barre |
| testo, testo tenue | Testo principale e secondario |
| primario, su primario | Azioni principali e pulsante \\\[+\\\]; testo sopra il primario |
| vita, esperienza, monete | Barre e numeri di gioco |
| fatto, saltato, pericolo, info | Stati delle missioni e messaggi |
| boss | Scheda e barra del boss |
| heatmap 0–4 | Cinque livelli, dalla traccia al colore pieno, per Statistiche |

  

  - **Due versioni per ogni colore di stato.** La versione grafica (barre, icone) deve avere contrasto almeno 3:1 con il fondo; la versione testo almeno 4,5:1. Ho misurato i colori della proposta precedente: Arcade vita (\#b13e53) arriva a 3,0 sullo sfondo e 1,9 sulle schede; in Minimal chiaro vita (3,6), fatto (2,9) e monete (3,1) non bastano come testo; Lovecraft vita sulle schede è 3,8.
  - **Correzioni proposte** per la versione testo: Arcade vita \#ffa0ac (5,7 sulle schede); Minimal chiaro vita \#ce2c31 (4,9), fatto \#18794e (5,0), monete \#8f5e00 (5,2); Lovecraft vita \#a58bc9 (5,7). Arcade fatto (\#38b764, 4,2 sulle schede) va schiarito leggermente. Gli altri temi superano già le soglie.
  - **Il colore non è mai l'unico segnale.** Ogni stato ha anche un'icona o un testo; ogni barra mostra anche il numero (es. 32/50).
  - **Colori per daltonici** (opzione nelle Impostazioni): heatmap, barre e stati passano a una scala blu–arancio distinguibile con deuteranopia e protanopia, uguale in tutti i temi.
  - **Statistiche dell'eroe.** ★ Un solo colore (il primario del tema) per tutte e sei, distinte da icona e nome: meno rumore e nessun problema per i daltonici. In alternativa, sei colori dedicati per tema, più vivaci ma da verificare uno per uno.

### A5. Icone e sprite

  - **Icone di interfaccia.** Si mantengono le 29 icone a linea 24×24 (tratto diverso per tema) e le icone pixel 12×12 per Arcade, mostrate a 24 (2×). Corpi d'uso: 24 nella barra di navigazione e nelle intestazioni, 20 nelle righe, 16 nei chip.
  - **Icone da aggiungere**, per funzioni approvate dopo la prima proposta: le 6 statistiche dell'eroe (Forza, Costituzione, Intelligenza, Saggezza, Carisma, Disciplina), le 4 categorie dei modelli (Salute, Mente, Lavoro e studio, Casa), salta, pausa, archivio, ripristina, cerca, filtro, trascina, nota, regalo, badge, freccia di forma su e giù, lingua, backup, non disturbare, accessibilità, esporta, informazioni. Sono 29 icone nuove, nello stesso formato delle esistenti (SVG, PNG, Vector Drawable Android).
  - **Sprite dei temi di gioco.** ★ Pixel art per Arcade, Fantasy, Cyberpunk e Lovecraft, con palette propria di ogni tema: è coerente con lo spirito GDR e costa poco da produrre. Compagni e boss passano a 32×32 (mostrati a 3× o 4×) per avere espressioni leggibili; oggetti e trofei restano 16×16.
  - **Sprite del compagno.** Per ogni tema: uovo, poi cucciolo e adulto in tre umori (felice, normale, triste) più la posa di esultanza per i regali, cioè 9 disegni per tema e 45 in tutto. Il quarto stadio (Could) si aggiunge solo se approvato.
  - **Boss.** ★ Tre boss per tema, scelti in base alla difficoltà dell'obiettivo (facile, media, difficile), per dare varietà; la proposta precedente aveva un solo boss ricolorato.
  - **Oggetti.** Pozione, scudo della serie, moneta, trofeo, badge e i tre regali per il compagno (biscotto, caramella, palla), ognuno nella veste di ogni tema.
  - **Minimal** non usa pixel art: il compagno Goccia è vettoriale e gli oggetti sono icone a linea con un tocco di colore.
  - Tutti gli sprite si raccolgono nel documento di sprite e icone già esistente, aggiornato, così da poterli estrarre facilmente; in app si scalano solo a multipli interi e senza sfumatura.

### A6. Componenti comuni

  - **Barra di navigazione.** In basso, sempre visibile: Oggi, Abitudini, \[+\], Obiettivi, Profilo (decisione dell'08/11: con 4 voci il \[+\] sta davvero al centro). Statistiche si apre da Profilo e dalla scheda dell'eroe in Oggi. Icona sopra un'etichetta sempre visibile; la voce attiva usa il colore primario e un indicatore (pillola in Minimal, cornice pixel in Arcade, rombo in Fantasy, linea neon in Cyberpunk, sigillo in Lovecraft). ★ Il \[+\] è un pulsante rotondo di 56 al centro della barra, leggermente rialzato, colore primario. In alternativa un pulsante flottante sopra la barra a destra, che però copre l'ultima riga degli elenchi.
  - **Intestazione di schermata.** Titolo grande che, scorrendo, si riduce a una barra compatta con il titolo piccolo.
  - **Scheda.** Superficie con il bordo del tema: angoli arrotondati 18 in Minimal, cornice pixel in Arcade, filetto oro in Fantasy, angoli tagliati in Cyberpunk, doppio filetto in Lovecraft.
  - **Riga missione** (usata in Oggi, Abitudini, widget): a sinistra l'icona della categoria; al centro nome e, sotto, frequenza o avanzamento (es. «1,2 di 2 L») con la difficoltà; a destra gli XP in palio e il controllo di completamento (48×48). Le missioni misurabili hanno un anello di avanzamento attorno al controllo; quelle a durata hanno un pulsante play al posto della spunta.
  - **Barre** (vita, esperienza, boss, statistiche): sempre con il numero accanto. Forma: pillola in Minimal, segmenti pixel in Arcade, barra con contorno in Fantasy, segmenti sottili con alone in Cyberpunk, linea piatta sottile in Lovecraft.
  - **Difficoltà.** Da 1 a 3 tacche (icona spada in Fantasy, blocchi in Arcade, barre in Cyberpunk, occhi in Lovecraft, punti in Minimal) più la parola, letta anche dal lettore di schermo.
  - **Foglio dal basso** per editor e scelte rapide; **dialogo** solo per azioni che non si annullano (elimina, cancella dati); **avviso con Annulla** in basso per 5 secondi dopo completamenti, archiviazioni e salti.
  - **Stato vuoto.** Il compagno del tema, una frase nel lessico del tema e una sola azione.
  - **Pulsanti.** Primario, secondario, solo testo, distruttivo (colore pericolo); altezza 48.

### A7. Animazioni, suoni e momenti di gioco

  - Durate: 150 ms per piccoli cambi, 250 ms per aperture e chiusure, 400 ms per i passaggi di schermata.
  - **Completamento**: la spunta si disegna, compaiono «+25 XP» e le monete che salgono dalla riga verso l'intestazione, vibrazione leggera. Per tema: moneta che lampeggia (Arcade), sigillo di ceralacca (Fantasy), glitch e timestamp (Cyberpunk), inchiostro che si allarga in un sigillo a stella (Lovecraft), spunta netta (Minimal).
  - **Momenti a schermo intero**, saltabili con un tocco: salita di livello, vittoria sul boss, evoluzione del compagno, badge sbloccato. Durano al massimo 2,5 secondi; se capitano insieme si mostrano in fila, dal più importante.
  - **Riduci movimento** (dell'app o del sistema): niente particelle, scosse e zoom; restano dissolvenze di 150 ms e i numeri che cambiano.
  - ★ Suoni spenti di default e vibrazioni accese; i suoni del tema (chiptune, pergamena, glitch, sussurri) si attivano dalle Impostazioni.

### A8. Accessibilità

  - Contrasto: testo 4,5:1, elementi grafici e bordi dei controlli 3:1, verificati in tutti i temi.
  - Ogni elemento ha un'etichetta per VoiceOver e TalkBack che dice nome, stato e azione, es. «Meditazione, media, 25 XP, da fare. Tocca due volte per completare».
  - Le azioni nascoste nei gesti (scorrimento, pressione lunga) sono raggiungibili anche come azioni del lettore di schermo.
  - Le decorazioni di tema (scanline, griglia, vignettatura) non scendono mai sotto il testo con contrasto ridotto e si spengono con Riduci movimento o contrasto elevato.

### A9. Modalità Essenziale

In tutte le sezioni Essenziale nasconde vita, boss, negozio e monete; la scheda del personaggio sparisce dal Profilo. Livello ed esperienza restano ma come testo piccolo, senza barra in evidenza e senza momenti a schermo intero (solo un avviso). Missioni, serie, statistiche e compagno restano. ★ La voce Obiettivi resta nella barra come elenco di obiettivi divisi in passi, senza sprite né vita del boss; in alternativa sparisce e la barra ha una voce in meno.

### A10. Lessico dei termini nuovi

Il lessico della proposta precedente resta valido. Propongo questi nomi per i termini entrati con l'analisi funzionale; i titoli dell'eroe e i nomi delle statistiche si definiscono nella sezione Profilo e nel documento sulle statistiche.

|  |  |  |  |  |  |
| :-: | :-: | :-: | :-: | :-: | :-: |
| Concetto | Arcade | Fantasy | Cyberpunk | Lovecraft | Minimal |
| Piano del giorno | Top 3 | Giuramenti del giorno | Priorità di rete | Presagi del giorno | Priorità |
| Giornata completa | Perfect\\\! | Giornata gloriosa | Sync completo | Il sigillo regge | Giornata completa |
| Pozione | Power-up | Pozione | Stim | Tonico | Ricarica |
| Scudo della serie | Continue | Scudo | Backup | Amuleto | Protezione serie |
| Eroe esausto | Stordito | Esausto | In riavvio | In delirio | In recupero |
| Sala dei trofei | Hall of Fame | Sala dei trofei | Archivio taglie | Collezione proibita | Traguardi |
| Salta oggi | Pausa | Riposa oggi | Standby | Rimanda il rito | Salta oggi |


### A11. Regole di dettaglio

Approvate da Claudio l'08/11 (lacune L03 e L04). Le altre regole di dettaglio (L02, L05, L09–L17, L24) restano da approvare e verranno aggiunte qui.

**A11.1 Testo molto grande (L03).**

  - Soglia unica: con `fontScale ≥ 1,3` si attivano tutti i layout alternativi già descritti nelle sezioni. Sotto 1,3 il layout è quello normale.
  - Barra di navigazione (4 voci + \[+\]): etichette su una riga, scala ferma a 1,3, troncate con «…». L'etichetta completa resta per il lettore di schermo.
  - Riga missione: il controllo resta a destra; XP e difficoltà vanno sotto il nome; il nome può andare su 3 righe.
  - Scheda del boss compatta in Oggi: lo sprite sparisce e il resto va in colonna.
  - Press Start 2P (Arcade): il corpo si arrotonda per difetto al multiplo di 2.

**A11.2 Lessico (L04).**

  - Ogni voce del lessico ha `singolare`, `plurale` e `genere` (m/f), per lingua. L'italiano è definitivo; inglese proposto, tedesco, francese e spagnolo da fare in T28 (scelta minore 7). File: `design/lessico-v2.json`.
  - Le etichette della barra di navigazione **non** si tematizzano: Oggi, Abitudini, Obiettivi, Profilo (e Statistiche dove compare). Servono a orientarsi, e «Conoscenza proibita» non ci starebbe. Si tematizzano i titoli delle schermate.
  - Parola della vittoria: Arcade «YOU WIN!», Fantasy «Vittoria!», Cyberpunk «ACCESSO OTTENUTO», Lovecraft «L'Orrore è ricacciato», Minimal «Obiettivo raggiunto».
  - Titolo del Profilo: «PLAYER 1», «Scheda dell'eroe», «Dossier», «Diario dell'investigatore», «Profilo». Titolo di Statistiche: «HIGH SCORE» in Arcade, «Statistiche» negli altri.
  - Titolo di Modifica: «Modifica» + il nome del tema al singolare (es. «Modifica impresa»).
  - Titolo «Missioni di oggi»: plurale di `missioni` + «di oggi» (es. «Imprese di oggi»). Da confermare nei frame.

**A11.3 Barra di stato (L23, approvata il 12/11).**

  - Barra di stato e tasti di sistema di Android: icone chiare sui temi scuri (Arcade, Cyberpunk, Lovecraft, Minimal scuro), scure su Fantasy e Minimal chiaro; il fondo della finestra è lo `sfondo` del tema.


## 1. Primo avvio

Stato: approvata da Claudio il 30/10, con le scelte ★. Obiettivo di design: dalla prima apertura alla prima missione completata in meno di 2 minuti, senza account e senza spiegazioni da leggere, con il tema scelto che si vede subito.

### 1.1 Struttura del flusso

  - Cinque passi a schermo intero, nell'ordine dell'analisi: lingua, nome dell'eroe, tema, prime missioni, notifiche. Nessuna schermata di login o di benvenuto separata.
  - In alto un indicatore a cinque segmenti e la freccia Indietro (dal passo 2); in basso il pulsante principale «Continua», alto 56, sempre sopra la tastiera.
  - Solo il nome è obbligatorio: i passi tema, missioni e notifiche hanno anche «Salta» in testo, che lascia la scelta predefinita.
  - ★ I passi 1 e 2 usano Minimal, chiaro o scuro come il telefono; dal passo 3 in poi il flusso prende subito il tema scelto, così l'utente vede l'app che avrà. In alternativa tutto il flusso resta in Minimal e il tema compare solo su Oggi.
  - Se l'app si chiude a metà, si riparte dal passo lasciato con le scelte già fatte.

### 1.2 Lingua

  - In cima il logo di GHQ e la frase «Scegli la lingua», scritta nella lingua preselezionata.
  - Elenco di 5 righe con il nome nella lingua stessa (Deutsch, English, Español, Français, Italiano) e un segno di spunta sulla preselezionata, cioè quella del telefono o l'inglese.
  - Il tocco su una riga cambia subito tutti i testi della schermata; «Continua» conferma.

### 1.3 Nome dell'eroe

  - Il compagno ancora uovo al centro, che dondola, e la domanda «Come si chiama il tuo eroe?».
  - Campo di testo con la tastiera già aperta, fino a 20 caratteri; «Continua» resta spento finché il campo è vuoto, con sotto «Puoi cambiarlo quando vuoi dal Profilo».

### 1.4 Tema

  - ★ Carosello orizzontale di schede grandi, una per tema: Arcade, Fantasy, Cyberpunk, Lovecraft, Minimal. Ogni scheda è un'anteprima vera di Oggi con il nome appena scritto, l'uovo del tema, due missioni d'esempio e le parole del lessico. In alternativa una griglia di miniature con un'anteprima grande sotto.
  - Sotto la scheda il nome del tema e una riga che ne dice il tono (es. «Lovecraft: un grimorio di riti quotidiani»), poi i puntini del carosello.
  - Scorrendo, sfondo, caratteri e pulsanti di tutta la schermata passano al tema al centro, così l'anteprima è l'intera schermata.
  - Minimal è preselezionato e ha sotto la scheda tre chip: Automatico (★, segue il telefono), Chiaro, Scuro.

### 1.5 Prime missioni

  - Titolo «Scegli da 1 a 5 missioni per iniziare», le 4 schede per categoria (Salute, Mente, Lavoro e studio, Casa) e le schede dei modelli con icona, nome, frequenza e difficoltà, come nella libreria dell'editor.
  - ★ Tre modelli consigliati arrivano già selezionati (Bevi 2 litri d'acqua, Leggi 20 pagine, Meditazione 10 min), così il procrastinatore può proseguire con un tocco. In alternativa nessun modello è selezionato.
  - Il tocco su una scheda la seleziona con il segno di spunta; un contatore «3 di 5» accanto a «Continua». Al sesto tocco la scheda non si seleziona e il contatore spiega «Massimo 5: potrai aggiungerne altre dopo».
  - Frequenza e difficoltà non si cambiano qui: si modificano dopo dall'editor, per tenere il passo veloce.

### 1.6 Notifiche

  - Lo sprite dell'uovo e due finte notifiche d'esempio, come appariranno sul telefono: un promemoria di una missione e il riepilogo serale, firmati dal compagno.
  - Una frase che dice cosa arriverà e quando: «Ti ricordo le missioni all'ora che scegli e la sera ti dico com'è andata».
  - Pulsante «Attiva i promemoria», che apre la richiesta del sistema; sotto, in testo, «Non ora».
  - Se l'utente rifiuta, il flusso prosegue senza avvisi e il permesso si ripropone solo dalle Impostazioni, come deciso nell'analisi.

### 1.7 Arrivo su Oggi

  - Breve transizione nel tono del tema (il sipario pixel in Arcade, la pergamena che si srotola in Fantasy, il glitch in Cyberpunk, l'inchiostro che si allarga in Lovecraft, una dissolvenza in Minimal), poi Oggi con le missioni scelte.
  - La quest di partenza è al posto del boss, come previsto in Oggi: una scheda con il piccolo boss del tema, i 3 passi e la ricompensa (primo livello e prime monete).
  - ★ Il primo passo, crea la prima abitudine, è già spuntato all'arrivo, perché le missioni scelte contano: l'utente vede subito un progresso. In alternativa il passo chiede di creare una missione nuova con l'editor.
  - ★ Un solo suggerimento, un fumetto del compagno vicino alla prima missione: «Tocca il cerchio quando l'hai fatta». Sparisce al primo completamento o al tocco altrove. In alternativa nessun suggerimento.

### 1.8 Schiusa e quest di partenza

  - Il primo completamento fa partire la schiusa a schermo intero, come nella sezione Compagno, con la scelta o la conferma del nome; poi la scheda della quest segna il secondo passo.
  - Il terzo passo, apri le statistiche, fa pulsare una volta la voce Statistiche nella barra. Aprirla completa la quest: torna su Oggi il momento a schermo intero della vittoria, più piccolo di quello di un boss, con il primo livello e le prime monete.
  - Dopo la vittoria la scheda della quest sparisce e al suo posto compare la riga «Trasforma un obiettivo in un boss».
  - Nomi della quest per tema: «TUTORIAL STAGE» (Arcade), «La prima impresa» (Fantasy), «Contratto d'ingresso» (Cyberpunk), «Il primo rito» (Lovecraft), «Primi passi» (Minimal).

### 1.9 Modalità Essenziale

  - Il flusso parte sempre in modalità Completo; Essenziale si sceglie poi dalle Impostazioni.
  - Se si passa a Essenziale prima di vincere la quest, la scheda diventa una piccola lista «Primi passi» con gli stessi 3 passi, senza sprite né vita del boss, e alla fine dà solo un avviso.

### 1.10 Accessibilità

  - Ogni passo si annuncia come «Passo 2 di 5, nome dell'eroe»; il pulsante Continua spento dice perché.
  - Il carosello dei temi si scorre anche con i gesti del lettore di schermo, e ogni scheda ha una descrizione («Tema Fantasy: pergamena, colori caldi, compagno drago»).
  - Con Riduci movimento l'uovo non dondola, la transizione verso Oggi è una dissolvenza e la schiusa diventa un cambio di sprite con la frase.
  - Con testo molto grande le schede dei modelli passano a una colonna e l'anteprima del tema si riduce senza tagliare i testi.

### 1.11 Scelte da approvare

1.  Passi 1 e 2 in Minimal e tema scelto applicato dal passo 3 (★) o tutto il flusso in Minimal.
2.  Temi in un carosello di schede grandi con anteprima (★) o in una griglia di miniature.
3.  Tre modelli consigliati già selezionati (★) o nessuno.
4.  Primo passo della quest già fatto all'arrivo (★) o da fare con l'editor.
5.  Un solo suggerimento del compagno sulla prima missione (★) o nessun suggerimento.

## 2. Oggi

Stato: **approvata da Claudio il 30/10, con le scelte ★**. Obiettivo di design: in tre secondi l'utente sa come sta l'eroe, da dove iniziare e quanto manca al boss, e completa la prima missione con un tocco.

### 2.1 Ordine degli elementi

★ Dall'alto: intestazione con data e saluto, scheda dell'eroe, Piano del giorno, boss in corso, missioni di oggi. Le priorità vengono prima del boss perché rispondono alla domanda «da dove inizio?», la più importante per il procrastinatore; il boss resta visibile senza scorrere sulla maggior parte dei telefoni. In alternativa il boss sopra il Piano, più spettacolare ma meno utile.

### 2.2 Intestazione e scheda dell'eroe

  - Riga in alto: data (es. «Giovedì 16 ottobre») e saluto con il nome dell'eroe, nel tono del tema.
  - Scheda dell'eroe, alta circa 128: a sinistra il compagno (64, animato a riposo, si tocca per aprire la sua scheda); a destra nome, titolo e livello, poi le barre di vita ed esperienza con i numeri, poi due chip: serie in giorni e monete.
  - ★ Scorrendo, la scheda si riduce a una barra fissa sottile con livello, vita ed esperienza, così il riscontro dei completamenti resta sempre visibile.
  - Minimal: compagno a 40, barre sottili, chip discreti; i temi di gioco danno più spazio al compagno e alle barre.
  - Alla prima apertura della giornata, sotto la scheda dell'eroe compare il fumetto del mattino del compagno (vedi 6.14). Si chiude con un tocco e non torna fino a domani.


### 2.3 Piano del giorno

  - Tre posti numerati. Un posto vuoto è tratteggiato con «+ Scegli una priorità»; toccandolo si apre un foglio con le missioni di oggi da selezionare.
  - Le priorità usano la riga missione in versione più grande, con il numero 1–3 a sinistra.
  - ★ Una missione nel Piano non si ripete nell'elenco sotto; il contatore «2 di 5» conta comunque tutte le missioni del giorno.
  - Con tre priorità già scelte, l'opzione «Aggiungi alle priorità» resta visibile ma spiega «Hai già 3 priorità: togline una».
  - Quando tutte le priorità sono fatte, la sezione si chiude con un piccolo sigillo del tema e «+25 XP».
  - Il primo giorno, senza priorità, la sezione mostra una frase che spiega a cosa serve.

### 2.4 Boss in corso

  - Scheda compatta: sprite del boss (48), nome dell'obiettivo, barra della vita del boss con numero, «Passi 3 di 8», prossimo passo con il suo controllo, giorni alla scadenza.
  - Il prossimo passo si completa da qui con un tocco, con avviso e Annulla. L'ultimo passo, che dà la vittoria, non ha Annulla (12/11).
  - La scadenza diventa colore pericolo con icona quando mancano 3 giorni o meno.
  - ★ Con più boss attivi (fino a 3) la scheda scorre in orizzontale con indicatori a punti, partendo dal boss con la scadenza più vicina. In alternativa si mostra solo quello più vicino con «+2 altri».
  - Senza boss attivi: una riga «Trasforma un obiettivo in un boss» che porta a Obiettivi. Nei primi giorni qui compare la quest di partenza con i suoi 3 passi.

### 2.5 Missioni di oggi

  - Titolo di sezione con il contatore «2 di 5» e un anello di avanzamento.
  - Prima le missioni da fare: in cima le attività singole scadute (etichetta «Scaduta ieri» in colore pericolo), poi quelle con orario in ordine di ora, poi quelle senza orario.
  - ★ In fondo il gruppo «Fatte (2)», aperto di default e richiudibile, con righe in testo tenue e l'ora di completamento; in Cyberpunk l'ora è un timestamp mono.
  - Missioni misurabili: il tocco aggiunge l'incremento (es. +250 ml) e l'anello avanza; la pressione lunga apre un foglio per inserire il valore.
  - Missioni a durata: il play avvia il timer; la riga mostra il conto alla rovescia e una barra sottile, e il timer continua a schermo spento.
  - ★ Azioni secondarie: pressione lunga sulla riga per un menu (Inserisci valore, Salta oggi, Aggiungi alle priorità, Annulla completamento, Modifica, Andamento) e scorrimento a sinistra per «Salta oggi». Il tocco sul nome apre il dettaglio della missione.
  - «Salta oggi» apre un foglio con i motivi (Malattia, Viaggio, Riposo, Altro) e dice quanti salti restano questa settimana; la riga saltata va tra le fatte con l'icona salta e la parola «Saltata».

### 2.6 Completamento e annullamento

  - Al tocco: animazione del tema sulla spunta, «+XP» e monete che volano verso la scheda dell'eroe, barra dell'esperienza che si riempie, vibrazione leggera. Tutto parte entro 300 ms.
  - Se la missione è collegata a un boss, sulla scheda del boss appare il danno (es. «−5») e la barra scende; se il colpo lo sconfigge, si apre la schermata di vittoria.
  - In basso compare «Fatto · Annulla» per 5 secondi; dopo, si annulla dal menu della riga fino al cambio di giornata. Annullando, numeri e barre tornano indietro con la stessa animazione al contrario.

### 2.7 Giornata completa

Quando l'ultima missione è fatta, il contatore lascia il posto a una scheda celebrativa: compagno felice, nome del tema (es. «Giornata gloriosa»), «+10 monete +5 vita» e una breve animazione del tema (1,5 secondi). La scheda resta fino al cambio di giornata.

### 2.8 Stati particolari

  - **Nessuna missione oggi** (giorno di riposo o elenco vuoto): stato vuoto con il compagno e «Crea una missione», oppure «Giorno di riposo: la serie è al sicuro».
  - **Eroe esausto**: fascia nella scheda dell'eroe con icona e testo «Esausto: XP dimezzati fino a domani».
  - **Scudo usato**: avviso informativo in cima «Lo scudo ha protetto la tua serie ieri», chiudibile.
  - **Boss che ha rubato monete**: avviso in cima con la battuta del boss e le scelte «Nuova scadenza» (in evidenza) e «Archivia».
  - **Promemoria disattivati**: nessun avviso in Oggi; se ne parla solo nelle Impostazioni.
  - **Pausa generale** (Should, 12/11): in cima, sotto la data, una fascia informativa con l'icona pausa e il testo «In pausa fino al 20 novembre · La vita è al sicuro» (senza data di fine: «In pausa · La vita è al sicuro»), con il pulsante «Riprendi» a destra. La fascia non si chiude. Le missioni restano visibili e si possono completare (danno XP, monete e punti statistica come sempre); la scheda del boss mostra «Scadenza ferma» al posto dei giorni che mancano. Niente fumetto del mattino.
  - **Riprendi**: un dialogo spiega «La pausa finisce oggi. Da domani le missioni tornano a contare; le scadenze dei boss sono spostate di 6 giorni» con «Riprendi» e «Annulla». Dopo, la fascia diventa «Si riparte domani», chiudibile, fino al cambio di giornata.
  - **Fine della pausa**: il primo giorno dopo la pausa (alla data scelta o dopo «Riprendi»), il fumetto del mattino accoglie l'eroe con la situazione «Ritorno dalla pausa» (6.14).


### 2.9 Varianti per tema

|  |  |
| :-: | :-: |
| Tema | Come appare Oggi |
| Arcade | Scheda dell'eroe come HUD da cabinato, con punteggio (XP) in alto a destra; barre a segmenti; spunta pixel; scanline facoltative sullo sfondo. |
| Fantasy | Fondo pergamena; titoli di sezione con ornamento a rombo; compagno in un medaglione; spunta come sigillo di ceralacca. |
| Cyberpunk | Schede ad angoli tagliati con filo neon; griglia di fondo leggera; titoli con sdoppiamento magenta e ciano; timestamp sulle missioni fatte. |
| Lovecraft | Pagina di diario scura con vignettatura; caselle tratteggiate; spunta come sigillo a stella; saluto e messaggi in corsivo dal tono inquieto. |
| Minimal chiaro e scuro | Schede pulite, gioco in secondo piano: compagno piccolo, barre sottili, nessuna decorazione; segue chiaro o scuro del telefono. |

### 2.10 Modalità Essenziale

La scheda dell'eroe diventa una riga con nome, serie e livello in piccolo; spariscono vita, monete e scheda del boss. Restano Piano del giorno, missioni, completamento con la sua animazione e giornata completa (senza monete né vita).

### 2.11 Accessibilità

  - Ordine di lettura: data e saluto, eroe (livello, vita, esperienza, serie, monete), Piano, boss, missioni.
  - Ogni completamento si annuncia a voce (es. «Meditazione completata, più 25 XP»).
  - Con testo molto grande, la scheda dell'eroe va su due righe e la barra fissa mostra solo il livello.

### 2.12 Scelte approvate il 30/10

1.  Ordine: Piano del giorno prima del boss (★) o boss prima.
2.  Priorità tolte dall'elenco sotto (★) o ripetute.
3.  Più boss: scheda che scorre (★) o solo il più vicino.
4.  Azioni secondarie: pressione lunga più scorrimento per Salta (★) o solo pressione lunga.
5.  Barra fissa dell'eroe scorrendo (★) o intestazione che scorre via.

  

## 3. Abitudini

Stato: approvata da Claudio il 30/10, con le scelte ★. Obiettivo di design: vedere tutte le missioni in un posto solo, capire subito quali vanno bene e quali no, e metterle in ordine con pochi gesti.

### 3.1 Struttura della schermata

  - Intestazione con il nome del tema (Stage, Imprese, Contratti, Rituali, Abitudini) e il contatore «12 attive»; a destra le icone Cerca e «Altro» (⋯), che contiene Riordina.
  - Sotto, una riga di filtri a chip: Tutte, Abitudini, Attività singole, Archiviate, ognuno con il suo numero.
  - L'elenco è diviso per categoria (Salute, Mente, Lavoro e studio, Casa, Senza categoria) con intestazioni richiudibili che mostrano il numero di missioni.
  - ★ In fondo all'elenco un gruppo «In pausa» raccoglie tutte le missioni in pausa, così le categorie mostrano solo ciò che è attivo. In alternativa le missioni in pausa restano nella loro categoria con un'etichetta.

### 3.2 Riga della missione

  - Stessa riga di Oggi, in variante «elenco»: icona della categoria, nome, sotto frequenza (o scadenza per le attività singole) e difficoltà.
  - A destra due valori: la serie personale con l'icona del tema e la percentuale di completamento degli ultimi 30 giorni con un piccolo anello.
  - ★ In Abitudini non c'è il controllo di completamento: si completa da Oggi, così questa schermata resta un elenco da gestire e non si spuntano per sbaglio missioni non previste. In alternativa la spunta compare solo sulle missioni previste oggi.
  - Il tocco sulla riga apre il dettaglio della missione (andamento, serie, record e storico, definito nella sezione Statistiche), con il pulsante Modifica che apre l'editor.
  - La pressione lunga apre lo stesso menu di Oggi, ridotto alle azioni che hanno senso qui: Modifica, Metti in pausa, Archivia, Elimina.

### 3.3 Ricerca e filtri

  - Il tocco su Cerca apre un campo in cima che filtra mentre si scrive, dentro il filtro attivo; con il filtro Tutte cerca anche tra le archiviate, mostrate in fondo e in testo tenue.
  - Nessun risultato: frase breve e il pulsante «Crea “…”», che apre l'editor con il nome già scritto.
  - Il filtro scelto resta attivo quando si torna sulla schermata.

### 3.4 Riordino

  - ★ Il riordino si attiva da «Altro › Riordina»: compaiono le maniglie a destra delle righe e un pulsante Fine in alto. Si trascina dentro una categoria e anche da una categoria all'altra, cambiando categoria. In alternativa si riordina con pressione lunga e trascinamento, ma la pressione lunga è già il menu, come in Oggi.
  - L'ordine scelto vale anche per le missioni senza orario in Oggi.

### 3.5 Azioni con scorrimento

  - ★ Scorrendo la riga verso sinistra compaiono Pausa e Archivia; uno scorrimento lungo archivia subito, con l'avviso «Archiviata · Annulla». Elimina non sta nello scorrimento ma solo nel menu e nell'editor, per non cancellare lo storico per errore.
  - Scorrendo verso destra si apre Modifica.

### 3.6 Pausa

  - Metti in pausa apre un foglio «Fino a quando?» con le scelte 3 giorni, 1 settimana, 2 settimane, Scegli una data, Senza data di fine.
  - La riga in pausa è in testo tenue con l'icona pausa e «In pausa fino al 12 novembre»; la serie mostra un piccolo lucchetto per dire che è congelata.
  - Nel menu della missione in pausa la prima azione diventa «Riprendi». Alla data di fine la missione torna nella sua categoria da sola e Oggi lo segnala con un avviso.

### 3.7 Archivio ed eliminazione

  - Il filtro Archiviate mostra le righe in testo tenue con la data di archiviazione e il pulsante Ripristina; la serie e la percentuale restano visibili come ricordo.
  - Elimina apre un dialogo: «Eliminare “Meditazione” e tutto il suo storico? Non si può annullare», con il pulsante Elimina nel colore pericolo e Annulla in evidenza. Per le missioni non archiviate il dialogo propone anche «Archivia invece».
  - ★ Le attività singole completate restano 7 giorni nel filtro Attività singole, in testo tenue, poi passano da sole tra le archiviate. In alternativa passano subito in archivio al completamento. Regola aggiunta anche all'analisi funzionale il 30/10.

### 3.8 Stati vuoti

  - Nessuna missione: il compagno, la frase «Nessuna missione, per ora» nel tono del tema, e i pulsanti Crea una missione e Usa un modello.
  - Filtro vuoto (es. nessuna archiviata): una frase sola, senza pulsanti.

### 3.9 Varianti per tema

  - Arcade: le categorie sono «World 1–4» con il nome della categoria accanto, le righe come una schermata di selezione livelli, percentuale come punteggio.
  - Fantasy: libro delle imprese, ogni categoria è un capitolo con capolettera ornata, divisori a filetto oro.
  - Cyberpunk: elenco come un database di contratti, serie e percentuale in colonne mono allineate, chip dei filtri come schede di terminale.
  - Lovecraft: indice del grimorio, categorie come «Libro I–IV», righe archiviate sbiadite come inchiostro vecchio.
  - Minimal: elenco pulito con divisori sottili, intestazioni di categoria in testo tenue maiuscolo.

### 3.10 Modalità Essenziale

  - La schermata non cambia: serie e percentuale restano, perché sono il cuore del tracciamento. Spariscono solo gli XP dal dettaglio della missione.

### 3.11 Accessibilità

  - Ogni riga si legge così: «Meditazione, ogni giorno, media, serie 12 giorni, 80% negli ultimi 30 giorni», più «in pausa fino al 12 novembre» se serve.
  - Le azioni dello scorrimento e del menu sono anche azioni del lettore di schermo; in modalità Riordina ogni riga ha «Sposta su» e «Sposta giù».
  - Con testo molto grande serie e percentuale vanno sotto il nome invece che a destra.

### 3.12 Scelte approvate il 30/10

1.  Missioni in pausa raggruppate in fondo (★) o nella loro categoria con un'etichetta.
2.  Nessuna spunta in Abitudini (★) o spunta sulle missioni previste oggi.
3.  Riordino con la modalità Riordina (★) o con pressione lunga e trascinamento.
4.  Elimina solo da menu ed editor (★) o anche nello scorrimento.
5.  Attività singole completate in archivio dopo 7 giorni (★) o subito.

## 4. Editor missione

Stato: approvata da Claudio il 30/10, con le scelte ★. Obiettivo di design: creare una missione scrivendo solo il nome e un tocco, con tutte le altre impostazioni a portata ma fuori dai piedi.

### 4.1 Forma e apertura

  - ★ Il \[+\] apre un foglio dal basso a mezza altezza con i campi base, il cursore già nel nome e la tastiera aperta. Toccando «Altre opzioni» o trascinando verso l'alto il foglio passa a tutta altezza. In alternativa una schermata intera, più ordinata ma più lenta da aprire e da chiudere.
  - Il foglio si apre da qualsiasi schermata; se è aperto dalla scheda di un boss, quel boss è già collegato.
  - In modifica lo stesso foglio si apre a tutta altezza, con il titolo «Modifica missione».

### 4.2 Struttura del foglio

  - Dall'alto: maniglia, titolo «Nuova missione» con a destra il collegamento «Usa un modello», campo del nome, tipo, difficoltà, statistica principale, «Altre opzioni».
  - In fondo una barra fissa, sempre sopra la tastiera: a sinistra l'anteprima delle ricompense, a destra il pulsante Salva.
  - ★ Il tasto Invio della tastiera salva: nome più Invio è un solo tocco, nome più Salva sono due, entro il limite dell'analisi.
  - Il nome usa il carattere del Titolo sezione del tema, su due righe al massimo, con un esempio in grigio nel lessico del tema (es. «Nuova impresa…»). Salva resta spento finché il nome è vuoto; oltre 60 caratteri compare un contatore.

### 4.3 Tipo e difficoltà

  - Tipo: interruttore a due posizioni, Abitudine (default) e Attività singola. Con Attività singola la riga Frequenza diventa Scadenza (data e ora facoltative).
  - Difficoltà: tre pulsanti affiancati con le tacche del tema, il nome e gli XP (Facile 10, Media 25, Difficile 50); Media è preselezionata.
  - Cambiando difficoltà in modifica compare sotto la riga «Vale dai prossimi completamenti».

### 4.4 Statistica principale e secondaria

  - ★ La statistica principale sta tra i campi base: una riga di 6 pulsanti con icona e nome nel lessico del tema, scorrevole se lo spazio non basta. È un tocco in più, ma fa crescere l'eroe, che è un elemento Must. In alternativa resta tra le Altre opzioni come nell'analisi, con l'invito sotto il nome.
  - Senza statistica scelta compare in testo tenue «Scegli una statistica: senza, questa missione non fa crescere l'eroe». I modelli arrivano con la statistica già scelta.
  - La secondaria sta nelle Altre opzioni: stessa riga di pulsanti, con la principale spenta, e la nota «riceve il 30% dei punti».

### 4.5 Altre opzioni

  - Sezione richiudibile con una riga per campo: icona, nome del campo e valore attuale a destra (es. «Frequenza · Ogni giorno»). Il tocco su una riga apre un piccolo foglio sopra l'editor; chiudendolo si torna all'editor con il valore aggiornato.
  - Ordine delle righe: Frequenza (o Scadenza), Obiettivo misurabile, Promemoria, Statistica secondaria, Boss collegato, Categoria e icona, Note.
  - In modifica la sezione è già aperta se almeno un campo avanzato ha un valore diverso dal default.

### 4.6 Frequenza

  - Elenco a scelta singola: Ogni giorno; Giorni della settimana; N volte a settimana; Ogni N giorni; Mensile; Annuale. Sotto l'opzione scelta compare il suo controllo.
  - Giorni della settimana: 7 cerchi con l'iniziale, a partire dal primo giorno impostato nelle Impostazioni. N volte a settimana: contatore da 1 a 6. Ogni N giorni: contatore da 2 a 30 e data di inizio. Mensile: griglia dei giorni 1–31 più «Ultimo giorno del mese». Annuale: giorno e mese.
  - ★ Le frequenze Should e Could che non entrano nella versione non compaiono affatto, invece di comparire spente con «presto».
  - Attività singola: Scadenza con data e ora facoltative; senza data l'attività resta in Oggi finché non è fatta.

### 4.7 Obiettivo misurabile

  - Interruttore a tre posizioni: Sì/No (default), Quantità, Durata.
  - Quantità: valore con tastiera numerica, unità da chip (L, ml, pagine, passi, km, volte, più una personalizzata) e incremento per tocco, proposto in automatico (es. 250 ml per 2 L) e modificabile.
  - Durata: minuti con chip rapidi 5, 10, 15, 30, 60 e un contatore; una nota ricorda che il timer si avvia da Oggi.

### 4.8 Promemoria

  - Riga «Nessun promemoria»; toccandola si aggiungono uno o più orari con il selettore d'ora di sistema, mostrati come chip eliminabili. Il promemoria segue i giorni della frequenza.
  - Per le attività singole con orario: chip di anticipo 0, 5, 15, 30 minuti.
  - Se il permesso di notifica è stato negato, la riga lo dice e porta alle Impostazioni, senza bloccare il salvataggio.

### 4.9 Boss collegato, categoria, icona e note

  - Boss collegato: elenco dei boss attivi con sprite e vita, più «Nessuno». Senza boss attivi: «Nessun boss attivo · Crea un obiettivo».
  - Categoria: Salute, Mente, Lavoro e studio, Casa, Nessuna. Icona: griglia con le icone delle categorie e un set di icone d'uso comune; il default è l'icona della categoria.
  - Note: campo libero su più righe, visibile poi nel dettaglio della missione.

### 4.10 Anteprima delle ricompense

  - Nella barra in fondo: «+25 XP · +5 monete · +20 Forza», con nomi e icone del tema. I numeri cambiano con un breve conteggio quando si cambiano difficoltà o statistica.
  - Valori base, senza moltiplicatore di serie, per non promettere XP che possono cambiare.

### 4.11 Usa un modello

  - Apre a tutta altezza la libreria: ricerca in alto, 4 schede per categoria, schede dei modelli con icona, nome, frequenza, difficoltà e statistica.
  - ★ Il tocco su un modello riempie l'editor senza salvare, così si può ritoccare prima di Salva. In alternativa il modello si aggiunge subito, più veloce ma senza revisione.

### 4.12 Modifica, uscita ed errori

  - In modifica, sotto i campi: «Archivia» (pulsante secondario) ed «Elimina» (testo nel colore pericolo, con dialogo che ricorda che lo storico si perde).
  - Chiudendo con modifiche non salvate (trascinamento in basso o tocco fuori) l'app chiede «Scartare le modifiche?»; senza modifiche il foglio si chiude subito.
  - Un nome uguale a una missione esistente mostra un avviso che non blocca il salvataggio.
  - Al salvataggio il foglio si chiude, la nuova missione compare in Oggi (se prevista oggi) con un breve risalto e l'avviso «Missione creata · Annulla».

### 4.13 Varianti per tema

  - Arcade: foglio come finestra di dialogo dei giochi a 8 bit con cornice pixel, cursore a blocco che lampeggia nel nome. Titolo «Nuovo stage», pulsante «START».
  - Fantasy: pergamena che si srotola dal basso, ornamento sul titolo. Titolo «Nuova impresa», pulsante «Accetta l'impresa».
  - Cyberpunk: pannello ad angoli tagliati con filo neon, campi come un terminale. Titolo «Nuovo contratto», pulsante «Firma il contratto».
  - Lovecraft: pagina di grimorio con doppio filetto, testo d'esempio in corsivo. Titolo «Nuovo rituale», pulsante «Incidi il rito».
  - Minimal: foglio chiaro o scuro con angoli 18, nessuna decorazione. Titolo «Nuova abitudine» o «Nuova attività», pulsante «Salva».

### 4.14 Modalità Essenziale

  - La riga Boss collegato diventa «Obiettivo collegato»; l'anteprima mostra solo gli XP, in piccolo, senza monete. Statistiche e tutti gli altri campi restano.

### 4.15 Accessibilità

  - Ordine di lettura: titolo, nome, tipo, difficoltà, statistica, Altre opzioni, anteprima, Salva.
  - Interruttori e pulsanti di difficoltà si leggono come gruppo con l'opzione scelta (es. «Difficoltà, Media, 25 XP, selezionata, 2 di 3»); i contatori si regolano anche con i gesti del lettore di schermo.
  - Con testo molto grande il foglio si apre subito a tutta altezza e i pulsanti di difficoltà vanno uno sotto l'altro.

### 4.16 Scelte approvate il 30/10

1.  Forma: foglio a mezza altezza che si espande (★) o schermata intera.
2.  Statistica principale tra i campi base (★) o tra le Altre opzioni.
3.  Invio della tastiera che salva (★) o solo il pulsante Salva.
4.  Il modello riempie l'editor (★) o si aggiunge subito.
5.  Frequenze non sviluppate nascoste (★) o visibili come «presto».

## 5. Obiettivi e boss

Stato: approvata da Claudio il 30/10, con le scelte ★. Obiettivo di design: far sentire ogni grande obiettivo come un nemico da battere, con il prossimo passo sempre in vista, e rendere la sconfitta leggera e la vittoria memorabile.

### 5.1 Struttura della schermata

  - Intestazione con il nome del tema (Boss, Nemesi, Firewall, Orrori, Grandi obiettivi), il contatore «2 di 3 attivi» e il pulsante «Nuovo obiettivo»; nel menu «Altro» (⋯) ci sono gli obiettivi archiviati.
  - I boss attivi sono schede grandi, una sotto l'altra: sprite del boss (96), nome, barra della vita con numero, «Passi 3 di 8», giorni alla scadenza e prossimo passo con il suo controllo.
  - I posti liberi fino a 3 sono schede tratteggiate «+ Nuovo obiettivo». Con 3 boss attivi «Nuovo obiettivo» resta visibile ma spiega «Massimo 3 boss: sconfiggine uno o archivialo».
  - ★ Sotto i boss, un'anteprima della Sala dei trofei con gli ultimi 3 trofei e «Vedi tutti». In alternativa la Sala si apre solo dal Profilo.

### 5.2 Creazione di un boss

  - ★ Una sola schermata a tutta altezza divisa in blocchi, nello stesso stile dell'editor missione. In alternativa una procedura guidata in 3 passi, più accompagnata ma più lenta.
  - Blocchi, dall'alto: nome dell'obiettivo; passi; difficoltà; scadenza facoltativa; statistica facoltativa; missioni collegate.
  - Passi: elenco con il campo «Aggiungi un passo»; Invio aggiunge il passo e apre subito il successivo; maniglie per riordinare; contatore «5 di 20», con un minimo di 2.
  - Difficoltà: tre pulsanti con il moltiplicatore della ricompensa (×1, ×1,5, ×2). Cambiando difficoltà cambia anche lo sprite del boss in anteprima in cima alla schermata, perché ogni tema ha un boss per difficoltà.
  - Statistica: la stessa riga di 6 pulsanti dell'editor, con la nota «+10 punti a ogni passo».
  - Missioni collegate: selezione multipla tra le abitudini attive, con il danno per completamento accanto a ognuna (es. «Meditazione · 5 danni»). Una missione già collegata a un altro boss mostra quale e, se scelta, chiede di spostarla.
  - Barra fissa in fondo: anteprima «Vita 160 · Ricompensa 120 XP e 24 monete» e il pulsante nel lessico del tema (Arcade «FIGHT\!», Fantasy «Sfida la Nemesi», Cyberpunk «Avvia l'intrusione», Lovecraft «Evoca l'Orrore», Minimal «Crea obiettivo»).

### 5.3 Scheda del boss

  - In cima l'arena: sprite grande (128) animato a riposo, nome, barra della vita con numero, chip con passi, scadenza e difficoltà.
  - Passi: elenco con spunta; i fatti in testo tenue con la data, il prossimo in evidenza. Si completano con un tocco, con avviso e Annulla.
  - Missioni collegate: righe con il danno per completamento e i danni già inflitti in totale; il tocco apre il dettaglio della missione.
  - Menu «Altro»: Modifica (stessa schermata della creazione), Nuova scadenza, Archivia, Elimina con dialogo.
  - ★ La vita che non può scendere prima dell'ultimo passo (10 per ogni passo rimasto) si vede nella barra come un tratto a righe, con la nota «Serve l'ultimo passo per il colpo finale». Così le missioni collegate non sembrano smettere di funzionare quando la barra si ferma. In alternativa la regola resta invisibile.

### 5.4 Colpi e danno

  - Completare un passo o una missione collegata fa tremare lo sprite, fa salire il numero del danno (es. «−20») e scendere la barra; lo stesso succede sulla scheda del boss in Oggi.
  - Con Riduci movimento niente tremolio: restano il numero e la barra che scende.

### 5.5 Vittoria

  - Schermata intera, saltabile: il boss viene sconfitto con l'animazione del tema, appare «Vittoria\!» nel lessico del tema, XP e monete salgono con un conteggio, il trofeo vola verso la Sala dei trofei.
  - Pulsanti «Vedi il trofeo» e «Continua»; tornando su Obiettivi il posto liberato propone «+ Nuovo obiettivo».
  - Animazione per tema: il boss esplode in pixel (Arcade), cade in polvere d'oro (Fantasy), il firewall va in crash con un glitch (Cyberpunk), l'Orrore svanisce nella nebbia (Lovecraft), l'anello si chiude con coriandoli sobri (Minimal).
  - ★ Sotto il conteggio di XP e monete compare la riga dello scudo: sprite dello scudo (16×16 a 3×), nome nel lessico del tema e «+1», che poi vola verso l'icona delle monete nella scheda dell'eroe come gli altri guadagni. In alternativa lo scudo si nomina solo nel testo, senza sprite.
  - Con 2 scudi già posseduti lo sprite compare spento e si trasforma in «+100 monete», con la riga «Hai già 2 scudi: ricevi 100 monete» e le monete che si aggiungono al conteggio.
  - Anche la quest di partenza dà lo scudo (Claudio, 12/11).
  - Lettore di schermo: «Vittoria. Più 120 XP, più 24 monete, più uno scudo della serie» oppure «… più 100 monete al posto dello scudo, ne hai già 2». Con Riduci movimento lo scudo compare senza volo.


### 5.6 Scadenza vicina e mancata

  - A 3 giorni dalla scadenza il chip della scadenza passa al colore pericolo con un'icona, e sulla scheda compare «Mancano 3 giorni»; la notifica è definita nella sezione Promemoria.
  - ★ A scadenza mancata, alla prima apertura si apre un foglio dal basso, non una schermata intera, per non far sentire l'errore più grande di quello che è. In alternativa una schermata intera, più teatrale.
  - Nel foglio: il boss che ghigna, la sua battuta nel tono del tema, le monete rubate che volano via (es. «−34 monete»), la frase «I tuoi 5 passi restano», il pulsante principale «Fissa una nuova scadenza» e, sotto, «Archivia l'obiettivo» come testo.
  - Esempi di battuta: Arcade «TIME OVER\! Grazie per i gettoni»; Fantasy «La Nemesi ride e ti sottrae 34 oro»; Cyberpunk «Intrusione scaduta. 34 crediti trasferiti»; Lovecraft «L'Orrore si nutre della tua esitazione: 34 reliquie perdute»; Minimal, senza scherno, «Scadenza passata: 34 monete perse».

### 5.7 Sala dei trofei

  - Griglia a 3 colonne: ogni trofeo è lo sprite del boss in miniatura su un piedistallo nella veste del tema, con nome, data della vittoria e giorni impiegati. Ordine dal più recente.
  - Il tocco su un trofeo apre il dettaglio: passi, date di inizio e fine, ricompense ricevute.
  - Sala vuota: un piedistallo vuoto e «Il primo trofeo ti aspetta».

### 5.8 Main Quest e catene (Could)

  - Main Quest: dal menu della scheda «Fissa come Main Quest»; il boss prende una corona e compare in cima a Oggi, sopra il Piano del giorno.
  - Catene: i boss di una catena sono uniti da una linea; il boss successivo resta visibile ma bloccato con un lucchetto fino alla vittoria del precedente.
  - Entrambe si disegnano solo se entrano nella versione.

### 5.9 Varianti per tema

  - Arcade: arena da picchiaduro, barra della vita in alto a tutta larghezza con il nome del boss, passi come livelli del boss («STAGE 3/8»).
  - Fantasy: scheda come un manifesto di taglia o una pagina di bestiario, con sigillo di ceralacca sui passi fatti.
  - Cyberpunk: il boss è un firewall da forzare, la vita è «integrità» in percentuale, i passi sono «nodi» da violare.
  - Lovecraft: l'Orrore è nascosto da una nebbia che si dirada a ogni passo, così la creatura si vede tutta solo verso la fine.
  - ★ Minimal: niente creatura; il grande obiettivo è un anello di avanzamento grande con l'icona della categoria e la percentuale al centro. In alternativa una piccola figura vettoriale nello stile di Goccia.

### 5.10 Modalità Essenziale

  - Obiettivi diventa un elenco di obiettivi divisi in passi: niente sprite, vita, danni e monete, al loro posto una barra di avanzamento con i passi fatti.
  - A scadenza mancata nessuna moneta viene rubata, perché in Essenziale le penalità sono spente: resta solo la proposta di una nuova scadenza.

### 5.11 Accessibilità

  - Ogni scheda si legge così: «Maratona, boss medio, vita 100 su 160, passi 3 di 8, scadenza tra 6 giorni».
  - I colpi si annunciano a voce («20 danni, vita 80 su 160»); la vittoria si annuncia e si chiude con un gesto.
  - Il tratto a righe della vita protetta ha anche la nota scritta, non solo il disegno.

### 5.12 Scelte approvate il 30/10

1.  Anteprima della Sala dei trofei sotto i boss (★) o Sala solo dal Profilo.
2.  Creazione in una schermata sola (★) o procedura in 3 passi.
3.  Vita protetta visibile a righe (★) o invisibile.
4.  Scadenza mancata in un foglio dal basso (★) o a schermo intero.
5.  Minimal con anello di avanzamento (★) o con una piccola figura vettoriale.

## 6. Compagno

Stato: approvata da Claudio il 30/10, con le scelte ★ e le modifiche su umori ed esultanza. Obiettivo di design: un piccolo essere a cui affezionarsi, che cresce con la costanza, mostra l'umore in modo chiaro e non fa mai sentire in colpa.

### 6.1 Accesso

  - La scheda del compagno si apre toccando il compagno nella scheda dell'eroe in Oggi e dal Profilo. È una schermata intera con il pulsante Indietro.

### 6.2 Struttura della scheda

  - In alto l'habitat del tema, alto circa metà schermo, con il compagno grande al centro (sprite 32×32 mostrato a 6×) e animato a riposo.
  - Sotto: il nome con una matita per cambiarlo; lo stadio (es. «Cucciolo · stadio 2 di 3»); la barra della crescita con «87 di 150 missioni» e la frase «Ancora 63 missioni per diventare adulto».
  - Poi la scheda dell'umore e, se i regali entrano nella versione, la riga «Fai un regalo».
  - I cosmetici (fase successiva) avranno qui una riga «Aspetto»; per ora non si disegnano.

### 6.3 Umore

  - Tre umori, ognuno con posa, espressione e parola: felice (sorride), normale (posa di riposo), triste (seduto, con la faccia triste). Deciso da Claudio il 30/10. Il compagno non sembra mai malato o in pericolo.
  - ★ La scheda dell'umore spiega il perché e come cambiarlo: «Negli ultimi 3 giorni hai completato il 55% delle missioni» e, se è triste, «Completa una missione oggi e tornerà felice». In alternativa solo la parola, più misteriosa ma meno chiara.
  - Il tono è sempre gentile: il compagno triste chiede compagnia, non rimprovera.

### 6.4 Tocco sul compagno

  - ★ Toccando il compagno, nella scheda o in Oggi, fa una piccola reazione (salto, giro, verso se i suoni sono attivi) e compare un fumetto con una frase breve nel tono del tema e del suo umore. In alternativa nessuna reazione.
  - Le frasi non parlano mai di missioni mancate; al massimo invitano a farne una.

### 6.5 Uovo e schiusa

  - Prima del primo completamento c'è l'uovo, che dondola ogni tanto, con la frase «Completa la tua prima missione per farlo schiudere».
  - Al primo completamento parte il momento a schermo intero della schiusa: l'uovo si crepa, si apre e il cucciolo saluta. Poi si sceglie o si conferma il nome.

### 6.6 Evoluzione

  - Al passaggio da cucciolo ad adulto parte il momento a schermo intero dell'evoluzione, saltabile, con «Blob è cresciuto\!» nel lessico del tema. Se l'animazione completa (Could) non entra nella versione, resta una dissolvenza tra i due sprite con la stessa frase.
  - In Oggi compare un avviso «… è diventato adulto», come chiede l'analisi.

### 6.7 Nome

  - Il tocco sulla matita trasforma il nome in un campo modificabile, fino a 20 caratteri; Invio conferma. Il nome di default è quello del tema (Blob, Brace, BIT-0, Glub, Goccia).
  - Il nome compare nei fumetti e, se la firma dei promemoria entra nella versione, nelle notifiche.

### 6.8 Regali (Could)

  - «Fai un regalo» apre un foglio con i regali posseduti (biscotto, caramella, palla) e la quantità; se non ce ne sono, «Compra nel Negozio».
  - Donando un regalo il compagno esulta, qualunque sia il suo umore: fa la faccia felice e saltella, con un effetto del tema intorno, poi mangia il regalo o ci gioca, per circa 2 secondi in tutto. L'umore sale di un livello con l'etichetta «Felice fino a domani», poi il fumetto ricorda le missioni (es. «Grazie, Claudio\! Ma non dimenticarti di prenderti cura di te stesso. Completa i task di oggi\!»).
  - Effetto dell'esultanza per tema: cuoricini pixel che salgono (Arcade), scintille dorate (Fantasy), coriandoli neon ciano e magenta (Cyberpunk), lucciole bioluminescenti (Lovecraft), un piccolo cuore e pochi coriandoli (Minimal). Con Riduci movimento restano la faccia felice e un solo cuore, senza saltelli.
  - ★ Se il compagno è già felice il regalo si può dare lo stesso: esulta comunque, con la nota «È già felicissimo: il regalo non cambia l'umore». In alternativa il pulsante è spento.

### 6.9 Cambio di tema

  - Cambiando tema il compagno cambia aspetto ma conserva nome, stadio, crescita e umore. Se il nome è ancora quello di default, prende il nome del nuovo tema; se l'utente l'ha cambiato, lo tiene.

### 6.10 Varianti per tema

  - ★ Ogni tema ha il suo compagno e il suo habitat. Arcade: Pixel, una faccina pixel che cresce di risoluzione (8, 16, 32 px), in un livello a piattaforme. Fantasy: Rocky, golem di muschio, accanto a un caminetto. Cyberpunk: Glitchy, axolotl neon, in una vasca illuminata dal basso. Lovecraft: Lumin, falena dai mille occhi, su uno scrittoio con la lampada a olio. Minimal: Cloudy, una nuvola, su un cerchio morbido senza decorazioni. Gli stadi sono Uovo, Cucciolo e Adulto in tutti i temi. Disegni in design/consegne/3/ e design/consegne/4/.
  - Gli habitat sono fermi o quasi (una fiamma, una luce, l'acqua) e si spengono con Riduci movimento.

### 6.11 Modalità Essenziale

  - Il compagno resta, con la stessa scheda; sparisce solo la riga dei regali, perché il Negozio è nascosto.

### 6.12 Accessibilità

  - Lo sprite ha una descrizione per il lettore di schermo («Blob, cucciolo, felice»); i fumetti si leggono come testo.
  - Umore e crescita sono sempre scritti, non solo disegnati.

### 6.13 Scelte approvate il 30/10

1.  Spiegazione dell'umore con la percentuale (★) o solo la parola.
2.  Reazione e fumetto al tocco (★) o nessuna reazione.
3.  Regalo possibile anche quando è già felice (★) o pulsante spento.
4.  Nomi degli stadi diversi per tema (★) o uguali ovunque.
5.  Habitat di sfondo per tema (★) o sfondo neutro.

### 6.14 Racconto della giornata (Should, 12/11)

  - **Fumetto del mattino.** Alla prima apertura della giornata di gioco, in Oggi, sotto la scheda dell'eroe e prima del Piano del giorno, il compagno (nella posa del suo umore) parla con un fumetto di al massimo due frasi: la prima su ieri, con i numeri in grassetto (es. «Ieri **4 missioni su 5** e **20 danni** a Glitch-Lord!»); la seconda è un incoraggiamento per oggi. Il fumetto entra con la stessa animazione del tocco sul compagno (6.4) e si chiude con un tocco ovunque sul fumetto o con la X; non torna fino a domani. Toccare il compagno dopo riporta le frasi normali di 6.4.
  - **Situazioni**, in ordine di priorità quando ne valgono più d'una: Ritorno dalla pausa, Ritorno dopo assenza (2 o più giorni senza aprire l'app), Serie record (ieri la serie dell'eroe ha superato il suo massimo), Boss sconfitto ieri, Giornata piena, Giornata parziale, Giornata vuota, Giorno di riposo. Serie record scatta solo il giorno in cui la serie supera per la prima volta il record che c'era all'inizio della serie, e solo se quel record era di almeno 3 giorni (12/11). Per ogni situazione c'è un insieme di frasi su ieri; l'incoraggiamento per oggi è un insieme a parte, uguale per tutte le situazioni. L'app sceglie a caso evitando le ultime 3 frasi usate per la stessa situazione e voce; se sono recenti tutte, usa quella usata meno di recente (12/11).
  - **Tono.** Segue il tema (lessico e voce del compagno: Pixel, Rocky, Glitchy, Lumin, Cloudy) e l'umore, che si vede dalla posa dello sprite; le frasi del mattino hanno una variante per umore (felice, normale, triste), decisa da Claudio il 12/11; quelle della sera no. Giornata vuota e Ritorno dopo assenza incoraggiano e non rimproverano mai, come in 6.4.
  - **Quando non compare:** il primo giorno d'uso (non c'è un ieri), durante la pausa generale, se ieri l'app non prevedeva nulla e non era giorno di riposo (nessuna missione ancora creata).
  - **Riepilogo serale.** La notifica di 11.5 è firmata dal compagno: titolo «Cloudy» (nome del compagno) e testo con la sua voce, es. «Ti mancano 2 missioni, c'è ancora tempo». Tre situazioni: Tutto fatto, Mancano alcune missioni (con i nomi, come in 11.5), Nessuna ancora fatta.
  - **Modalità Essenziale:** il fumetto resta, senza danni al boss né monete nel testo; le situazioni Boss sconfitto non si usano.
  - **Accessibilità:** il fumetto si legge «Cloudy dice: …» dopo la scheda dell'eroe, senza prendere il fuoco; con Riduci movimento compare con una dissolvenza.
  - I testi da scrivere sono elencati in `racconto-compagno-testi.md` (in `design/` nella cartella di progetto, in `docs/riferimenti/` nel repo).

### 6.15 Scelte da approvare (12/11)

1.  ~~Testi uguali per ogni umore~~: una variante per umore nelle frasi del mattino (Claudio, 12/11).


## 7. Negozio e inventario

Stato: approvata da Claudio il 30/10, con le scelte ★. Obiettivo di design: spendere le monete in modo chiaro e senza sorprese, con gli aiuti in primo piano e un negozio che sembri parte del mondo del tema.

### 7.1 Accesso

  - Dal Profilo, con la riga Negozio e inventario.
  - ★ Anche il tocco sul chip delle monete nella scheda dell'eroe in Oggi apre il Negozio. In alternativa il chip non è toccabile.

### 7.2 Struttura della schermata

  - In cima il saldo grande con l'icona della moneta del tema e una frase di benvenuto nel tono del tema.
  - ★ Negozio e Inventario stanno nella stessa schermata come due schede in alto. In alternativa due schermate separate, ognuna con la sua riga nel Profilo.
  - La scheda Negozio ha tre gruppi: Aiuti (pozione, scudo della serie), Le tue ricompense (Should dal 12/11) e Regali per il compagno (se entrano nella versione). ★ Le ricompense vengono subito dopo gli Aiuti, perché sono Should e sono il motivo principale per spendere.

### 7.3 Scheda dell'articolo

  - Griglia a 2 colonne. Ogni scheda: sprite dell'oggetto (16×16 mostrato a 4×), nome nel lessico del tema, una riga di descrizione («Ridà 10 vita»), prezzo con l'icona della moneta e «Ne hai 1».
  - Monete insufficienti: il prezzo è in testo tenue con «Ti mancano 20 monete»; la scheda si apre ma non si compra.
  - Scudo al massimo: la scheda dice «Ne hai già 2, il massimo» e non si compra.

### 7.4 Acquisto

  - ★ Il tocco su una scheda apre un foglio di conferma con sprite, descrizione, prezzo, saldo dopo l'acquisto e il pulsante «Compra per 50». In alternativa l'acquisto avviene con un tocco e un avviso con Annulla, più veloce ma più facile da sbagliare.
  - Dopo l'acquisto le monete scendono con un conteggio e l'oggetto vola verso la scheda Inventario. Per la pozione il foglio propone anche «Usa subito».

### 7.5 Inventario

  - Griglia degli oggetti posseduti con la quantità in un piccolo bollino.
  - Il tocco apre un foglio con descrizione e azione: la pozione ha Usa (la barra della vita si riempie con un'animazione); se la vita è già piena il pulsante è spento con «La vita è già al massimo». Lo scudo non ha pulsante: «Si usa da solo nel primo giorno mancato». I regali hanno «Dona a Blob», che apre l'animazione dell'esultanza del compagno.
  - Inventario vuoto: lo sprite di uno zaino vuoto e «Niente qui: guarda nel Negozio».

### 7.6 Ricompense personali (Should dal 12/11)

  - Nel gruppo Le tue ricompense: le ricompense create dall'utente, in ordine di prezzo, e per ultima la scheda tratteggiata «+ Nuova ricompensa». Senza ricompense il gruppo mostra solo questa scheda con l'esempio «Es. Un episodio della tua serie».
  - Scheda della ricompensa nella stessa griglia degli articoli: icona a linea `icona-regalo` (lotto 1; i regali del compagno usano invece gli sprite del lotto 8) con da 1 a 4 pallini per l'entità, nome (al massimo 2 righe), entità, prezzo con l'icona della moneta (solo il prezzo, senza giorni: Claudio, 12/11). Monete insufficienti: «Ti mancano 40 monete», come per gli articoli.
  - Creazione in un foglio: nome (obbligatorio, fino a 40 caratteri) ed entità con 4 chip (Piccola, Media, Grande, Epica), ognuno con il suo prezzo. Il prezzo non si modifica a mano: viene dalla configurazione (prezzi approvati il 12/11, scelta minore 22 di `CLAUDE.md`).
  - Riscatto: il tocco apre un foglio di conferma con nome, prezzo, saldo dopo e «Riscatta per 250»; dopo, le monete scendono con un conteggio, una breve festa del tema (1 secondo, la stessa del completamento in grande) e l'avviso «Goditi: Un episodio della tua serie». Il riscatto va nel registro. La ricompensa resta disponibile per i riscatti successivi.
  - Menu della scheda (pressione lunga o «…»): Modifica (nome ed entità; il nuovo prezzo vale dai riscatti successivi) ed Elimina con dialogo; i riscatti passati restano nel registro.
  - Nessun limite al numero di ricompense; la griglia carica le schede man mano che si scorre (Claudio, 12/11).
  - Le ricompense non vanno nell'Inventario: si riscattano e basta.
  - Modalità Essenziale: nascoste con il Negozio.
  - Lettore di schermo: «Un episodio della tua serie, ricompensa media, 250 monete», con «ti mancano 40 monete» se serve.

### 7.7 Nomi per tema

  - ★ Negozio e inventario hanno un nome proprio in ogni tema. Arcade: Shop e Items. Fantasy: Bottega e Bisaccia. Cyberpunk: Mercato nero e Cache. Lovecraft: Antiquario e Reliquiario. Minimal: Negozio e Inventario. In alternativa Negozio e Inventario ovunque.

### 7.8 Varianti per tema

  - Arcade: vetrina pixel con il benvenuto «WELCOME\!», prezzi come punteggi, suono di cassa se i suoni sono attivi.
  - Fantasy: bancone di legno, prezzi scritti su cartellini di pergamena, bisaccia di cuoio per l'inventario.
  - Cyberpunk: terminale di un distributore con prezzi al neon e oggetti in teche luminose.
  - Lovecraft: scaffali polverosi a lume di candela, oggetti con etichette scritte a mano.
  - Minimal: griglia di schede pulite, nessuna decorazione.

### 7.9 Modalità Essenziale

  - Il Negozio è nascosto, come deciso nelle basi comuni, e il chip delle monete in Oggi sparisce.
  - ★ Gli scudi già posseduti continuano a proteggere la serie, perché la serie resta anche in Essenziale. In alternativa sono sospesi finché si torna a Completo.

### 7.10 Accessibilità

  - Ogni scheda si legge così: «Pozione, ridà 10 vita, 50 monete, ne hai 1», con «ti mancano 20 monete» se serve.
  - Il saldo si annuncia dopo ogni acquisto o uso.
  - Con testo molto grande la griglia passa a una colonna.

### 7.11 Scelte da approvare

1.  Tocco sul chip delle monete in Oggi che apre il Negozio (★) o chip non toccabile.
2.  Negozio e Inventario a schede nella stessa schermata (★) o separati.
3.  Acquisto con foglio di conferma (★) o con un tocco e Annulla.
4.  Nomi propri per tema di negozio e inventario (★) o uguali ovunque.
5.  In Essenziale gli scudi posseduti continuano a funzionare (★) o sono sospesi.
6.  Ricompense subito dopo gli Aiuti (approvata il 12/11).
7.  Nessun limite di ricompense, con caricamento allo scorrimento (Claudio, 12/11).


## 8. Statistiche

Stato: approvata da Claudio il 30/10, con le scelte ★. Obiettivo di design: far vedere il progresso in modo onesto e incoraggiante, con la costanza a colpo d'occhio e lo storico completo a due tocchi.

### 8.1 Struttura della schermata

  - ★ Due schede in alto: Panoramica e Registro. In alternativa il Registro è una schermata separata, aperta da una riga in fondo alla Panoramica.
  - La Panoramica, dall'alto: riepilogo, riepilogo settimanale (quando c'è), heatmap, andamento delle missioni, andamento delle statistiche (se entra nella versione).
  - Sopra i 840 di larghezza le schede si dispongono su due colonne, come già deciso nelle basi comuni.

### 8.2 Riepilogo in cima

  - Quattro riquadri in una griglia 2×2: serie attuale con l'icona del tema, record della serie, missioni completate questa settimana, percentuale degli ultimi 30 giorni con un piccolo anello.
  - Ogni riquadro ha il numero grande e sotto una riga di confronto in tono positivo, per esempio «+3 rispetto alla settimana scorsa»; se il confronto è negativo la riga non compare, per non far sentire in colpa.

### 8.3 Heatmap

  - ★ Striscia orizzontale a settimane, come un calendario a colonne: si vedono gli ultimi 5 mesi e si scorre a sinistra fino a 12 mesi, con l'oggi sempre a destra. In alternativa 12 piccoli calendari mensili su 3 colonne, che mostrano tutto l'anno senza scorrere ma con celle più piccole.
  - ★ Quattro livelli di colore: nessuna missione fatta, meno della metà, almeno la metà, tutte. In alternativa una scala continua, più precisa ma più difficile da leggere.
  - Un giorno senza missioni previste è una cella vuota con il solo bordo tenue, diversa dal giorno a zero. Le missioni saltate e in pausa non contano nel totale del giorno.
  - Celle quadrate di almeno 14 con 3 di spazio; sotto la striscia una piccola legenda con i quattro livelli.
  - Il tocco su un giorno apre un foglio dal basso con data, percentuale e l'elenco delle missioni del giorno (fatta, mancata, saltata); dagli ultimi 7 giorni si può aggiungere un completamento dimenticato.
  - Con «Colori per daltonici» la heatmap usa la scala blu–arancio delle basi comuni; in ogni caso la cella di oggi ha un contorno e il giorno toccato è annunciato con la percentuale.

### 8.4 Andamento delle missioni

  - Elenco delle missioni attive con nome, serie e una piccola barra della percentuale nel periodo scelto, ordinate dalla meno costante, così si vede subito su cosa lavorare.
  - Sopra l'elenco un selettore a tre segmenti: Settimana, Mese, Anno. Vale per l'elenco e per il dettaglio della missione; la heatmap resta annuale.
  - Il tocco su una riga apre il dettaglio della missione.

### 8.5 Dettaglio della missione

  - ★ Si apre a schermata intera, da Statistiche e da Abitudini, con il pulsante Modifica in alto a destra. In alternativa un foglio dal basso, più rapido ma con meno spazio per i grafici.
  - In cima: icona, nome, frequenza e difficoltà; poi tre riquadri con serie attuale, record e percentuale nel periodo.
  - Grafico a colonne della percentuale per settimana (periodo Mese) o per mese (periodo Anno).
  - Per le missioni misurabili un secondo grafico a colonne con il valore di ogni giorno (es. litri) e una linea tratteggiata all'altezza dell'obiettivo.
  - In fondo lo storico della missione, cioè le sue voci del Registro, e le note.
  - I grafici hanno sempre gli assi con i numeri, e il tocco su una colonna mostra il valore esatto.

### 8.6 Registro

  - Elenco cronologico raggruppato per giorno, con intestazioni come «Oggi», «Ieri», «Lunedì 27 ottobre».
  - Ogni voce ha l'icona del tipo (completamento, salto, boss danneggiato o vinto, oggetto usato, ricompensa riscattata, livello, badge), il testo nel lessico del tema e a destra quello che ha dato, per esempio «+20 XP · +5 monete».
  - Filtri a chip in cima: Tutto, Completamenti, Salti, Boss, Oggetti; un pulsante Filtra apre un foglio per scegliere missione e intervallo di date.
  - Il pulsante «+ Completamento dimenticato» apre un foglio con le missioni previste negli ultimi 7 giorni e non fatte; la conferma spiega in una riga che non restituisce vita e non ripara una serie già spezzata.
  - Un completamento si annulla dal menu della sua voce, con conferma.

### 8.7 Riepilogo settimanale (Could)

  - Una scheda con titolo nel tono del tema (es. «Cronaca della settimana» in Fantasy), con al massimo quattro righe: missione più costante, danni ai boss, livelli e punti statistica guadagnati, record battuti.
  - Solo successi: se la settimana è andata male la scheda dice cosa è andato bene e chiude con una frase di incoraggiamento del compagno.
  - ★ La scheda della settimana resta in cima alla Panoramica dalla domenica sera alla domenica successiva; le precedenti si trovano nel Registro. In alternativa resta solo nel Registro.
  - La notifica della domenica apre direttamente questa scheda.

### 8.8 Andamento delle statistiche (Could)

  - Un grafico a linee per una statistica alla volta, scelta con chip che riportano icona e nome nel lessico del tema; la linea mostra il livello mese per mese.
  - Sotto il grafico una frase come «Forza: da 3 a 7 negli ultimi 3 mesi».
  - Le linee usano il colore primario del tema, come deciso nelle basi comuni per le statistiche dell'eroe.

### 8.9 Stati vuoti

  - Primi giorni: la heatmap mostra le celle vuote con la frase «Ogni giorno completato si colora qui» e il riepilogo mostra 0 senza righe di confronto.
  - Registro vuoto: lo sprite del compagno con un libro aperto e «La tua storia comincia con la prima missione».

### 8.10 Varianti per tema

  - Arcade: heatmap come una griglia di pixel che si accendono, riepilogo come tabellone dei punteggi «HIGH SCORE», registro come elenco di righe di gioco.
  - Fantasy: heatmap come un calendario miniato con celle color oro, registro come cronaca scritta a mano su pergamena.
  - Cyberpunk: heatmap come una matrice di LED al neon, grafici con griglia sottile e valori in mono, registro come log di sistema con data e ora.
  - Lovecraft: heatmap come macchie d'inchiostro più o meno dense, registro come pagine di un diario dell'investigatore.
  - Minimal: celle con angoli arrotondati nella scala del colore primario, grafici puliti senza decorazioni.
  - In tutti i temi la forma dei dati resta la stessa (celle, colonne, linee), per non sacrificare la leggibilità; il tema cambia cornici, colori e caratteri.

### 8.11 Modalità Essenziale

  - La schermata resta quasi uguale, perché le statistiche sono il cuore del tracciamento.
  - Il Registro nasconde le voci di vita, boss, monete e negozio, e le voci di completamento mostrano solo gli XP in piccolo.
  - Il riepilogo settimanale tiene missione più costante e record, senza danni ai boss.

### 8.12 Accessibilità

  - La heatmap si legge per settimana: «Settimana del 20 ottobre: 5 giorni su 7 con tutte le missioni fatte»; con il lettore di schermo si può scendere al singolo giorno.
  - Ogni grafico ha una descrizione testuale con i valori principali e una tabella dei valori consultabile.
  - Con testo molto grande il riepilogo passa a una colonna e i grafici diventano elenchi di valori.

### 8.13 Scelte da approvare

1.  Panoramica e Registro come due schede (★) o Registro in una schermata separata.
2.  Heatmap a striscia che scorre fino a 12 mesi (★) o 12 piccoli calendari mensili.
3.  Heatmap a quattro livelli di colore (★) o a scala continua.
4.  Dettaglio della missione a schermata intera (★) o in un foglio dal basso.
5.  Riepilogo settimanale in cima alla Panoramica per una settimana (★) o solo nel Registro.

## 9. Profilo e progressione

Stato: approvata da Claudio il 30/10, con le scelte ★ e le modifiche su nomi Lovecraft e ritratto. Obiettivo di design: un colpo d'occhio su chi è l'eroe e come sta crescendo, con la scheda del personaggio come pezzo forte e i collegamenti a tutto il resto.

### 9.1 Struttura della schermata

  - Dall'alto: intestazione dell'eroe, scheda del personaggio, badge, collegamenti. In alto a destra l'ingranaggio delle Impostazioni.
  - ★ Le Impostazioni si raggiungono sia dall'ingranaggio in alto sia da una riga in fondo, perché molti la cercano in un punto e molti nell'altro. In alternativa solo la riga in fondo.

### 9.2 Intestazione dell'eroe

  - ★ L'eroe è rappresentato da un emblema del tema con l'iniziale del nome, non da un ritratto: Arcade uno stemma pixel, Fantasy uno scudo araldico, Cyberpunk un badge d'identità, Lovecraft un sigillo di cera, Minimal un cerchio. Non obbliga a scegliere un aspetto o un genere e non richiede altri sprite. In una versione successiva l'utente potrà sostituire l'emblema con uno sprite personalizzato come ritratto (idea aggiunta all'analisi funzionale il 30/10); il riquadro dell'emblema è già pensato per accoglierlo.
  - Accanto all'emblema: nome con la matita per cambiarlo (fino a 24 caratteri), titolo, livello grande e barra dell'esperienza con «320 di 500 XP al livello 8».
  - Sotto, una riga di tre numeri: serie attuale, missioni completate in tutto, boss sconfitti.

### 9.3 Titolo

  - Il titolo cambia ogni 5 livelli e si vede sotto il nome; quando cambia, il momento della salita di livello mostra anche «Nuovo titolo: Cavaliere».
  - I titoli sono 11 per tema (livelli 1, 5, 10… 50). Esempi di partenza: Arcade Newbie, Player, Pro; Fantasy Scudiero, Cavaliere, Paladino; Cyberpunk Ragazzo di strada, Runner, Netrunner; Lovecraft Curioso, Studioso, Investigatore; Minimal Principiante, Costante, Esperto. L'elenco completo si propone a parte, quando approvi questa sezione.

### 9.4 Scheda del personaggio

  - ★ Griglia di 6 riquadri, 2 per riga: icona e nome della statistica nel lessico del tema, livello grande («Lv 4»), barra verso il livello successivo e, se c'è, la freccia di forma. In alternativa un elenco a righe, più leggibile con testo grande ma meno da «scheda».
  - ★ La freccia ↓ è in testo tenue, non nel colore pericolo: segnala, non punisce. La ↑ usa il colore fatto. Nei primi 30 giorni la freccia non c'è.
  - Al livello 10, il massimo attuale, il riquadro mostra «Max» e la barra piena con un piccolo brillio.
  - All'inizio tutte le statistiche sono a 0: ogni riquadro ha la barra vuota e la frase «Completa missioni di questo tipo».

### 9.5 Dettaglio di una statistica

  - Il tocco su un riquadro apre un foglio dal basso: livello, punti (es. «340 di 500»), «Mancano 160 punti al livello 5», gli ultimi guadagni (es. «+20 Corsa, ieri») e le missioni che la alimentano.
  - Se i badge delle statistiche (Could) entrano nella versione, in fondo al foglio ci sono i tre badge della statistica, ai livelli 3, 6 e 10.

### 9.6 Badge

  - Nel Profilo una riga con titolo e contatore («Badge · 12 di 38»), gli ultimi badge sbloccati e «Vedi tutti».
  - «Vedi tutti» apre una griglia a 3 colonne: i badge sbloccati sono a colori con la data; quelli bloccati sono sagome in testo tenue con la condizione e l'avanzamento (es. «Serie di 30 giorni · 23 di 30»).
  - Il tocco su un badge apre il dettaglio con condizione, data e monete bonus ricevute. Lo sblocco è un momento a schermo intero, già previsto nelle basi comuni, con le monete bonus.
  - Forma dei badge per tema: medaglia pixel (Arcade), sigillo di ceralacca (Fantasy), toppa o chip (Cyberpunk), sigillo antico (Lovecraft), cerchio con icona (Minimal).

### 9.7 Collegamenti

  - Righe con icona e freccia: Compagno (con lo sprite piccolo e l'umore), Negozio e inventario (con il saldo), Sala dei trofei (con il numero di trofei), Impostazioni.

### 9.8 Varianti per tema

  - Arcade: schermata «PLAYER 1» con il punteggio come record, statistiche come barre a blocchi.
  - Fantasy: pergamena come una scheda del personaggio da gioco di ruolo da tavolo, con i riquadri incorniciati.
  - Cyberpunk: dossier con i dati dell'eroe, statistiche come valori in mono con barre a segmenti.
  - Lovecraft: diario dell'investigatore con l'emblema come una vecchia fotografia sbiadita.
  - Minimal: profilo pulito, riquadri bianchi o scuri e numeri grandi.

### 9.9 Modalità Essenziale

  - La scheda del personaggio è nascosta, come deciso nell'analisi; livello ed esperienza restano in piccolo.
  - I badge restano, senza la riga delle monete bonus; spariscono i collegamenti a Negozio e Sala dei trofei.

### 9.10 Nome di statistica da correggere

  - Nel tema Lovecraft la Saggezza si chiamava «Sanità mentale», come la vita nello stesso tema.
  - Deciso da Claudio il 30/10: in Lovecraft la Saggezza diventa «Lucidità» e la vita diventa «Vitalità». Aggiornati anche il documento sulle statistiche e il lessico dei temi.

### 9.11 Accessibilità

  - Ogni riquadro si legge così: «Forza, livello 4, 340 punti su 500, in crescita».
  - I badge bloccati si leggono con la condizione e l'avanzamento.
  - Con testo molto grande la griglia della scheda diventa un elenco a una colonna.

### 9.12 Scelte approvate il 30/10

1.  Impostazioni dall'ingranaggio e dalla riga in fondo (★) o solo dalla riga.
2.  Emblema del tema con l'iniziale (★), con sprite personalizzati in futuro.
3.  Scheda del personaggio a griglia (★) o a elenco.
4.  Freccia ↓ in testo tenue (★) o nel colore pericolo.
5.  In Lovecraft Saggezza «Lucidità» e vita «Vitalità» (deciso da Claudio).

## 10. Impostazioni e dati

Stato: approvata da Claudio il 30/10, con le scelte ★. Obiettivo di design: trovare ogni scelta in pochi secondi, capire cosa cambia prima di cambiarla e sentirsi padroni dei propri dati.

### 10.1 Accesso e struttura

  - Si apre dall'ingranaggio in alto nel Profilo e dalla riga in fondo, come approvato nel Profilo.
  - ★ Una sola pagina con gruppi intitolati, in quest'ordine: Aspetto, Gioco, Giornata, Notifiche, Accessibilità, Dati, Informazioni. Le righe semplici (interruttori, scelte brevi) si cambiano lì; solo Tema, Non disturbare e i Dati aprono una pagina propria. In alternativa una pagina iniziale con 7 voci che aprono ognuna la sua pagina.
  - Righe alte almeno 52, con icona, nome, valore attuale a destra in testo tenue (es. «06:00») e freccia quando aprono qualcosa.
  - In cima un campo Cerca che filtra le righe mentre si scrive.

### 10.2 Aspetto

  - Tema: la riga mostra il nome e una miniatura; apre la pagina del tema.
  - Colori per daltonici: interruttore, con sotto «Heatmap, barre e stati in una scala blu–arancio».
  - Lingua: apre un foglio con le 5 lingue scritte nella lingua stessa; il cambio è immediato.
  - Dimensione del testo: riga informativa «Segue il telefono», che apre le impostazioni del sistema.

### 10.3 Pagina del tema

  - ★ Lo stesso carosello di schede grandi del Primo avvio, con l'anteprima vera di Oggi coi dati dell'utente; il tema si applica con il pulsante «Usa questo tema». In alternativa il tema si applica subito al tocco, senza anteprima.
  - Per Minimal i tre chip Automatico, Chiaro, Scuro.
  - Dopo il cambio una breve transizione del nuovo tema e la frase «Stessi dati, nuova veste»; compagno, nomi e progressi restano, come deciso nel Compagno.

### 10.4 Gioco

  - Livello di gioco: due scelte, Completo ed Essenziale, ognuna con una riga che dice cosa mostra.
  - ★ Il cambio passa da un foglio di conferma che elenca cosa sparisce o torna (vita, boss, negozio, monete, scheda del personaggio) e dice «Non perdi nessun dato». In alternativa il cambio è immediato con un avviso e Annulla.
  - Suoni del tema: interruttore, spento di default come deciso nelle basi comuni, con un tasto ▶ per ascoltare un esempio.

### 10.5 Giornata

  - Cambio di giornata: selettore orario dalle 00:00 alle 06:00 a passi di 30 minuti, default 06:00, con sotto un esempio: «Una missione fatta all'01:30 conta per il giorno prima».
  - Primo giorno della settimana: lunedì o domenica, preso dal telefono all'inizio.
  - Giorni di riposo: 7 cerchi con l'iniziale, nessuno scelto di default; sotto «Nei giorni di riposo nessuna missione è prevista e la serie è al sicuro».
  - ★ Ogni cambio della giornata vale da domani, e la riga lo dice («Dal 31 ottobre»), così la giornata in corso non cambia regole a metà. In alternativa vale subito.
  - **Pausa generale** (Should, 12/11): ultima riga del gruppo, con valore «No», «Fino al 20 nov» o «Senza data». Apre un foglio con: una frase su cosa succede («Le missioni non tolgono vita, i giorni senza completamenti non abbassano l'umore del compagno, promemoria e riepilogo serale tacciono, le scadenze dei boss si spostano in avanti. La serie invece conta: completa almeno una missione al giorno per non interromperla.»), un calendario con data di inizio e data di fine (fine facoltativa, ultimo giorno di pausa compreso; Claudio, 12/11), e il pulsante «Inizia la pausa». La pausa può iniziare oggi o in una data futura; prima dell'inizio la riga mostra «Dal 20 nov» (Claudio, 12/11).
  - Durante la pausa lo stesso foglio mostra la data di fine con «Cambia» e il pulsante «Riprendi» (stesso dialogo di Oggi, 2.8).
  - In Essenziale la riga resta.


### 10.6 Notifiche

  - Promemoria: interruttore generale. Se il permesso del sistema è negato, al posto dell'interruttore c'è la riga «Notifiche bloccate dal telefono» con il pulsante «Apri le impostazioni del telefono».
  - Riepilogo serale: interruttore e orario. Richiamo dopo 3 giorni: interruttore, acceso di default (aggiunto con la sezione Promemoria e notifiche).
  - Riepilogo settimanale (se entra nella versione): interruttore, giorno e orario, default domenica 19:00.
  - Non disturbare: la riga mostra gli intervalli (es. «22:00–07:00, 13:00–14:00») o «Nessuno»; la pagina elenca gli intervalli con «+ Aggiungi intervallo», ognuno con inizio e fine, e spiega «I promemoria che cadono dentro arrivano alla fine dell'intervallo».
  - L'aspetto delle notifiche e i promemoria delle singole missioni si definiscono nella sezione Promemoria e notifiche.

### 10.7 Accessibilità

  - Riduci movimento: tre scelte, Come il telefono (default), Sì, No.
  - Vibrazioni: interruttore, acceso di default.
  - Una riga rimanda a Colori per daltonici in Aspetto, per chi lo cerca qui.

### 10.8 Dati

  - Backup: la riga dice dove (iCloud su iPhone, Google Drive su Android) e quando è stato fatto l'ultimo («Ultimo backup: ieri alle 06:12») oppure «Nessun backup ancora». La pagina ha «Fai un backup ora», l'interruttore Backup automatico giornaliero (spento finché l'utente non lo accende) e lo stato dell'ultimo tentativo.
  - Ripristina: sceglie un backup e mostra un'anteprima con data, numero di missioni e livello, poi «Sostituirà i dati di questo telefono» e il pulsante «Ripristina»; alla fine l'app si ricarica su Oggi.
  - Esporta in CSV (se entra nella versione): crea il file con missioni e registro e apre il foglio di condivisione del sistema.
  - Elimina tutti i dati, in rosso in fondo al gruppo. Prima conferma: un foglio che dice cosa si perde e propone «Fai prima un backup». Seconda conferma: scrivere la parola ELIMINA nel campo, poi il pulsante si accende. Dopo, l'app riparte dal Primo avvio.
  - Un errore di backup o di ripristino si spiega in una riga con cosa fare (es. «Spazio iCloud esaurito») e un pulsante Riprova.

### 10.9 Informazioni

  - Versione dell'app, Privacy (con la frase «I tuoi dati restano sul telefono e nel tuo cloud»), Licenze dei caratteri (SIL OFL) e degli altri componenti, Contatti.

### 10.10 Varianti per tema

  - ★ Le Impostazioni restano sobrie in tutti i temi: cambiano colori, caratteri e il titolo, mentre righe e interruttori restano uguali e senza decorazioni, perché qui conta trovare in fretta. In alternativa cornici e decorazioni del tema anche qui.
  - Titoli: «OPTIONS» (Arcade), «Regole del regno» (Fantasy), «Config» (Cyberpunk), «Il patto» (Lovecraft), «Impostazioni» (Minimal).

### 10.11 Modalità Essenziale

  - La pagina è uguale; il gruppo Gioco mostra Essenziale selezionato e la riga «Torna a Completo».

### 10.12 Accessibilità della schermata

  - Ogni riga si legge con nome, valore e tipo («Vibrazioni, attivo, interruttore»).
  - Gli orari usano il selettore del sistema; gli intervalli di Non disturbare si leggono «dalle 22 alle 7».
  - Con testo molto grande il valore va sotto il nome invece che a destra.

### 10.13 Scelte da approvare

1.  Una sola pagina a gruppi (★) o una pagina iniziale con 7 voci.
2.  Tema cambiato con anteprima e «Usa questo tema» (★) o applicato subito al tocco.
3.  Cambio di livello di gioco con foglio di conferma (★) o immediato con Annulla.
4.  Cambi della giornata validi da domani (★) o subito.
5.  Impostazioni sobrie in tutti i temi (★) o decorate come il resto.
6.  Pausa generale: inizio scelto dal calendario, anche oggi; le serie non sono protette (Claudio, 12/11).


## 11. Promemoria e notifiche

Stato: approvata da Claudio il 30/10, con le scelte ★ e due modifiche (solo icona dell'app, complimento serale). Obiettivo di design: poche notifiche, al momento giusto, che si chiudono con un tocco e non fanno mai sentire in colpa.

### 11.1 Tipi di notifica

  - Promemoria di una missione, agli orari scelti nell'editor e solo nei giorni previsti dalla frequenza.
  - Promemoria di un'attività singola, con anticipo di 0 (all'ora esatta), 5, 15 o 30 minuti, scelto nell'editor con quattro chip.
  - Riepilogo serale (default 21:00), riepilogo settimanale della domenica (se entra nella versione), avviso del boss a 3 giorni dalla scadenza e un solo richiamo dopo 3 giorni senza aprire l'app.
  - Notifica di obiettivo raggiunto quando una missione collegata ai dati di salute si completa da sola (vedi Widget e integrazioni). Nessuna notifica di marketing, come deciso nell'analisi.
  - Su Android ogni tipo ha il suo canale (Promemoria, Riepiloghi, Boss, Richiamo), così l'utente può spegnerne uno dal telefono senza toccare gli altri.

### 11.2 Aspetto e testi

  - Le notifiche usano l'aspetto del sistema, che non si può cambiare; il tema entra nei testi, nel colore d'accento e nella piccola icona su Android (la silhouette di GHQ, monocroma come chiede il sistema).
  - Titolo: il nome della missione, sempre per primo, così si capisce anche a colpo d'occhio sullo schermo bloccato. Testo: una frase breve nel lessico del tema.
  - Esempi per «Leggi 20 pagine». Arcade: «Stage pronto\! Premi START». Fantasy: «L'impresa ti attende». Cyberpunk: «Contratto attivo, esegui». Lovecraft: «Il rito ti chiama». Minimal: «È l'ora che hai scelto».
  - Se la firma del compagno entra nella versione, il testo finisce con il suo nome («— Blob»).
  - Le notifiche mostrano solo l'icona dell'app, su Android e su iPhone, senza immagine grande. Deciso da Claudio il 30/10.

### 11.3 Azioni dalla notifica

  - Due pulsanti: Completa e Posticipa. Per le missioni misurabili Completa diventa l'incremento predefinito, per esempio «+250 ml».
  - Completa funziona a telefono bloccato e senza rete e dà gli stessi guadagni dell'app.
  - ★ Dopo Completa la notifica lascia il posto a una conferma breve, «Fatto\! +20 XP · +5 monete», che sparisce da sola dopo qualche secondo. In alternativa la notifica sparisce senza conferma.
  - ★ Posticipa ha un solo pulsante «Tra 10 min», come nell'analisi; al terzo posticipo il pulsante non c'è più. In alternativa un menu con 10, 30 e 60 minuti.
  - Il tocco sulla notifica apre Oggi con la riga della missione evidenziata per un attimo.

### 11.4 Raggruppamento e silenzi

  - ★ Tre o più promemoria nello stesso minuto diventano una sola notifica, «3 missioni per adesso», con l'elenco dentro; ogni missione si completa aprendo il gruppo. In alternativa sempre una notifica per missione.
  - Una missione completata cancella i suoi promemoria rimasti della giornata, ovunque sia stata completata.
  - Durante Non disturbare i promemoria aspettano la fine dell'intervallo e arrivano insieme, già raggruppati; quelli di missioni completate nel frattempo non arrivano.

### 11.5 Riepilogo serale

  - Titolo: il nome del compagno (6.14, 12/11), testo con le missioni ancora da fare: al massimo 3 per nome, poi «e altre 2».
  - Il tono è sempre un invito, mai un rimprovero: «Ti mancano 2 missioni, c'è ancora tempo».
  - Se tutte le missioni del giorno sono fatte, arriva un breve complimento nel tono del tema al posto dell'elenco (es. «Giornata completa\! Il regno festeggia» in Fantasy). Deciso da Claudio il 30/10.
  - Il testo è scritto con la voce del compagno e firmato col suo nome; situazioni e testi in 6.14 (12/11). Durante la pausa generale il riepilogo non parte.
  - Il tocco apre Oggi.

### 11.6 Avviso del boss e richiamo

  - Avviso del boss: «Mancano 3 giorni per sconfiggere \[nome del boss\]», con il tocco che apre la scheda del boss. Uno solo per boss.
  - Richiamo: dopo 3 giorni senza aprire l'app, una sola notifica gentile, «Blob ti aspetta. Bastano due minuti per ripartire»; poi nessun altro richiamo finché l'app non viene riaperta.
  - Il richiamo si spegne con la riga «Richiamo dopo 3 giorni» nel gruppo Notifiche delle Impostazioni, che si aggiunge a quelle già approvate.

### 11.7 Permesso

  - Il permesso del sistema si chiede solo dalla schermata che lo spiega: nel Primo avvio, oppure la prima volta che si aggiunge un promemoria nell'editor se allora era stato saltato.
  - Su iPhone si chiede il permesso per avvisi, suoni e bollino; il bollino dell'icona mostra il numero delle notifiche non ancora viste, come il widget piccolo, e si azzera aprendo il foglio «Notifiche recenti». Deciso da Claudio il 30/10.
  - Permesso negato: le righe Promemoria nell'editor e nelle Impostazioni lo dicono e portano alle impostazioni del telefono, come già approvato.

### 11.8 Modalità Essenziale

  - I testi non citano XP, monete, vita o boss; la conferma dopo Completa diventa «Fatto\!».
  - L'avviso del boss diventa l'avviso dell'obiettivo a 3 giorni dalla scadenza.

### 11.9 Accessibilità

  - Testi senza emoji obbligatorie e senza informazioni affidate solo all'icona; il lettore di schermo legge titolo, testo e i nomi dei pulsanti.
  - I pulsanti hanno nomi completi («Completa Leggi 20 pagine», «Posticipa di 10 minuti»).
  - I suoni delle notifiche seguono il telefono; il suono del tema si usa solo se i suoni del tema sono attivi.

### 11.10 Scelte da approvare

1.  Solo l'icona dell'app nelle notifiche (scelto da Claudio) invece dello sprite del compagno.
2.  Conferma breve dopo Completa (★) o notifica che sparisce senza conferma.
3.  Posticipa fisso di 10 minuti (★) o menu con 10, 30 e 60 minuti.
4.  Tre o più promemoria nello stesso minuto raggruppati (★) o sempre separati.
5.  Breve complimento la sera se è tutto fatto (scelto da Claudio) invece di nessun riepilogo.

## 12. Widget e integrazioni

Stato: approvata da Claudio il 30/10, con le scelte ★ e due modifiche (widget piccolo con notifiche, notifica per i completamenti da Salute). Obiettivo di design: completare le missioni senza aprire l'app, con widget che si riconoscono come parte del tema e restano leggibili a colpo d'occhio.

### 12.1 Widget piccolo

  - Formato 2×2 su iPhone e Android. Mostra serie in giorni con l'icona del tema, livello e «3 rimaste» (o «Tutte fatte»).
  - Lo sprite del compagno nel suo umore del momento (felice, normale, triste). In basso a destra un bollino con il numero delle notifiche di GHQ non ancora viste; senza notifiche il bollino non c'è. Deciso da Claudio il 30/10.

### Il tocco apre l'app: se ci sono notifiche non viste, su Oggi si apre il foglio «Notifiche recenti» con le ultime notifiche, dalla più nuova, ognuna con ora, testo e, per i promemoria ancora aperti, il pulsante Completa. Chiuso il foglio, il numero si azzera. Senza notifiche il tocco apre Oggi.

### 12.2 Widget medio

  - Formato 4×2. In alto una riga con serie, livello e «2 di 5»; sotto le prime 4 missioni di oggi, prima quelle del Piano del giorno e poi le altre nell'ordine di Oggi.
  - ★ Il tocco sul cerchio a sinistra completa la missione, il tocco sul nome apre l'app su quella missione: così non si completa nulla per sbaglio. In alternativa il tocco su tutta la riga completa.
  - Il completamento si vede entro 2 secondi: il cerchio si riempie con l'animazione del tema ridotta e la riga va in fondo, come in Oggi.
  - Per le missioni misurabili il cerchio aggiunge l'incremento predefinito e mostra il valore («1,25 di 2 l»), come nelle notifiche.
  - Con più di 4 missioni, l'ultima riga dice «e altre 3» e apre Oggi.

### 12.3 Giornata completa e stati vuoti

  - ★ Quando tutte le missioni sono fatte, il widget medio mostra il compagno felice e la frase «Giornata completa\!» nel tono del tema. In alternativa resta l'elenco con le missioni spuntate.
  - Nessuna missione oggi: «Giorno di riposo: la serie è al sicuro», come in Oggi.
  - Dopo il cambio di giornata il widget si aggiorna da solo con le missioni del nuovo giorno.

### 12.4 Varianti per tema

  - I widget seguono il tema attivo: colori, carattere dei numeri, icone e forma del cerchio di completamento come nella riga missione di Oggi.
  - Arcade: cornice pixel e numeri nel carattere pixel. Fantasy: fondo pergamena con bordo sottile. Cyberpunk: fondo scuro con filo neon. Lovecraft: fondo carta antica scura con inchiostro. Minimal: fondo pieno chiaro o scuro, come il telefono.
  - Su iPhone, con le icone tinte o trasparenti del sistema, il widget passa a una versione monocroma con lo stesso layout.

### 12.5 Live Activity del timer (Could, iPhone)

  - Per le missioni a durata, avviare il timer apre una Live Activity sulla schermata di blocco e nella Dynamic Island: nome della missione, tempo che manca, pulsanti Pausa e Completa.
  - Alla fine del tempo la missione si completa da sola con una vibrazione; la Live Activity mostra «Fatto\!» per qualche secondo e si chiude.
  - Colori e icona del tema; il resto segue l'aspetto del sistema.

### 12.6 Smartwatch (Could)

  - App per Apple Watch e Wear OS con l'elenco delle missioni di oggi e il cerchio per completarle, anche senza telefono vicino e senza rete; i dati si allineano quando il telefono torna raggiungibile.
  - ★ Aspetto semplice per tutti i temi, fondo nero e colore d'accento del tema, perché lo schermo è piccolo e va letto mentre ci si muove. In alternativa cornici e caratteri pieni di ogni tema.
  - In cima la serie e il numero di missioni rimaste; una complicazione mostra «3 rimaste» sul quadrante.

### 12.7 Dati di salute (Should)

  - Il collegamento si fa nell'editor, nel campo Obiettivo misurabile: la riga «Collega a Salute» (Apple Salute su iPhone, Health Connect su Android) propone passi, minuti di attività e ore di sonno. Il permesso del sistema si chiede solo in quel momento, con una frase che dice quale dato si legge e perché.
  - Una missione collegata mostra in Oggi una piccola icona a cuore e il valore che sale da solo («6.200 di 8.000 passi»).
  - Raggiunto l'obiettivo la missione si completa da sola e arriva una notifica che rende evidente il progresso, per esempio «Obiettivo raggiunto: 8.000 passi · +20 XP»; si vede anche in Oggi, nel widget e nel registro con l'icona Salute. La notifica rispetta Non disturbare. Deciso da Claudio il 30/10.
  - Permesso negato o dato non disponibile: la riga lo dice e la missione resta da completare a mano.

### 12.8 Comandi vocali

  - Le scorciatoie di Siri e Google Assistant non entrano in questa versione, come deciso nell'analisi; nessun elemento di design previsto.

### 12.9 Modalità Essenziale

  - Widget piccolo: serie e missioni rimaste, senza livello. Widget medio: niente XP né monete nelle animazioni. Il compagno resta, come nel resto dell'app.

### 12.10 Accessibilità

  - Ogni widget ha una descrizione per il lettore di schermo («GHQ, serie 12 giorni, 3 missioni rimaste»), e ogni cerchio ha il nome della missione («Completa Leggi 20 pagine»).
  - Contrasto dei testi almeno 4,5:1 in tutti i temi, anche sui fondi decorati.
  - Con testo molto grande il widget medio mostra 3 missioni invece di 4.

### 12.11 Scelte da approvare

1.  Widget piccolo con il compagno nel suo umore, il bollino delle notifiche e il foglio «Notifiche recenti» al tocco (scelto da Claudio).
2.  Nel widget medio il cerchio completa e il nome apre l'app (★) o tutta la riga completa.
3.  «Giornata completa\!» con il compagno felice quando è tutto fatto (★) o elenco spuntato.
4.  Smartwatch con aspetto semplice e accento del tema (★) o tema pieno.
5.  Completamento automatico dai dati di salute con una notifica (scelto da Claudio).
