Sei nel loop di sviluppo di GHQ Mobile. In questo giro esegui **un solo task** del backlog, poi fermati.

1. Leggi `CLAUDE.md` e `docs/backlog-task.md`.
2. Controlla `git status`.
   - Se ci sono modifiche non salvate e un task è segnato `[~]`, è un giro interrotto: riprendi quel task.
   - Se ci sono modifiche non salvate e nessun task è `[~]`, non toccare niente: scrivi «LOOP FERMO: modifiche non salvate da controllare» e fermati.
3. Scegli il task: il primo `[~]` se c'è, altrimenti il primo `[ ]` con tutte le dipendenze `[x]`.
   - Se non ce n'è nessuno, scrivi «LOOP FINITO» con l'elenco dei task `[!]` e il motivo, e fermati.
4. Segna il task `[~]` nel backlog.
5. Leggi solo le parti dei documenti in `docs/riferimenti/` che il task cita.
6. Fai il lavoro.
   - Per tutto ciò che sta in `src/rules/` e `src/db/repositories/` scrivi prima i test, guardali fallire, poi scrivi il codice.
   - Resta dentro il perimetro del task: non anticipare task successivi e non rifattorizzare codice non collegato.
   - Se aggiungi una dipendenza, usa `npx expo install <pacchetto>` per le librerie dell'app, così la versione è compatibile con l'SDK.
7. Verifica: esegui i comandi del campo «Fatto quando» del task e poi `npm run check`. Tutto deve passare. Leggi davvero l'output: un test saltato o un errore di tipo non è un successo.
8. Se tutto passa:
   - segna il task `[x]`;
   - aggiungi una riga in fondo al Diario: data, codice del task, cosa hai fatto in una frase, eventuali scelte minori o contenuti da rivedere;
   - fai un commit con tutti i file del task e il messaggio `Txx: <titolo del task>`.
9. Se dopo 3 tentativi la verifica non passa, oppure serve una decisione che i documenti e `CLAUDE.md` non danno:
   - metti da parte il lavoro con `git stash push -u -m "Txx bloccato"`, così il ramo resta verde;
   - segna il task `[!]` e scrivi nel Diario il motivo preciso e cosa servirebbe per sbloccarlo;
   - fai un commit del solo backlog con il messaggio `Txx: bloccato`.
10. Nel backlog cambia solo lo stato dei task e il Diario. Non riscrivere il testo dei task.
11. Chiudi il giro con tre righe: task eseguito, esito, prossimo task disponibile.
