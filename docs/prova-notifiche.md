# Prova delle notifiche (task C08 e C09)

Il prototipo verifica il punto più delicato dello stack: le azioni **Completa** e **Posticipa** di una notifica devono funzionare senza aprire l'app, a telefono bloccato, offline e con l'app chiusa del tutto. La logica è in `src/features/notifications/` (`reminders.ts` è testata con il database di test; `backgroundTask.ts` e `system.ts` parlano con Expo).

## Preparazione (una volta)

1. Conferma gli identificativi dell'app (C04): oggi `ch.ghq.mobile` è provvisorio, in `app.json`.
2. Crea l'account Expo e accedi: `eas login`.
3. Costruisci l'APK di sviluppo: `eas build --profile development --platform android`.
4. Installa l'APK sul telefono Android (il link e il codice QR li dà EAS a fine build).
5. Sul computer avvia il server: `npx expo start --dev-client` e apri l'app dal telefono.
6. Completa il Primo avvio e crea almeno una missione prevista per oggi.

## La schermata di prova

Apri la rotta `/dev/notifications` (solo nelle build di sviluppo; in produzione rimanda alla home): da un collegamento profondo `ghq://dev/notifications` oppure dal terminale di Expo.

1. Scegli una missione di oggi.
2. Premi «Notify in 10 seconds» e accetta il permesso delle notifiche.
3. Dopo 10 secondi arriva la notifica con i pulsanti Completa e Posticipa.
4. «Refresh events» mostra gli ultimi eventi del registro con il loro `source`: dopo Completa deve comparire `mission.completed` con `source: notification` e `notif:<id>`.

## I casi da provare

Per ogni caso: programma la notifica, crea la situazione, tocca il pulsante, poi riapri l'app e guarda «Last events» (e Oggi: la missione deve essere fatta, con XP e monete).

| # | Caso | Come | Atteso |
| --- | --- | --- | --- |
| 1 | App aperta | Lascia l'app in primo piano e tocca Completa | Un solo `mission.completed` con `source: notification` |
| 2 | Telefono bloccato | Programma, blocca lo schermo, aspetta la notifica, tocca Completa sulla schermata di blocco | Come sopra; l'app non si apre |
| 3 | Offline | Attiva la modalità aereo prima dei 10 secondi, tocca Completa | Come sopra: il gioco non usa la rete |
| 4 | App chiusa del tutto | Programma, poi chiudi l'app dall'elenco delle app recenti (scorri via), aspetta, tocca Completa | Come sopra; è il caso più difficile: il task in background deve aprire il database da solo |
| 5 | Doppio tocco | Tocca Completa due volte di fila, il più in fretta possibile | Un solo evento con quella chiave `notif:<id>`: XP e monete contati una volta |
| 6 | Posticipa | Tocca Posticipa | La notifica sparisce e ne arriva una nuova dopo 10 minuti |
| 7 | Posticipa tre volte | Ripeti Posticipa | Alla quarta notifica c'è solo Completa (massimo 3 posticipi) |
| 8 | Completa dopo Posticipa | Posticipa, poi completa la missione nell'app | La notifica rimandata non arriva più |

Su Android 14 e successivi, se le notifiche arrivano con qualche minuto di ritardo, è il permesso delle sveglie esatte (vedi `stack-tecnologico.md`, punto 5): annotalo.

## Cosa annotare (C09)

Per ogni caso: funziona sì o no, e su quale telefono e versione di Android. Se uno dei casi 2, 3, 4 o 5 non funziona, quella parte si scrive in nativo con un piccolo modulo Expo (decisione nativo sì/no).

Nota: il prototipo è stato scritto per Android. Su iPhone la stessa logica gira dal listener della risposta (`useReminderActions`), ma serve un Mac o un build su EAS per iOS e un account Apple Developer: non è parte di questa prova.

I testi di notifica («Completa», «Posticipa», «Tocca Completa per segnarla fatta.») sono provvisori e in italiano fisso: i testi tradotti arrivano con i promemoria veri.
