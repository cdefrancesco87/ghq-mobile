# GHQ – Analisi – Statistiche dell'eroe

Bozza · 16/10/2026 · Claudio. Aggiornato il 30/10 (Lovecraft: Saggezza → Lucidità). Copia su Drive: [GHQ – Analisi – Statistiche dell'eroe](https://docs.google.com/document/d/1cCj5a95Bc3Ulla4feU_AIODb6MRjq8FKUi74Jkig4ek/edit). Questo file è il riferimento principale.

## Scopo

Le statistiche dell'eroe mostrano in quali aree della vita l'utente sta migliorando. Partono da 0, crescono con le missioni completate in base alla loro natura e non calano mai. Sostituiscono le classi semplici e non danno bonus su XP o danni: servono a rendere visibile la crescita e a sbloccare badge.

Questo documento definisce come si guadagnano i punti e come salgono i livelli delle statistiche. XP, monete e prezzi restano in [xp-e-monete.md](xp-e-monete.md); le funzioni e le priorità sono nell'[analisi funzionale](analisi-funzionale.md) (sezioni 4, 8 e 9). I valori sono una prima taratura da verificare con l'uso.

## Le sei statistiche

Ogni tema rinomina le statistiche nel proprio lessico (per esempio in Cyberpunk Disciplina diventa Volontà); la proposta è nella sezione Nomi per tema e andrà in temi.json.

| Statistica | Missioni che la alimentano | Esempi di modelli |
| --- | --- | --- |
| Forza | Sport, allenamento, attività fisica | Corsa 30 min, 10.000 passi, Palestra |
| Costituzione | Alimentazione, sonno, salute | Bevi 2 litri d'acqua, Pasto sano, A letto entro le 23 |
| Intelligenza | Studio, lettura, lingue | Leggi 20 pagine, Studia 1 ora, Lezione di inglese |
| Saggezza | Meditazione, diario, riflessione | Meditazione 10 min, Scrivi il diario, Niente social la sera |
| Carisma | Relazioni, famiglia, amici | Chiama un amico, Cena in famiglia |
| Disciplina | Casa, lavoro, finanze, ordine | Riordina la scrivania, Registra le spese, Inbox zero |

Ogni missione ha una statistica principale, scelta nell'editor; i modelli del primo avvio arrivano già assegnati. La statistica secondaria è facoltativa e deve essere diversa dalla principale. Una missione senza statistica principale non dà punti statistica, solo XP e monete, e mostra un piccolo invito «Scegli una statistica» (deciso da Claudio il 16/10).

## Guadagno di punti

| Fonte | Statistica principale | Statistica secondaria (30%, per difetto) |
| --- | --- | --- |
| Missione facile | 10 | 3 |
| Missione media | 20 | 6 |
| Missione difficile | 30 | 9 |
| Passo di un boss | 10 alla statistica del boss, se indicata | nessuna |

- **Non danno punti**: bonus del Piano del giorno, bonus giornata completa, moltiplicatore di serie, missioni saltate o in pausa, vittoria sul boss oltre ai punti dei passi.
- **Missioni misurabili**: i punti arrivano solo quando l'obiettivo è raggiunto; superarlo non ne dà altri, come per gli XP.
- **Annullamenti e completamenti dimenticati**: annullare un completamento toglie i suoi punti; un completamento aggiunto dal registro (fino a 7 giorni prima) li dà.
- **Cambio di statistica o difficoltà**: vale dai completamenti successivi e non ricalcola il passato.
- **Modalità Essenziale**: le statistiche continuano a crescere ma la scheda del personaggio è nascosta, come vita e boss; tornando a Completo si ritrovano tutti i progressi (deciso da Claudio il 16/10).

## Curva dei livelli

Ogni statistica parte dal livello 0. Per salire dal livello n al livello n+1 servono **100 × (n+1) punti**, con un livello massimo iniziale di 10 (deciso da Claudio il 16/10). I punti guadagnati oltre il livello 10 si accumulano comunque, così che, se in una versione successiva il tetto sale, i livelli si sbloccano subito. La curva è lineare sul singolo passaggio, quindi i primi livelli arrivano in pochi giorni e i successivi richiedono mesi di costanza.

Giorni per arrivare a ogni livello, con un ritmo costante sulla stessa statistica:

| Livello | Punti per entrarci | Punti totali | 1 media al giorno (20) | 2 medie al giorno (40) | 2 difficili al giorno (60) |
| --- | --- | --- | --- | --- | --- |
| 1 | 100 | 100 | 5 giorni | 3 giorni | 2 giorni |
| 2 | 200 | 300 | 15 giorni | 8 giorni | 5 giorni |
| 3 | 300 | 600 | 1 mese | 15 giorni | 10 giorni |
| 5 | 500 | 1.500 | 2 mesi e mezzo | 5 settimane | 25 giorni |
| 10 | 1.000 | 5.500 | 9 mesi | 4 mesi e mezzo | 3 mesi |
| 15 | 1.500 | 12.000 | 1 anno e 8 mesi | 10 mesi | 6 mesi e mezzo |
| 20 | 2.000 | 21.000 | quasi 3 anni | 1 anno e 5 mesi | 1 anno |

Con un'abitudine media al giorno la statistica supera il livello 5 in circa due mesi e mezzo, e chi si allena ogni giorno con due missioni difficili raggiunge il tetto di 10 in circa 3 mesi. Le righe 15 e 20 servono solo come riferimento per un tetto più alto. Il livello dell'eroe (massimo 50) e i livelli delle statistiche sono separati: l'eroe cresce con tutti gli XP, ogni statistica solo con i propri punti.

## Forma, badge e andamento

**Freccia di forma (Should).** Accanto a ogni statistica, nella scheda del personaggio: ↑ se negli ultimi 30 giorni ha guadagnato almeno il 10% di punti in più dei 30 precedenti, ↓ se almeno il 10% in meno, nessuna freccia se la differenza è minore. Nei primi 30 giorni d'uso la freccia non compare.

**Badge delle statistiche (Could).** Un badge per statistica a ogni soglia, con nome nel lessico del tema e monete bonus come gli altri badge. Con il tetto a 10, proposta di soglie: livello 3, 6 e 10, quindi 18 badge in tutto. Esempi nel tema Fantasy per la Forza: Recluta robusta (3), Atleta (6), Campione (10). Nomi e monete sono da definire.

**Andamento nel tempo (Could).** In Statistiche, per ogni statistica, una linea con il livello mese per mese (es. «Forza: da 3 a 7 negli ultimi 3 mesi»).

## Nomi per tema

Proposta da rivedere. I due temi Minimal usano gli stessi nomi. Forza, Intelligenza e Carisma restano col nome standard dove indicato da Claudio il 16/10. La colonna Cyberpunk si ispira alle STAT del gioco di ruolo cartaceo Cyberpunk RED ed è stata confermata da Claudio il 16/10.

| Statistica | Arcade | Fantasy | Cyberpunk | Lovecraft | Minimal |
| --- | --- | --- | --- | --- | --- |
| Forza | Forza | Forza | Movimento | Forza | Movimento |
| Costituzione | Stamina | Tempra | Corpo | Resistenza | Salute |
| Intelligenza | Intelligenza | Intelligenza | Intelligenza | Intelligenza | Mente |
| Saggezza | Focus | Saggezza | Mente | Lucidità | Equilibrio |
| Carisma | Carisma | Fascino | Empatia | Persuasione | Relazioni |
| Disciplina | Costanza | Ordine | Volontà | Metodo | Ordine |

## Decisioni

Prese da Claudio il 16/10.

- **Scala dei punti**: 10, 20 e 30 per difficoltà.
- **Tetto giornaliero**: nessuno nella prima versione, da rivedere con l'uso.
- **Livello massimo**: 10 nella prima versione.
- **Statistica dei boss**: alla creazione di un boss si può scegliere una statistica, che riceve 10 punti a ogni passo.
- **Missione senza statistica**: niente punti statistica e invito «Scegli una statistica».
- **Modalità Essenziale**: le statistiche crescono, la scheda è nascosta.
