# GHQ – Analisi – XP e monete

Bozza del 16 ottobre 2026, da discutere. Copia su Drive: [GHQ – Analisi – XP e monete](https://docs.google.com/document/d/1U6AUuQOCZUrYqqYrquD0opRnpkEjIq3vpLqztilnwhU/edit). Questo file è il riferimento principale.

Riprende la proposta precedente e la adatta al concept attuale: un habit tracker personale, offline e senza account, senza multiplayer, AI o annunci. Valori e priorità vengono dall'analisi funzionale, con la tecnica MoSCoW (Must, Should, Could, Won't); i punti segnati «Proposta» sono scelte nuove da approvare.

## In sintesi

In GHQ Mobile l'unico giocatore è l'utente, quindi non c'è nessuno da imbrogliare se non se stesso. Il rischio non è togliere punti ai colleghi, ma un gioco che premia il modo di spuntare le missioni più delle abitudini e che dopo qualche settimana smette di motivare. La proposta si basa su quattro regole:

- **Il valore dipende dalla fatica, non dal numero di missioni.** Gli XP crescono con la difficoltà, e spezzare un'abitudine in tante missioni facili non deve convenire.
- **La difficoltà si sceglie prima, non dopo.** Un cambio vale dai completamenti successivi e non ricalcola il passato.
- **Ogni guadagno è reversibile e tracciato.** Annullare un completamento restituisce tutto, e ogni movimento di XP, monete e vita è una riga del registro.
- **Le monete si guadagnano solo giocando.** Si spendono in aiuti e regali per il compagno, non si comprano con denaro reale e non diventano XP.

Le penalità tolgono vita all'eroe e umore al compagno, mai livelli, monete o oggetti. L'unica eccezione è il boss che, a scadenza passata, ruba monete (sezione 2).

## 1. Punti esperienza (XP)

### Quanti XP vale una missione

L'utente sceglie la difficoltà di ogni missione nell'editor. Facile vale 10 XP e difficile 50, quindi una missione difficile vale quanto cinque facili.

| Difficoltà | Esempio | XP | Monete |
| --- | --- | --- | --- |
| Facile | Un bicchiere d'acqua, 5 minuti di stretching | 10 | 2 |
| Media | Leggere 20 pagine, 10 minuti di meditazione | 25 | 5 |
| Difficile | 45 minuti di allenamento, un'ora di studio | 50 | 10 |

Sono una prima taratura da verificare con l'uso.

### Bonus

- Piano del giorno completato (tutte le priorità fissate, al massimo 3): +25 XP.
- Giornata completa (tutte le missioni di oggi fatte): +10 monete e +5 vita.
- Moltiplicatore di serie sugli XP: ×1,1 da 7 giorni, ×1,2 da 30, ×1,3 da 100. Non si applica alle monete.
- Boss sconfitto: passi × 10 XP × difficoltà del boss (facile 1, media 1,5, difficile 2), più monete pari a un quinto degli XP.

### Quando si ottengono

