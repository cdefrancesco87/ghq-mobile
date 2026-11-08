# Good Habits Quest Mobile – Analisi funzionale

Aggiornato al 16/10/2026 · Claudio. Documento di lavoro: <https://claude.ai/code/artifact/430a9b91-1b87-4684-a155-5ffc7f87ef3b>

## Scopo e vincoli

Good Habits Quest Mobile (GHQ Mobile) è un habit tracker per iOS e Android che trasforma abitudini e obiettivi in un gioco di ruolo (GDR) leggero, giocabile offline e senza account obbligatorio. Questo documento definisce cosa fa ogni sezione dell'app (expected output) e per chi (user stories); UI e UX delle singole schermate verranno disegnate dopo l'approvazione.

**Vincoli già decisi**

- Niente multiplayer né funzioni social (gilde, party, boss di gruppo, task condivisi).
- Niente AI: nessun suggerimento automatico né estrazione di attività da testo o voce.
- Niente annunci, nemmeno premio. Eventuale monetizzazione solo cosmetica, mai XP o progressi in vendita.
- Sei temi (Arcade, Fantasy, Cyberpunk, Lovecraft, Minimal chiaro, Minimal scuro) sopra un'unica struttura: cambiano palette, caratteri, icone, compagno e lessico, non le funzioni. Minimal è il default.

**Convenzioni del documento**

