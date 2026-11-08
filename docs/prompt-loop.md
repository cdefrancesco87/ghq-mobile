Sei nel loop di sviluppo di GHQ Mobile. In questo giro esegui **un solo task** del backlog, poi fermati.

1. `CLAUDE.md` è già nel tuo contesto: non rileggerlo. Il backlog è in due file, in quest'ordine: `docs/backlog-task.md` (T01–T33) e `docs/backlog-schermate.md` (T34 in poi). Non leggerli per intero: cerca con Grep le righe `^### \[` e `Dipende da` in entrambi, poi leggi con Read solo il blocco del task scelto. Di `docs/backlog-schermate.md` leggi anche le «Regole comuni» in cima (fino alla prima riga `---`).
2. Controlla `git status`.
   - Se ci sono modifiche non salvate e un task è segnato `[~]`, è un giro interrotto: riprendi quel task.
   - Se ci sono modifiche non salvate e nessun task è `[~]`, non toccare niente: scrivi «LOOP FERMO: modifiche non salvate da controllare» e fermati.
3. Scegli il task: il primo `[~]` se c'è, altrimenti il primo `[ ]` con tutte le dipendenze `[x]`, scorrendo prima `docs/backlog-task.md` e poi `docs/backlog-schermate.md` (una dipendenza può stare nell'altro file).
   - Se non ce n'è nessuno, scrivi «LOOP FINITO» con l'elenco dei task `[!]` e il motivo, e fermati.
4. Segna il task `[~]` nel backlog.
5. Leggi i riferimenti in modo mirato: cerca con Grep il titolo della sezione citata (es. `^### 3.4`) nel file di `docs/riferimenti/`, poi leggi con Read solo quelle righe (offset e limit). Non leggere mai per intero `design-sezioni.md` né `analisi-funzionale.md`. Per capire il codice esistente cerca con Grep i nomi di funzione invece di leggere cartelle intere. Non rileggere un file già letto in questo giro. Se il task cita dei mockup, aprili con Read (sono PNG in `docs/mockup/`): servono per l'aspetto, non per i valori.
6. Fai il lavoro.
   - Per tutto ciò che sta in `src/rules/` e `src/db/repositories/` scrivi prima i test, guardali fallire, poi scrivi il codice.
   - Per le schermate e i componenti (`app/`, `src/features/`) scrivi i test con React Native Testing Library insieme al codice e riusa i componenti di `src/features/shared/` invece di rifarli.
   - Resta dentro il perimetro del task: non anticipare task successivi e non rifattorizzare codice non collegato.
   - Se aggiungi una dipendenza, usa `npx expo install <pacchetto>` per le librerie dell'app, così la versione è compatibile con l'SDK.
7. Verifica: esegui i comandi del campo «Fatto quando» del task e poi `npm run check`. Tutto deve passare. Leggi davvero l'output: un test saltato o un errore di tipo non è un successo.
8. Se tutto passa:
   - segna il task `[x]`;
   - aggiungi una riga in fondo al Diario del file che contiene il task: data, codice del task, cosa hai fatto in una frase, eventuali scelte minori o contenuti da rivedere;
   - fai un commit con tutti i file del task e il messaggio `Txx: <titolo del task>`.
9. Se dopo 3 tentativi la verifica non passa, oppure serve una decisione che i documenti e `CLAUDE.md` non danno:
   - metti da parte il lavoro con `git stash push -u -m "Txx bloccato"`, così il ramo resta verde;
   - segna il task `[!]` e scrivi nel Diario del suo file il motivo preciso e cosa servirebbe per sbloccarlo;
   - fai un commit del solo backlog con il messaggio `Txx: bloccato`.
10. Nel backlog cambia solo lo stato dei task e il Diario. Non riscrivere il testo dei task.
11. Sii conciso: nel terminale niente riassunti di file o di codice. Chiudi il giro con tre righe: task eseguito, esito, prossimo task disponibile.