- Gli XP arrivano al completamento, con gli stessi valori da app, notifica o widget. Una missione saltata con «Salta oggi» (al massimo 3 volte a settimana per missione), in pausa o archiviata non dà XP, ma non toglie vita.
- Un completamento si può annullare fino al cambio di giornata (default 06:00, modificabile dall'utente): XP, monete, danno al boss e serie tornano come prima.
- Una missione misurabile dà XP solo quando il valore raggiunge l'obiettivo; superarlo non dà XP in più.
- Per le missioni «N volte a settimana» contano al massimo N completamenti a settimana.
- **Completamento dimenticato** (approvato da Claudio il 14/11): aggiunto dal registro fino a 7 giorni indietro, dà solo i punti statistica; niente XP, monete, moltiplicatore di serie né bonus di giornata. Non restituisce vita e non ripara una serie spezzata. Correggere i dati resta possibile, ma accumulare completamenti a posteriori non conviene.

### Attività singole in ritardo

**Proposta:** un'attività singola completata dopo la scadenza dà metà di XP e monete e non toglie vita, coerente con la regola che un obiettivo mancato non punisce. Perché non basti spostare la scadenza, uno spostamento fatto il giorno stesso o dopo conta come ritardo.

### Livelli

Gli XP per passare dal livello n al livello n+1 sono 50 × (n + 3): dal livello 7 all'8 servono 500 XP, come nel mockup di Oggi. Ipotizzando 5 missioni medie al giorno, circa 125 XP:

| Livello | XP totali | Tempo indicativo |
| --- | --- | --- |
| 2 | 200 | 2 giorni |
| 5 | 1.100 | circa 9 giorni |
| 10 | 3.600 | circa 1 mese |
| 20 | 12.350 | circa 3 mesi |
| 30 | 26.100 | circa 7 mesi |
| 50 | 68.600 | circa 1 anno e mezzo |

Il livello 50 è il massimo della prima versione; il prestigio è Won't. Il titolo dell'eroe cambia ogni 5 livelli, nel lessico del tema. In modalità Essenziale XP e livelli restano, ma in forma discreta.

### Protezioni contro l'auto-inganno

- **Difficoltà bloccata sul passato.** Cambiarla vale dai completamenti successivi. Proposta: al massimo un cambio ogni 7 giorni per missione, così non si alza la difficoltà proprio il giorno in cui si sa di farcela.
- **Rendimenti decrescenti sulle missioni facili.** Proposta: dall'undicesima missione facile completata nello stesso giorno, le facili danno metà XP. Chi spezza «bevi 2 litri» in otto bicchieri guadagna meno che con una sola missione misurabile.
- **Suggerimenti, non penalità.** Proposta: se una missione facile è completata ogni giorno da 30 giorni, il compagno suggerisce di alzarne la difficoltà; se una difficile viene saltata o annullata spesso, suggerisce di abbassarla. Sono regole fisse calcolate sul telefono, non AI.
- **Registro dei movimenti.** Ogni variazione di XP, monete e vita è una riga del registro (Quest Log), non un numero che si sovrascrive, così si può sempre ricostruire perché l'eroe ha un certo punteggio.

## 2. Monete e ricompense

### Perché niente budget e niente kudos

Nella versione precedente il budget fisso impediva a un membro del team di gonfiare i propri punti a spese dei colleghi, e i kudos premiavano l'aiuto reciproco. In GHQ Mobile non ci sono colleghi né funzioni social, e le monete non costano nulla a nessuno. Il loro valore lo tengono i prezzi del negozio: ogni aiuto costa qualche giorno di costanza.

### Come si guadagnano

- Missioni completate: 2, 5 o 10 monete secondo la difficoltà.
- Giornata completa: +10 monete.
- Boss sconfitto: un quinto degli XP della vittoria, più uno scudo della serie (100 monete al suo posto se se ne hanno già 2).
- Badge sbloccato: monete bonus, 25 (facile), 50 (medio) o 100 (difficile) in base al traguardo (approvato il 14/11; la fascia di ogni badge è nel codice, in bozza fino alla revisione dei contenuti).
- Quest di partenza del primo avvio: le prime monete.

Con 5 missioni medie al giorno e la giornata completa si guadagnano circa 35 monete al giorno.

### Quando si perdono

In un solo caso: se la scadenza di un boss passa, il boss sbeffeggia l'eroe e ruba il 10% delle sue monete, fino a un massimo di 500. È l'unica penalità che tocca le monete. I passi fatti restano, il boss si può riaffrontare con una nuova data e un avviso arriva 3 giorni prima della scadenza.

### Come si spendono

| Articolo | Prezzo | Effetto | Priorità |
| --- | --- | --- | --- |
| Pozione | 50 monete | +10 vita, senza superare il massimo di 50 | Must |
| Scudo della serie | 100 monete | Protegge le serie per un giorno mancato; massimo 2 posseduti | Should |
| Regali per il compagno (biscotti, caramelle, palla) | da rivedere (14/11: fuori dalla prima versione; servono più oggetti e un uso diverso) | Animazione del compagno felice e umore su di un livello fino al cambio di giornata; poi il compagno ricorda di proseguire con le abitudini | Could |
| Ricompense personali | automatico secondo l'entità | Un premio della vita reale, es. «Un episodio di una serie», di entità piccola, media, grande o epica | Should |

Una pozione costa circa un giorno e mezzo di costanza, uno scudo circa tre giorni. L'acquisto di altri compagni è Won't per questa versione.

### Altre regole consigliate

- **Niente monete in vendita.** Non si comprano con denaro reale e non si convertono in XP. Un'eventuale monetizzazione resta cosmetica, come temi extra o skin del compagno.
- **Ricompense personali (Should, da Could il 12/11).** L'utente le crea con nome ed entità (piccola, media, grande o epica) e l'app assegna il prezzo in monete in base all'entità; prezzi approvati da Claudio il 12/11: piccola 100, media 250, grande 600, epica 1500 monete. Riscattarle scala le monete e lo registra nello storico. L'app mostra solo il prezzo, senza giorni di costanza; nessun limite al numero di ricompense.
- **Trasparenza.** Dal registro si vede da dove arriva ogni moneta e dove è stata spesa.

## 3. Priorità MoSCoW

Le priorità seguono la tabella MoSCoW dell'analisi funzionale:

- **Must:** XP per difficoltà, livelli fino a 50 con titolo, annullamento in giornata, monete solo giocando, pozione e inventario, danno al boss e ricompense alla vittoria, vita con recupero morbido.
- **Should:** «Salta oggi» fino a 3 volte a settimana, bonus giornata completa, scudo della serie, boss che ruba monete a scadenza passata, badge con monete bonus, registro e completamenti dimenticati fino a 7 giorni prima, ricompense personali, scudo alla vittoria su un boss.
- **Could:** regali per il compagno, riepilogo settimanale. Le classi semplici sono eliminate: al loro posto ci sono le statistiche dell'eroe, descritte in [statistiche-eroe.md](statistiche-eroe.md).
- **Won't:** prestigio e acquisto di altri compagni.
- **Da decidere:** le regole segnate «Proposta» nella sezione 1 e la priorità di moltiplicatore di serie e bonus del Piano, che non sono nella tabella (proposta: Must).

I primi mesi d'uso raccolgono dati reali su XP e monete, utili per tarare valori e prezzi prima di aggiungere regali e ricompense personali.

## 4. Impatto sul modello dati

Il modello completo è in [modello-dati.md](modello-dati.md).

| Entità | Campi | Priorità |
| --- | --- | --- |
| Missione (campi nuovi) | data dell'ultimo cambio di difficoltà; per le attività singole, scadenza originale e data dell'ultimo spostamento | Must |
| Completamento | missione, data di gioco, valore, origine (app, notifica, widget, registro), aggiunto a posteriori sì/no | Must |
| Evento di registro | tipo (completamento, annullamento, bonus, ritardo, acquisto, uso, furto del boss), data, riferimenti, variazioni di XP, monete e vita | Must |
| Valori di difficoltà | XP, monete e danno al boss per ogni difficoltà, più il tetto di vita persa al giorno (10 punti), in una configurazione unica da tarare | Must |
| Oggetto | tipo (pozione, scudo, regalo), quantità, data d'uso | Must |
| Ricompensa personale | nome, entità (piccola, media, grande, epica), attiva sì/no | Should |
| Prezzi delle ricompense | monete per ogni entità, in configurazione | Should |
| Riscatto | ricompensa, data, monete spese | Should |
| Badge | tipo, condizione, data di sblocco, monete date | Should |

Tutto resta sul telefono; i dati escono solo verso il backup nel cloud personale dell'utente.

## 5. Decisioni da prendere

- Il limite di un cambio di difficoltà ogni 7 giorni va bene, o basta che il cambio non ricalcoli il passato?
- I rendimenti decrescenti sulle missioni facili oltre le 10 al giorno vanno bene?
- Un'attività singola in ritardo dà metà di XP e monete: va bene, o preferisci nessuna riduzione?
- I suggerimenti del compagno sulla difficoltà sono Should o Could?
- Prezzi e uso dei regali per il compagno: da rivedere insieme a più oggetti (14/11).
- Quanto costano le ricompense personali piccole, medie, grandi ed epiche?
- Moltiplicatore di serie e bonus del Piano non sono nella tabella MoSCoW: li segno come Must?