- I termini di gioco usano il nome concettuale (vita, esperienza, monete, missioni, boss, serie, livello, compagno); ogni tema li rinomina secondo `themes.json`. «Missione» indica qualsiasi attività: abitudine ricorrente o attività singola.
- Ogni user story ha un codice (es. US-OGGI-03), il formato «Come… voglio… così che…» e i criteri di accettazione.
- Priorità: **tecnica MoSCoW (Must, Should, Could, Won't), assegnata elemento per elemento nella tabella priorità MoSCoW, che prevale su eventuali etichette MVP, F2 e F3 rimaste nel testo dalla prima bozza**.

**Utenti target**

| Persona | Chi è | Cosa gli serve |
| --- | --- | --- |
| Il procrastinatore | Fatica a iniziare, ha già abbandonato altre app, spesso con tratti ADHD | Poche priorità chiare, gratificazione immediata, penalità che non scoraggiano |
| L'appassionato di GDR | Gioca a RPG, vuole un motivo «di gioco» per tornare | Boss, compagno, temi forti, progressione visibile |
| Il minimalista | Vuole tracciare abitudini senza il gioco in primo piano | Tema Minimal, statistiche chiare, nessun rumore |

## Mappa dell'app

L'app ha 12 sezioni: 5 sono voci della barra di navigazione, le altre si aprono da quelle o lavorano fuori dall'app (notifiche, widget). La barra in basso, uguale in tutti i temi, è: **Oggi · Abitudini · \[+\] · Obiettivi · Statistiche · Profilo**, dove \[+\] crea una nuova missione da qualsiasi schermata.

| # | Sezione | Sottosezioni | Stato |
| --- | --- | --- | --- |
| 1 | Primo avvio | Lingua, nome dell'eroe, tema, prime missioni da modelli, notifiche | Approvato |
| 2 | Oggi (home) | Stato dell'eroe, boss in corso, 3 priorità del giorno, missioni di oggi | Approvato |
| 3 | Abitudini | Filtri, elenco di tutte le missioni, pausa e archivio | Approvato |
| 4 | Editor missione (dal \[+\]) | Crea e modifica abitudini e attività singole | Approvato |
| 5 | Obiettivi e boss | Grandi obiettivi divisi in passi, trofei | Approvato |
| 6 | Compagno | Aspetto, umore, crescita | Approvato |
| 7 | Negozio e inventario | Pozioni, scudi della serie, cosmetici | Approvato |
| 8 | Statistiche | Heatmap, andamento per missione, registro | Approvato |
| 9 | Profilo | Livello, titolo, statistiche, badge, accesso a compagno, negozio, impostazioni | Approvato |
| 10 | Impostazioni e dati | Giornata, modalità di gioco, tema, backup | Approvato |
| 11 | Promemoria e notifiche | Promemoria con Completa e Posticipa dalla notifica | Approvato |
| 12 | Widget e integrazioni | Widget, integrazione con app salute (iOS e Android), integrazione con smartwatch | Approvato |

Contenuti, regole e priorità di tutte le sezioni sono stati rivisti e approvati da Claudio il 16/10; XP, monete e prezzi fanno capo al Google Doc sulla proposta di XP e monete.

## Priorità MoSCoW

Ogni elemento approvato ha una priorità MoSCoW: **Must** (senza, la versione non esce), **Should** (importante, ma la versione può uscire senza), **Could** (se c'è tempo), **Won't** (non in questa versione). Le priorità sono state approvate da Claudio il 16/10.

| Sezione | Elemento | Priorità |
| --- | --- | --- |
| 1. Primo avvio | Nome dell'eroe | Must |
| 1. Primo avvio | Scelta del tema con anteprima | Must |
| 1. Primo avvio | Prime missioni da modelli | Must |
| 1. Primo avvio | Spiegazione e permesso notifiche | Must |
| 1. Primo avvio | Nessun account, dati sul telefono | Must |
| 1. Primo avvio | Quest di partenza in 3 passi | Should |
| 1. Primo avvio | Compagno che parte come uovo | Should |
| 2. Oggi | Stato dell'eroe | Must |
| 2. Oggi | Boss in corso | Must |
| 2. Oggi | 3 priorità del giorno | Must |
| 2. Oggi | Missioni di oggi | Must |
| 2. Oggi | Completamento con un tocco e celebrazione | Must |
| 2. Oggi | Annullare fino a fine giornata | Must |
| 2. Oggi | Salta oggi, 3 volte a settimana | Should |
| 2. Oggi | Bonus giornata completa | Should |
| 3. Abitudini | Filtri e ricerca | Should |
| 3. Abitudini | Elenco di tutte le missioni | Must |
| 3. Abitudini | Riordino trascinando | Could |
| 3. Abitudini | Pausa con data di fine | Should |
| 3. Abitudini | Archivio e ripristino | Must |
| 3. Abitudini | Azioni rapide con scorrimento | Could |
| 3. Abitudini | Eliminazione con conferma | Must |
| 4. Editor missione | Campi base: nome, tipo, difficoltà | Must |
| 4. Editor missione | Frequenza giornaliera e giorni della settimana | Must |
| 4. Editor missione | Frequenze N volte a settimana e ogni N giorni | Should |
| 4. Editor missione | Frequenze mensile e annuale | Could |
| 4. Editor missione | Obiettivo misurabile: quantità | Should |
| 4. Editor missione | Obiettivo misurabile: durata con timer | Could |
| 4. Editor missione | Promemoria | Must |
| 4. Editor missione | Categoria e icona | Could |
| 4. Editor missione | Boss collegato | Must |
| 4. Editor missione | Note | Could |
| 4. Editor missione | Usa un modello | Should |
| 4. Editor missione | Statistica principale | Must |
| 4. Editor missione | Statistica secondaria (30% dei punti) | Could |
| 5. Obiettivi e boss | Grandi obiettivi divisi in passi | Must |
| 5. Obiettivi e boss | Danno al boss da passi e missioni collegate | Must |
| 5. Obiettivi e boss | Ricompense alla vittoria | Must |
| 5. Obiettivi e boss | Massimo 3 boss attivi | Must |
| 5. Obiettivi e boss | Sala dei trofei | Should |
| 5. Obiettivi e boss | Scadenza mancata: il boss ruba monete | Should |
| 5. Obiettivi e boss | Avviso 3 giorni prima della scadenza | Should |
| 5. Obiettivi e boss | Main Quest | Could |
| 5. Obiettivi e boss | Catene di obiettivi | Could |
| 6. Compagno | Aspetto | Must |
| 6. Compagno | Umore | Should |
| 6. Compagno | Crescita | Must |
| 6. Compagno | Non muore mai e non perde stadi | Must |
| 6. Compagno | Firma i promemoria | Could |
| 6. Compagno | Animazione di evoluzione | Could |
| 6. Compagno | Quarto stadio | Could |
| 6. Compagno | Regali dal Negozio (biscotti, caramelle, palla) | Could |
| 7. Negozio e inventario | Pozioni | Must |
| 7. Negozio e inventario | Scudi della serie | Should |
| 7. Negozio e inventario | Regali per il compagno con animazione | Could |
| 7. Negozio e inventario | Inventario con pulsante Usa | Must |
| 7. Negozio e inventario | Monete solo giocando, non acquistabili | Must |
| 7. Negozio e inventario | Ricompense personali | Could |
| 7. Negozio e inventario | Acquisto di altri compagni | Won't |
| 8. Statistiche | Heatmap | Should |
| 8. Statistiche | Andamento per missione | Must |
| 8. Statistiche | Registro | Should |
| 8. Statistiche | Riepilogo in cima | Must |
| 8. Statistiche | Completamento dimenticato fino a 7 giorni prima | Should |
| 8. Statistiche | Riepilogo settimanale | Could |
| 8. Statistiche | Andamento delle statistiche nel tempo | Could |
| 9. Profilo | Livello | Must |
| 9. Profilo | Titolo (elenco da definire) | Must |
| 9. Profilo | Badge con monete bonus | Should |
| 9. Profilo | Accesso a compagno, negozio, impostazioni | Must |
| 9. Profilo | Nome dell'eroe modificabile | Must |
| 9. Profilo | Statistiche dell'eroe, da 0 e senza calo | Must |
| 9. Profilo | Scheda del personaggio | Must |
| 9. Profilo | Freccia di forma | Should |
| 9. Profilo | Badge delle statistiche nel lessico del tema | Could |
| 9. Profilo | Compagno che segnala la statistica trascurata | Won't |
| 9. Profilo | Prestigio | Won't |
| 10. Impostazioni e dati | Giornata: orario di cambio, primo giorno della settimana, giorni di riposo, modificabili | Must |
| 10. Impostazioni e dati | Modalità di gioco Completo o Essenziale | Should |
| 10. Impostazioni e dati | Tema | Must |
| 10. Impostazioni e dati | Backup su iCloud o Google Drive | Must |
| 10. Impostazioni e dati | Esportazione CSV | Could |
| 10. Impostazioni e dati | Eliminazione di tutti i dati | Must |
| 10. Impostazioni e dati | Lingue: italiano, inglese, tedesco, francese, spagnolo | Must |
| 10. Impostazioni e dati | Riduci movimento | Should |
| 10. Impostazioni e dati | Interruttori delle notifiche | Must |
| 1. Primo avvio | Scelta della lingua, preselezionata dal telefono | Must |
| 10. Impostazioni e dati | Non disturbare | Must |
| 10. Impostazioni e dati | Colore mai unico segnale | Must |
| 10. Impostazioni e dati | Opzione Colori per daltonici | Could |
| 11. Promemoria e notifiche | Promemoria per missione, anticipo 0, 5, 15 o 30 minuti | Must |
| 11. Promemoria e notifiche | Completa dalla notifica | Must |
| 11. Promemoria e notifiche | Posticipa dalla notifica | Should |
| 11. Promemoria e notifiche | Promemoria cancellati se la missione è già fatta | Must |
| 11. Promemoria e notifiche | Riepilogo serale | Should |
| 11. Promemoria e notifiche | Un solo richiamo dopo 3 giorni di inattività | Could |
| 11. Promemoria e notifiche | Testi nel lessico del tema | Should |
| 12. Widget e integrazioni | Widget piccolo e medio | Should |
| 12. Widget e integrazioni | Apple Salute e Health Connect | Should |
| 12. Widget e integrazioni | Smartwatch | Could |
| 12. Widget e integrazioni | Comandi vocali Siri e Google Assistant | Won't |
| 12. Widget e integrazioni | Timer sulla schermata di blocco (iPhone) | Could |
| Trasversale | Sincronizzazione in tempo reale tra dispositivi | Won't |

Idee non ancora prioritizzate, descritte solo in sintesi: routine (sequenze ordinate di abitudini), mondi a tema legati al prestigio, rifugio da costruire come alternativa al combattimento, ritratto dell'eroe con sprite personalizzati al posto dell'emblema con l'iniziale (chiesto da Claudio il 30/10).

## Sezioni dell'app

Ogni sezione indica l'obiettivo, l'expected output (cosa l'utente vede e cosa il sistema produce) e le user stories con i criteri di accettazione.

### 1. Primo avvio

Portare l'utente dalla prima apertura alla prima missione completata in meno di 2 minuti, senza account.

**Expected output**

- Al primo avvio si crea un profilo locale «ospite»: nessuna registrazione, nessun dato inviato.
- Il flusso ha 5 passi, in quest'ordine: lingua, nome dell'eroe, tema, prime missioni da modelli, notifiche. La lingua è preselezionata da quella del telefono (se è una delle 5, altrimenti inglese) e si conferma con un tocco; l'elenco è Deutsch, English, Español, Français, Italiano. Solo il nome è obbligatorio.
- La scelta del tema mostra un'anteprima della schermata Oggi con il compagno e il lessico del tema.
- Le prime missioni si scelgono da modelli pronti (es. Bevi 2 litri d'acqua, Leggi 20 pagine, Meditazione 10 min), modificabili in seguito.
- Il flusso termina su Oggi con una «quest di partenza» già attiva: un piccolo boss di 3 passi (crea la prima abitudine, completala, apri le statistiche) che insegna l'app giocando.
- Il compagno è un uovo che si schiude al primo completamento.

**User stories**

- **US-ONB-00** Come nuovo utente voglio dare un nome al mio eroe, così che l'app si rivolga a me.
  - Campo libero, unico passo obbligatorio; il nome si cambia poi dal Profilo.
- **US-ONB-01** Come nuovo utente voglio iniziare senza creare un account, così che possa provare l'app subito.
  - Nessuna schermata di login o registrazione nel flusso.
  - I dati restano sul dispositivo finché l'utente non attiva un backup.
- **US-ONB-02** Come nuovo utente voglio scegliere il tema vedendone un'anteprima, così che l'app abbia lo stile che preferisco.
  - Sono mostrati i 6 temi; Minimal è preselezionato e segue chiaro o scuro del telefono.
  - Il tema si può cambiare in qualsiasi momento dalle Impostazioni senza perdere dati.
- **US-ONB-03** Come procrastinatore voglio partire da missioni già pronte, così che non debba pensare a cosa scrivere.
  - Almeno 12 modelli in 4 categorie (Salute, Mente, Lavoro e studio, Casa).
  - Si possono selezionare da 1 a 5 modelli; ognuno arriva con frequenza e difficoltà predefinite.
- **US-ONB-04** Come nuovo utente voglio capire le regole del gioco facendo, non leggendo, così che non abbandoni prima di iniziare.
  - La quest di partenza appare in Oggi e si chiude da sola quando i 3 passi sono fatti.
  - Vincerla dà il primo livello e le prime monete.
- **US-ONB-05** Come utente voglio decidere se ricevere notifiche dopo aver capito a cosa servono, così che non le neghi d'istinto.
  - Il permesso del sistema si chiede solo dopo una schermata che spiega cosa arriverà e quando.
  - Se l'utente rifiuta, l'app funziona lo stesso e ripropone il permesso solo dalle Impostazioni.

### 2. Oggi

È la home: in un colpo d'occhio dice come sta l'eroe, cosa c'è da fare oggi e quanto manca al boss.

**Expected output**

- In alto: data, saluto con il nome, compagno, livello, barre di vita ed esperienza, serie in giorni, monete.
- Il **Piano del giorno**: fino a 3 missioni scelte come priorità, in evidenza sopra le altre.
- La scheda del **boss in corso** con vita residua, passi fatti sul totale e prossimo passo.
- L'elenco **missioni di oggi** con contatore (es. 2 di 5): prima le da fare, ordinate per orario, poi le fatte con l'ora di completamento.
- Ogni missione mostra nome, frequenza o avanzamento (es. 1,2 di 2 L), difficoltà e XP in palio.
- Completare una missione assegna XP e monete, infligge danno al boss collegato e mostra una celebrazione breve; le animazioni si riducono se è attivo «Riduci movimento».
- Il completamento si può annullare entro la giornata: tutti i guadagni tornano indietro.
- Quando tutte le missioni del giorno sono fatte, compare uno stato «giornata completa» con il bonus del giorno.

**User stories**

- **US-OGGI-01** Come utente voglio vedere solo ciò che devo fare oggi, così che non mi perda nell'elenco completo.
  - Appaiono solo le missioni programmate per la data corrente, più le attività singole in scadenza oggi o scadute.
  - La giornata cambia all'orario impostato (default 06:00, modificabile), non a mezzanotte.
- **US-OGGI-02** Come procrastinatore voglio scegliere al massimo 3 priorità per oggi, così che sappia da dove iniziare.
  - Si possono fissare da 0 a 3 missioni nel Piano del giorno; una quarta è rifiutata con un messaggio.
  - Completare tutte le priorità dà un bonus di XP (vedi Regole di gioco).
  - Il Piano si azzera al cambio di giornata.
- **US-OGGI-03** Come utente voglio completare una missione con un tocco, così che registrarla non mi costi fatica.
  - Un tocco sul controllo di completamento la segna fatta; i guadagni appaiono entro 300 ms.
  - Per le missioni misurabili il tocco aggiunge l'incremento predefinito (es. +250 ml); una pressione lunga apre l'inserimento del valore.
- **US-OGGI-04** Come utente voglio annullare un completamento sbagliato, così che i miei dati restino veri.
  - È possibile annullare fino al cambio di giornata.
  - XP, monete, danno al boss e serie tornano allo stato precedente.
- **US-OGGI-05** Come appassionato di GDR voglio vedere il danno inflitto al boss quando completo una missione, così che ogni gesto conti.
  - La barra del boss si riduce con un'animazione e il numero del danno.
  - Se il colpo sconfigge il boss, si apre la schermata di vittoria.
- **US-OGGI-06** Come utente voglio saltare una missione di oggi con un motivo, così che un giorno di malattia non mi punisca.
  - «Salta oggi» non toglie vita e non spezza la serie, ma non dà XP.
  - I salti sono al massimo 3 a settimana per missione (deciso da Claudio il 16/10); oltre servono gli scudi della serie (vedi Negozio).

### 3. Abitudini

L'elenco completo di tutte le missioni, per trovarle, riordinarle e tenerle in ordine.

**Expected output**

- Elenco di tutte le missioni attive, raggruppato per categoria, con filtri: Tutte, Abitudini, Attività singole, Archiviate.
- Per ogni missione: nome, icona, frequenza, difficoltà, serie personale, percentuale di completamento degli ultimi 30 giorni.
- Ricerca per nome e riordino manuale con trascinamento.
- Azioni rapide con scorrimento: modifica, metti in pausa, archivia, elimina (con conferma).
- Nessun limite al numero di missioni nella versione base.
- Le attività singole completate restano visibili per 7 giorni nel filtro Attività singole, poi passano da sole tra le archiviate (deciso da Claudio il 30/10).

**User stories**

- **US-ABI-01** Come utente voglio vedere tutte le mie missioni in un solo posto, così che possa capire quante ne ho e come vanno.
  - L'elenco mostra anche le missioni non previste per oggi.
  - Il contatore in alto riporta il numero di missioni attive.
- **US-ABI-02** Come utente voglio mettere in pausa una missione, così che una vacanza non rovini serie e vita.
  - Una missione in pausa non appare in Oggi, non toglie vita e congela la sua serie.
  - La pausa può avere una data di fine; alla scadenza la missione si riattiva da sola.
- **US-ABI-03** Come utente voglio archiviare una missione che non mi serve più senza perderne lo storico, così che le statistiche restino complete.
  - Le archiviate stanno nel filtro Archiviate e si possono ripristinare.
  - L'eliminazione chiede conferma esplicita e toglie la missione e il suo storico da tutte le schermate (Oggi, Abitudini, Statistiche, Registro). È una cancellazione logica: i dati restano sul telefono e XP, monete e statistiche guadagnati non si perdono; se e dove mostrare le missioni eliminate è da decidere (deciso da Claudio il 30/10). Per cancellare davvero tutto c'è «Elimina tutti i dati» (US-IMP-05).

### 4. Editor missione

Creare o modificare una missione in pochi secondi, con impostazioni avanzate disponibili ma nascoste.

**Expected output**

- Si apre dal pulsante \[+\] come foglio dal basso, con il campo nome già attivo.
- Campi base: nome, tipo (abitudine ricorrente o attività singola), difficoltà (facile, media, difficile).
- Campi avanzati, in una sezione espandibile: frequenza, obiettivo misurabile, promemoria, categoria e icona, statistica principale e secondaria, boss collegato, note.
- Frequenze: ogni giorno; giorni della settimana; N volte a settimana; ogni N giorni; mensile (giorno del mese); annuale. Le attività singole hanno una scadenza facoltativa.
- Obiettivo misurabile: sì/no (default), quantità con unità (es. 2 L, 20 pagine), durata in minuti con timer integrato.
- In alto, «Usa un modello» apre la libreria dei modelli.
- L'anteprima degli XP in palio si aggiorna al cambio di difficoltà.

**User stories**

- **US-EDT-01** Come utente voglio creare una missione scrivendo solo il nome, così che aggiungerla sia immediato.
  - Con il solo nome si salva un'abitudine giornaliera di difficoltà media, senza promemoria.
  - Il salvataggio richiede al massimo 2 tocchi dopo aver scritto il nome.
- **US-EDT-02** Come utente voglio scegliere la difficoltà, così che le missioni più faticose valgano di più.
  - Facile, media e difficile danno 10, 25 e 50 XP.
  - Cambiare la difficoltà vale dai completamenti successivi, non ricalcola il passato.
- **US-EDT-03** Come utente voglio abitudini misurabili, così che possa tracciare quantità e durate e non solo un sì.
  - La missione è completa quando il valore raggiunge l'obiettivo; i valori parziali restano nello storico.
  - Le missioni a durata hanno un timer avviabile da Oggi, che continua a schermo spento.
- **US-EDT-04** Come utente voglio frequenze flessibili, così che l'app si adatti alla mia settimana.
  - Tutte le frequenze elencate sopra sono disponibili.
  - Per «N volte a settimana» la missione appare ogni giorno finché il numero non è raggiunto.
- **US-EDT-05** Come utente voglio collegare una missione a un grande obiettivo, così che completarla danneggi quel boss.
  - L'elenco dei boss attivi è selezionabile nell'editor.
  - Una missione può essere collegata a un solo boss alla volta.
- **US-EDT-06** Come utente voglio indicare quale statistica allena una missione, così che completarla faccia crescere il mio eroe in quell'area.
  - La statistica principale si sceglie tra le 6; i modelli la propongono già assegnata.
  - La statistica secondaria è facoltativa e diversa dalla principale.
  - Una missione senza statistica principale non dà punti statistica, solo XP e monete, e mostra un piccolo invito «Scegli una statistica».

### 5. Obiettivi e boss

I grandi obiettivi diventano boss: si dividono in passi, e ogni passo o missione collegata toglie vita al boss fino alla vittoria.

**Expected output**

- Elenco dei boss attivi (massimo 3 in contemporanea) e, sotto, la Sala dei trofei con i boss sconfitti.
- Creazione di un boss: nome dell'obiettivo, passi ordinati (da 2 a 20), scadenza facoltativa, difficoltà, statistica facoltativa (riceve 10 punti a ogni passo), missioni ricorrenti collegate.
- Scheda del boss: sprite del boss nel tema, vita residua, passi fatti sul totale, prossimo passo, missioni collegate, giorni alla scadenza.
- La vita del boss è calcolata dai passi, 20 per passo; la difficoltà cambia solo la ricompensa (vedi Regole di gioco); ogni passo completato e ogni missione collegata infliggono danno.
- Alla vittoria: schermata di celebrazione, bonus di XP e monete, trofeo nella Sala dei trofei.
- Se la scadenza passa, il boss resta in campo: ruba il 10% delle monete dell'eroe, al massimo 500, sbeffeggiandolo. I passi fatti restano e l'utente può fissare una nuova scadenza o archiviare l'obiettivo. 3 giorni prima della scadenza, viene mandato un reminder.
- **Prima versione, bassa priorità: Main Quest**: un obiettivo fissato in cima al piano del giorno. **Prima versione, bassa priorità: catene di quest**: obiettivi in sequenza, ognuno sblocca il successivo.

**User stories**

- **US-BOSS-01** Come utente voglio dividere un obiettivo grande in passi piccoli, così che sappia sempre qual è la prossima cosa da fare.
  - I passi si possono aggiungere, riordinare e modificare anche dopo la creazione.
  - Il prossimo passo non fatto appare nella scheda del boss in Oggi.
- **US-BOSS-02** Come appassionato di GDR voglio affrontare l'obiettivo come un nemico, così che finirlo dia la soddisfazione di una vittoria.
  - La vita del boss scende a ogni passo con un'animazione.
  - La vittoria assegna un trofeo con nome del boss e data.
- **US-BOSS-03** Come procrastinatore voglio che un obiettivo mancato non mi punisca, così che non smetta di usare l'app dopo un fallimento.
  - Alla scadenza mancata non si perde vita; il boss ruba monete, ma i passi fatti restano.
  - L'app propone di fissare una nuova data o archiviare l'obiettivo, enfatizzando la prima scelta.
- **US-BOSS-04** Come utente voglio rivedere i boss che ho sconfitto, così che veda quanta strada ho fatto.
  - La Sala dei trofei elenca i boss vinti dal più recente, con data e giorni impiegati.

### 6. Compagno

Un piccolo essere che cresce con le abitudini dell'utente e dà un motivo affettivo per tornare ogni giorno.

**Expected output**

- Il compagno dipende dal tema (Blob, Famiglio Brace, Drone BIT-0, Glub, Goccia) ma la sua crescita è una sola: cambiando tema cambia aspetto, non stadio.
- Stadi: uovo, cucciolo, adulto (MVP); un terzo stadio evoluto in F2. Si passa di stadio a soglie di missioni completate (vedi Regole di gioco).
- Umore visibile (felice, normale, triste) calcolato dagli ultimi 3 giorni; il compagno non muore mai.
- La scheda del compagno mostra nome (c’è un default, ma modificabile), stadio, numero di missioni da completare prima del prossimo stadio, umore e, in F2, i cosmetici indossati.
- Il compagno firma promemoria e messaggi (es. «Goccia ti ricorda: Meditazione, 10 minuti»).

**User stories**

- **US-COMP-01** Come utente voglio un compagno che cresce quando sono costante, così da avere un motivo in più per tornare sull’app.
  - L'uovo si schiude al primo completamento.
  - Al cambio di stadio parte un'animazione di evoluzione e una notifica in app.
- **US-COMP-02** Come procrastinatore voglio che il compagno sia triste ma non soffra quando salto, così che la penalità sia emotiva ma leggera.
  - L'umore torna felice dopo un giorno con almeno una missione completata.
  - Il compagno non perde mai stadi.
- **US-COMP-03** Come utente voglio dare un nome al mio compagno, così che lo senta mio.
  - Il nome si cambia dalla scheda del compagno e appare nei promemoria.
- **US-COMP-04 (F2)** Come utente voglio fare regali al compagno (biscotti, caramelle, una palla, elenco e prezzi da decidere), così che le monete abbiano un uso concreto e io possa rendere felice il mio compagno con delle interazioni attive.
  - Il regalo si dona dall'inventario, fa partire un'animazione del compagno felice e ne alza l'umore di un livello (es. da triste a normale) fino al cambio di giornata. Subito dopo il compagno ricorda all'eroe di proseguire con le abitudini, perché sono quelle che contano davvero (es. «Grazie, \[NOME EROE\]! Ma non dimenticarti di prenderti cura di te stesso. Completa i task di oggi entro la giornata!»).

### 7. Negozio e inventario

Il posto dove si spendono le monete: aiuti che proteggono i progressi e, in F2, cosmetici.

**Expected output**

- Saldo monete in alto, articoli in griglia con prezzo e descrizione breve.
- Articoli MVP: **pozione** (ridà vita), **scudo della serie** (protegge la serie per un giorno mancato, massimo 2 posseduti).
- Regali per il compagno (Could): biscotti, caramelle, palla per giocare e simili. Darne uno fa partire un'animazione del compagno felice di riceverlo e ne alza l'umore; poi il compagno ricorda all'eroe di proseguire con le abitudini, perché sono importanti. In versioni successive (Won't per ora): acquisto di altri compagni.
- Inventario con gli oggetti posseduti e il pulsante Usa.
- Le monete si guadagnano solo giocando; non si comprano con denaro reale e non si convertono in XP.
- Le ricompense personali (F2): l'utente crea premi della vita reale con un prezzo in monete (es. «Un episodio di una serie, 100 monete»).

**User stories**

- **US-NEG-01** Come utente voglio spendere le monete per proteggere la mia serie, così che un imprevisto non azzeri settimane di lavoro.
  - Uno scudo posseduto si consuma da solo nel primo giorno mancato e lo segnala in Oggi.
  - Non si possono avere più di 2 scudi.
- **US-NEG-02** Come utente voglio recuperare vita con una pozione, così che uscire da un periodo difficile sia possibile.
  - Una pozione ridà 10 punti vita, senza superare il massimo.
- **US-NEG-03 (F2)** Come utente voglio premiarmi con ricompense reali che decido io, così che le monete abbiano valore fuori dall'app.
  - Le ricompense personali si creano con nome, entità (piccola, media, grande, epica) e il prezzo viene definito automaticamente dall’entità; riscattarle scala le monete e le registra nello storico.

### 8. Statistiche

Rendere visibile il progresso: costanza, andamento delle singole missioni e storico completo.

**Expected output**

- Riepilogo in alto: serie attuale e record, missioni completate nella settimana, percentuale di completamento degli ultimi 30 giorni.
- **Heatmap** annuale, stile calendario: ogni giorno colorato per percentuale di missioni completate (dipende dal tema); tocco su un giorno per vederne il dettaglio.
- Dettaglio per missione: serie, record, percentuale per settimana e mese, grafico dei valori per le misurabili (es. litri al giorno).
- **Registro** (Quest Log): cronologia di completamenti, salti, boss vinti e oggetti usati, filtrabile per data e missione.
- **F2, riepilogo settimanale**: ogni domenica sera una scheda con i successi della settimana (missione più costante, boss danneggiati, livelli guadagnati), scritta in tono di gioco nel lessico del tema.
- **Andamento delle statistiche** (Could): per ogni statistica, una linea con il livello mese per mese (es. «Forza: da 3 a 7 negli ultimi 3 mesi»).
- Periodi selezionabili: settimana, mese, anno.

**User stories**

- **US-STAT-01** Come minimalista voglio vedere a colpo d'occhio quanto sono stato costante, così che capisca se sto migliorando.
  - La heatmap mostra almeno 12 mesi e usa i colori del tema con contrasto adeguato.
- **US-STAT-02** Come utente voglio vedere l'andamento di una singola missione, così che capisca su quale devo lavorare.
  - Dal dettaglio missione si vedono serie, record e percentuale per periodo.
- **US-STAT-03** Come utente voglio uno storico di tutto ciò che ho fatto, così che possa correggere o ricordare.
  - Il registro consente di aggiungere un completamento dimenticato fino a 7 giorni indietro; questo non dà vita persa indietro né ripristina la serie se già spezzata.
- **US-STAT-04 (F2)** Come procrastinatore voglio un riepilogo settimanale positivo, così che veda i successi e non solo le mancanze.
  - Il riepilogo arriva come notifica la domenica alle 19:00 (modificabile) e resta consultabile in Statistiche.

### 9. Profilo e progressione

L'identità dell'eroe e il punto d'accesso a compagno, negozio, trofei e impostazioni.

**Expected output**

- Nome e titolo dell'eroe (nel lessico del tema: es. Scudiero, Netrunner, Detective…), livello, esperienza al prossimo livello.
- Badge sbloccati e da sbloccare, con la condizione per ottenerli (es. Serie di 30 giorni, Primo boss sconfitto, 100 missioni completate). Ogni badge sbloccato dà monete bonus.
- Collegamenti a Compagno, Negozio e inventario, Sala dei trofei, Impostazioni.
- **Statistiche dell'eroe**: sei statistiche (Forza, Costituzione, Intelligenza, Saggezza, Carisma, Disciplina), rinominate da ogni tema, che partono da 0 e crescono con le missioni completate in base alla loro natura: Forza per sport e allenamento, Costituzione per alimentazione, sonno e salute, Intelligenza per studio, lettura e lingue, Saggezza per meditazione, diario e riflessione, Carisma per relazioni e famiglia, Disciplina per casa, lavoro, finanze e ordine. Sostituiscono le classi.
- **Scheda del personaggio**: 6 riquadri in griglia, ognuno con icona, nome nel lessico del tema, livello e barra verso il livello successivo, più la freccia di forma (↑ o ↓) che confronta i punti degli ultimi 30 giorni con quelli dei 30 precedenti. Toccando un riquadro si apre il dettaglio: livello, punti mancanti al prossimo livello e ultimi guadagni (es. «+20 Corsa, ieri»).
- Le statistiche non calano mai: smettere un'abitudine ne ferma la crescita ma non toglie livelli. Non danno bonus su XP o danni, solo traguardi: badge con nomi nel lessico del tema (es. nel tema Fantasy Forza 6 sblocca Atleta), con monete bonus come gli altri badge.
- **F3, prestigio e mondi**: arrivato al livello massimo, l'utente può ricominciare dal livello 1 con un riconoscimento permanente e sbloccare un mondo a tema; le missioni e lo storico restano.

**User stories**

- **US-PROF-01** Come appassionato di GDR voglio un titolo che cambia con il livello, così che senta l'eroe crescere.
  - Il titolo cambia ogni 5 livelli ed è definito per tema; l'elenco dei titoli è da definire.
- **US-PROF-02** Come utente voglio badge con condizioni chiare, così che sappia cosa posso ancora ottenere.
  - Almeno 20 badge in MVP; quelli bloccati mostrano la condizione e l'avanzamento.
- **US-PROF-03** Come utente voglio poter cambiare il nome dell'eroe, così che il profilo mi rappresenti.
- **US-PROF-04** Come appassionato di GDR voglio statistiche che crescono con le abitudini che coltivo, così che veda in quali aree della vita sto migliorando.
  - Ogni completamento dà punti alla statistica principale della missione e il 30% (per difetto) alla secondaria, se c'è.
  - Annullare un completamento toglie i punti; un completamento dimenticato aggiunto dal registro li dà.
- **US-PROF-05** Come utente voglio vedere a colpo d'occhio la scheda del mio eroe, così che capisca quali statistiche sto trascurando.
  - La freccia di forma è ↓ quando negli ultimi 30 giorni una statistica ha guadagnato meno punti dei 30 precedenti.

### 10. Impostazioni e dati

Tutte le scelte personali in un posto: aspetto, ritmo della giornata, notifiche, accessibilità e controllo dei dati.

**Expected output**

- **Aspetto**: tema (6), con Minimal che segue chiaro o scuro del sistema; dimensione del testo segue quella del sistema.
- **Giornata**: orario di cambio giornata (default 06:00), primo giorno della settimana, giorni di riposo settimanali facoltativi, tutti modificabili dall'utente (Must).
- **Livello di gioco:** Completo o Essenziale. Essenziale nasconde vita, boss e negozio e lascia missioni, serie e statistiche.
- **Notifiche**: attivazione generale, riepilogo serale e orario, suoni.
- **Accessibilità**: Riduci movimento (segue anche l'impostazione del sistema), vibrazioni, suoni.
- **Non disturbare**: uno o più intervalli orari (es. 22:00–07:00 e 13:00–14:00) in cui l'app non manda notifiche; i promemoria che cadono dentro arrivano alla fine dell'intervallo. Nessun intervallo di default. Must.
- **Daltonismo**: in tutti i temi il colore non è mai l'unico segnale (stati e barre hanno anche icona o testo); in più, un'opzione «Colori per daltonici» usa per heatmap, barre e stati una palette distinguibile anche con deuteranopia e protanopia.
- **Lingua**: italiano, inglese, tedesco, francese e spagnolo, scelta dentro l'app. Elenco: Deutsch, English, Español, Français, Italiano; al primo avvio è preselezionata la lingua del telefono.
- **Dati**: backup su iCloud o Google Drive dell'utente, ripristino con anteprima di cosa verrà sovrascritto, esportazione CSV, eliminazione di tutti i dati.
- Informazioni, privacy, licenze dei caratteri (SIL OFL).

**User stories**

- **US-IMP-01** Come utente che va a dormire tardi voglio scegliere quando cambia la giornata, così che una missione fatta all'una conti per il giorno prima.
  - L'orario va dalle 00:00 alle 06:00 a passi di 30 minuti.
- **US-IMP-02** Come minimalista voglio ridurre il gioco al minimo, così che l'app sia solo un tracker pulito.
  - In modalità Essenziale vita e penalità sono disattivate; XP e livelli restano ma sono discreti; le statistiche continuano a crescere ma la scheda del personaggio è nascosta.
  - Tornando a Completo nessun dato è perso.
- **US-IMP-03** Come utente voglio un backup nel mio cloud, così che cambiare telefono non mi faccia perdere tutto.
  - Backup automatico giornaliero facoltativo e backup manuale.
  - Prima del ripristino l'app mostra data del backup, numero di missioni e livello.
- **US-IMP-04** Come utente voglio esportare i miei dati, così che restino miei.
  - L'esportazione CSV contiene missioni e registro completo, condivisibile con il foglio di condivisione del sistema.
- **US-IMP-05** Come utente voglio cancellare tutti i miei dati, così che possa ricominciare o andarmene.
  - Serve una doppia conferma; dopo la cancellazione l'app riparte dal Primo avvio.

### 11. Promemoria e notifiche

Riportare l'utente alle missioni al momento giusto e farle completare anche senza aprire l'app.

**Expected output**

- Promemoria per missione, a uno o più orari, nei giorni previsti dalla frequenza; per le attività singole con anticipo di 0 (all'ora esatta), 5, 15 o 30 minuti.
- Azioni direttamente dalla notifica: **Completa** e **Posticipa** (10 min). Completare dalla notifica assegna gli stessi guadagni dell'app.
- Riepilogo serale facoltativo (default 21:00) con le missioni ancora da fare, firmato dal compagno.
- Nessuna notifica di marketing; al massimo una notifica di «richiamo» dopo 3 giorni di inattività, disattivabile.
- I testi usano il lessico del tema attivo.

**User stories**

- **US-NOT-01** Come utente voglio completare una missione dalla notifica, così che non debba aprire l'app.
  - L'azione Completa funziona anche a telefono bloccato e offline.
  - Le missioni misurabili aggiungono l'incremento predefinito.
- **US-NOT-02** Come utente voglio posticipare un promemoria, così che arrivi quando posso davvero farlo.
  - Posticipa ripropone la notifica dopo l'intervallo scelto, al massimo 3 volte.
- **US-NOT-03** Come utente voglio che le notifiche smettano se ho già completato la missione, così che non mi sentano insistenti.
  - Una missione già completata cancella i suoi promemoria rimanenti della giornata.

### 12. Widget e integrazioni

Portare le missioni fuori dall'app: schermata Home, smartwatch e dati di salute.

**Expected output**

- **Widget MVP** (iOS e Android), in due dimensioni: piccolo con il compagno nel suo umore e un bollino con il numero delle notifiche non viste (al tocco l'app apre un foglio con le notifiche più recenti); medio con le prime 4 missioni di oggi completabili con un tocco. Widget piccolo deciso da Claudio il 30/10.
- Il widget segue il tema attivo.
- **F2, salute**: Apple Salute e Health Connect completano in automatico missioni misurabili come passi, minuti di attività, ore di sonno. Il completamento automatico manda una notifica che rende evidente il progresso (deciso da Claudio il 30/10).
- **F2, smartwatch** (Apple Watch, Wear OS): elenco delle missioni di oggi, completamento dal polso, anche offline.
- **F2, scorciatoie vocali di sistema** (Siri, Google Assistant) per completare una missione per nome; non è AI dell'app e non ha costi.
- **F2, Live Activity** su iOS per il timer delle missioni a durata.

**User stories**

- **US-WID-01** Come utente voglio completare le missioni dal widget, così che basti sbloccare il telefono.
  - Il tocco sul widget completa la missione e aggiorna widget e app entro 2 secondi.
- **US-WID-02 (F2)** Come utente sportivo voglio che i passi si registrino da soli, così che non debba inserirli a mano.
  - L'utente collega una missione misurabile a un dato di salute; l'app chiede il permesso solo in quel momento.
- **US-WID-03 (F2)** Come utente voglio spuntare una missione dall'orologio, così che possa farlo mentre mi alleno.

### Funzioni di fasi successive, in sintesi

| Funzione | Fase | In breve |
| --- | --- | --- |
| Routine | F2 | Sequenza ordinata di missioni (es. routine del mattino) da eseguire una dopo l'altra, con un bonus a fine routine |
| Main Quest | F2 | Obiettivo principale fissato in cima a Oggi |
| Catene di quest | F3 | Obiettivi in sequenza, il successivo si sblocca alla vittoria |
| Mondi a tema | F3 | Sbloccati con il prestigio, con boss e ambientazione propri |
| Rifugio | F3 | Alternativa al combattimento: i completamenti ricostruiscono un rifugio o un giardino |

## Regole di gioco

Le regole valgono in tutti i temi e sono pensate perché i progressi non si perdano mai: le penalità tolgono vita e umore, mai livelli, monete o oggetti, con un'eccezione: a scadenza mancata il boss ruba monete. I valori sono una prima taratura da verificare con l'uso.

*XP, monete, bonus, livelli e prezzi sono definiti nel Google Doc **[GHQ Mobile – proposta XP e monete](https://docs.google.com/document/d/1U6AUuQOCZUrYqqYrquD0opRnpkEjIq3vpLqztilnwhU/edit)**, che fa fede su questi valori. Le regole su vita, serie, boss e compagno qui sotto sono approvate da Claudio il 16/10.*

**Ricompense per missione**

| Difficoltà | XP | Monete | Vita tolta se mancata (sostituita dalla regola in Vita) | Danno al boss collegato |
| --- | --- | --- | --- | --- |
| Facile | 10 | 2 | 2 | 2 |
| Media | 25 | 5 | 4 | 5 |
| Difficile | 50 | 10 | 6 | 10 |

**Bonus**

- Piano del giorno completato (tutte le priorità fissate): +25 XP.
- Giornata completa (tutte le missioni di oggi fatte): +10 monete e +5 vita.
- Moltiplicatore di serie sugli XP: ×1,1 da 7 giorni, ×1,2 da 30, ×1,3 da 100. Non si applica alle monete.
- Superare l'obiettivo di una missione misurabile non dà XP aggiuntivi.

**Livelli**

Gli XP per passare dal livello n al livello n+1 sono:

```latex
XP(n) = 50 \cdot (n + 3)
```

Dal livello 7 all'8 servono 500 XP, come nel mockup di Oggi. Con 5 missioni medie al giorno (125 XP) si sale di un livello ogni 4 giorni all'inizio e ogni 9 giorni intorno al livello 20. Il livello massimo dell'MVP è 50, raggiungibile in circa un anno e mezzo di uso costante.

**Vita**

- Massimo 50. Al cambio di giornata le missioni programmate e non fatte (né saltate, né in pausa) tolgono vita. Si perdono al massimo 10 punti al giorno, in proporzione a quanto manca: vita persa = 10 × XP delle missioni mancate ÷ XP di tutte le missioni previste, arrotondato all'intero. Esempio: 2 medie mancate su 5 medie previste tolgono 4 punti. Deciso da Claudio il 16/10.
- Si recupera: +1 per ogni missione completata, +5 per giornata completa, +10 con una pozione.
- A vita 0 l'eroe è «esausto» per un giorno: guadagna metà XP, poi la vita torna al 25% di quella massima (13 su 50, arrotondato per eccesso). Non perde livelli, monete né oggetti.
- Nessuna perdita di vita nei giorni di riposo, per le missioni in pausa e in modalità Essenziale.

**Serie**

- **Serie dell'eroe**: giorni consecutivi con almeno una missione completata. Un giorno di riposo la mantiene senza farla crescere.
- **Serie di missione**: occorrenze consecutive previste e completate; i giorni non previsti dalla frequenza non contano.
- Uno scudo posseduto si consuma da solo nel primo giorno mancato e salva entrambe le serie. Un «Salta oggi» non spezza la serie ma non la fa crescere. Regole della serie approvate da Claudio il 16/10.

**Boss**

- Vita del boss = numero di passi × 20. Ogni passo infligge 20 danni, ogni missione collegata il danno della tabella.
- La vita non scende sotto 10 × passi rimanenti: la vittoria richiede sempre l'ultimo passo. A scadenza mancata il boss ruba il 10% delle monete, al massimo 500, sbeffeggiando l'eroe.
- Ricompensa alla vittoria: passi × 10 XP × difficoltà del boss (facile 1, media 1,5, difficile 2), e monete pari a un quinto degli XP.

**Compagno**

- Uovo → cucciolo al primo completamento; cucciolo → adulto a 150 completamenti totali. Se si aggiunge il quarto stadio (Could, nome da scegliere: es. Asceso o Antico), la soglia per adulto si abbassa e il quarto stadio diventa il nuovo traguardo. Regole del compagno approvate da Claudio il 16/10.
- Umore sugli ultimi 3 giorni: felice sopra il 70% di missioni completate, normale tra 30% e 70%, triste sotto il 30%.

**Statistiche dell'eroe**

*Punti, curva dei livelli e badge delle statistiche sono definiti nel documento [GHQ Mobile – Statistiche dell'eroe](https://claude.ai/code/artifact/724a6dd5-0a1f-424b-8ee2-bbd137220b41), che fa fede su questi valori. Qui sotto la sintesi.*

- Punti alla statistica principale per ogni completamento: facile 10, media 20, difficile 30. La statistica secondaria prende il 30% arrotondato per difetto: 3, 6 o 9.
- Ogni passo di un boss dà 10 punti alla statistica scelta per quel boss, se indicata.
- Bonus, moltiplicatore di serie e missioni saltate non danno punti statistica.
- Ogni statistica parte dal livello 0; per salire dal livello n al livello n+1 servono 100 × (n+1) punti, con un livello massimo iniziale di 10 (i punti oltre il tetto si accumulano). Esempio: 2 missioni medie al giorno sulla stessa statistica (40 punti) portano al livello 5 in circa 5 settimane e al livello 10 in circa 4 mesi e mezzo.
- Le statistiche non scendono mai.

**Negozio**: pozione 50 monete, scudo della serie 100 monete (massimo 2 posseduti).

## Requisiti non funzionali

- **Piattaforme**: iOS e Android da un'unica base di codice (React Native con Expo, in TypeScript: vedi stack-tecnologico.md), telefoni prima; tablet con lo stesso layout allargato.
- **Offline prima di tutto**: ogni funzione MVP lavora senza rete; nessun server proprio né costi ricorrenti.
- **Privacy**: nessun account obbligatorio, nessun tracciamento né SDK pubblicitari; i dati escono dal telefono solo verso il cloud personale dell'utente.
- **Prestazioni**: avvio a freddo sotto 2 secondi su un telefono di fascia media; completamento con riscontro visivo entro 300 ms.
- **Accessibilità**: contrasto del testo almeno 4,5:1 in ogni tema, aree toccabili di almeno 44 px, etichette per lettori di schermo, testo scalabile, Riduci movimento.
- **Lingue**: italiano, inglese, tedesco, francese e spagnolo al lancio; testi chiavati per concetto e risolti per tema (`temi.json`).
- **Tempo**: tutte le regole usano il fuso orario del telefono e l'orario di cambio giornata; un cambio di fuso non deve creare giorni mancati falsi.

## Dati principali

| Entità | Campi chiave |
| --- | --- |
| Eroe | nome, livello, XP, vita, monete, serie, record serie, punti di ogni statistica, tema, modalità di gioco |
| Missione | nome, tipo, difficoltà, frequenza, obiettivo misurabile e unità, promemoria, categoria, statistica principale e secondaria, boss collegato, stato (attiva, in pausa, archiviata) |
| Completamento | missione, data di gioco, valore, ora, origine (app, notifica, widget, salute) |
| Boss | nome, passi, difficoltà, statistica, vita, scadenza, stato, data vittoria |
| Compagno | nome, stadio, completamenti totali, umore, cosmetici equipaggiati |
| Oggetto | tipo, quantità, data d'uso |
| Evento di registro | tipo, data, riferimenti, variazioni di XP, monete e vita |

## Decisioni sulle domande aperte

Tutte decise da Claudio il 16/10.

- **Sincronizzazione tra iPhone e Android**: solo backup nel cloud personale; la sincronizzazione vera, che richiede account e server, è Won't per questa versione.
- **Monetizzazione**: app gratuita e completa al lancio; in seguito, eventualmente, un acquisto unico per temi o regali extra. Mai annunci né XP in vendita.
- **Serie dell'eroe**: basta almeno una missione completata al giorno.
- **Temi al lancio**: tutti e 6, Must.
- **Penalità di vita**: attive di default in modalità Completo; chi non le vuole passa a Essenziale.
