# Log del run notturno su dev

Una riga per sessione: task, esito, commit, scelte provvisorie, problemi trovati nella review.

| Data | Task | Esito | Commit | Scelte provvisorie | Review |
| --- | --- | --- | --- | --- | --- |
| 2026-11-13 | T45 – Promemoria: programmazione | fatto | `c3de7c0` | PROVVISORIO: promemoria spostato da Non disturbare oltre la fine della giornata di gioco = non parte; finestra di 7 giorni e limite 64 in `REMINDERS` (`src/rules/config.ts`); nessun promemoria per attività scadute dopo il giorno di scadenza; un salto conta come un completamento (niente promemoria quel giorno). Limite: niente ora di scadenza delle attività nel modello dati (dal T44), quindi nessun promemoria per le attività finché non arriva `due_time`. | Giro 1: `inArray` con elenco vuoto di missioni, aggiunta guardia e test. Giro 2: logica duplicata per collocare un orario nella giornata di gioco, estratta in `onGameDay`. Non provato sul telefono. |
