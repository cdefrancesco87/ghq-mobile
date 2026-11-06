# GHQ – Tecnica – Stack tecnologico

*Versione definitiva del 30/10/2026. Tutti i punti sono stati decisi da Claudio il 30/10. Il framework è React Native con Expo, perché il progetto serve anche come portfolio per trovare lavoro; per gli altri punti il criterio è stato: semplice da mantenere, leggero, compatibile con altri sistemi e scalabile. Requisiti presi da «GHQ – Analisi – Analisi funzionale».*

*Copia su Drive: [GHQ – Tecnica – Stack tecnologico](https://docs.google.com/document/d/1uaSkTpwpzBC3DKg3Mzlkg-Kc-W2NJhe5KeEhHDQrMFM/edit). Questo file è il riferimento principale.*

## Riepilogo

| # | Decisione | Scelta | Stato |
| :---- | :---- | :---- | :---- |
| 1 | Framework | React Native con Expo (TypeScript) | Deciso il 30/10 |
| 2 | Architettura e stato | Cartelle per funzione, Expo Router, regole di gioco in TypeScript puro, Zustand | Deciso il 30/10 |
| 3 | Database locale | SQLite con expo-sqlite e Drizzle ORM | Deciso il 30/10 |
| 4 | Backup | react-native-cloud-storage: iCloud su iPhone, spazio nascosto dell'app su Google Drive | Deciso il 30/10 |
| 5 | Notifiche | expo-notifications con azioni che non aprono l'app, da provare subito con un prototipo | Deciso il 30/10 |
| 6 | Widget, watch, schermata di blocco | expo-widgets per widget e Live Activity; smartwatch in nativo | Deciso il 30/10 |
| 7 | Salute | react-native-healthkit e react-native-health-connect | Deciso il 30/10 |
| 8 | Temi, sprite e animazioni | Token da temi.json nel Context di React, Reanimated, sprite PNG già ingranditi | Deciso il 30/10 |
| 9 | Lingue e lessico dei temi | i18next con il «contesto» per tema | Deciso il 30/10 |
| 10 | Strumenti, test e pubblicazione | VS Code, Jest, Maestro, EAS Build | Deciso il 30/10 |

## 1. Framework

**Deciso: React Native con Expo, in TypeScript.**
Il progetto deve servire anche per trovare lavoro. Nella verifica del 30/10 su iProgrammatori c'erano in Italia 49 annunci React, 46 Angular, 15 React Native e 3 Flutter; in Canton Ticino circa 14–17 annunci React e nessun annuncio Flutter trovato. React Native insegna anche React, che serve pure per le posizioni web.
Expo è il modo con cui il team di React Native consiglia di iniziare: gestisce build, permessi e configurazione nativa con dei plugin, quindi Xcode e Android Studio servono poco. Useremo una «development build» e non Expo Go, perché servono moduli nativi.
Cosa cambia rispetto ad Angular:

> * Componenti funzione in TSX al posto di classi con template HTML.
> * Hook (useState, useEffect e hook propri) al posto di servizi e cicli di vita; lo stato condiviso va in uno store.
> * Niente iniezione delle dipendenze: si usano moduli TypeScript e il Context di React.
> * Stili con oggetti StyleSheet e Flexbox, senza CSS a cascata.

Alternative valutate e scartate: Flutter (molti meno annunci di lavoro), Ionic con Angular (le azioni dalle notifiche richiederebbero codice nativo a parte), NativeScript con Angular (comunità piccola, pochi plugin), due app native (tempi doppi).

## 2. Architettura e gestione dello stato

**Deciso: cartelle per funzione con Expo Router, regole di gioco in TypeScript puro, Zustand per lo stato condiviso.**

> * Expo Router: ogni schermata è un file nella cartella app/, come le rotte di Angular ma basate sui file; la barra in basso è un layout a schede.
> * Le regole (XP, monete, danni al boss, serie, penalità, statistiche, cambio giornata e fusi) sono funzioni pure senza React: si testano con Jest e sono le stesse usate dall'app, dalla notifica e dal widget.
> * Zustand, che Claudio conosce già, per lo stato condiviso (eroe, tema, impostazioni): uno store somiglia a un servizio Angular con un BehaviorSubject dentro, con meno codice. Redux Toolkit, simile a NgRx, è stato scartato perché più verboso per un'app di queste dimensioni.
> * Le liste (missioni, completamenti) arrivano direttamente dal database con query reattive, senza copiarle nello store.

## 3. Database locale

**Deciso: SQLite con expo-sqlite e Drizzle ORM.**

> * Le entità dell'analisi (eroe, missione, completamento, boss, compagno, oggetto, evento di registro) sono relazionali. Drizzle dà uno schema tipizzato in TypeScript, migrazioni versionate e query reattive (useLiveQuery) che aggiornano lo schermo quando i dati cambiano.
> * Un unico file di database rende semplici backup, ripristino ed esportazione CSV.
> * Compatibilità futura: SQLite è un formato aperto che si apre con qualsiasi strumento, e Drizzle supporta anche PostgreSQL e MySQL, quindi se un giorno servisse un server lo schema e le query si riusano quasi uguali.
> * Le scritture usano chiavi uniche: un completamento arrivato due volte (per esempio dalla notifica e dall'app) conta una volta sola.
> * Alternative scartate: WatermelonDB (pensato per sincronizzarsi con un server, che non abbiamo), MMKV e AsyncStorage (chiave-valore, adatti solo alle impostazioni).
> * Il registro degli eventi è in sola aggiunta e salva l'origine di ogni completamento (app, notifica, widget, salute).

## 4. Backup su iCloud e Google Drive

**Deciso: react-native-cloud-storage, con un file di backup (database compresso con la versione dello schema) nello spazio nascosto dell'app.**

> * iPhone: iCloud, configurato dal plugin Expo della libreria; l'utente non deve fare nessun accesso.
> * Android: Google Drive, nello spazio riservato all'app. L'utente accede con Google solo per dare il permesso a quello spazio (con Google Sign-In); non è un account GHQ.
> * Backup automatico giornaliero con expo-background-task, più il backup manuale. Accanto al file c'è un piccolo riepilogo (data, numero di missioni, livello) mostrato prima del ripristino, come chiede US-IMP-03.
> * In più, il backup automatico di Android e il backup iCloud dell'iPhone coprono già il cambio di telefono.
> * Nessun server, nessun costo ricorrente.

## 5. Promemoria e notifiche

**Deciso: expo-notifications, con le azioni Completa e Posticipa impostate per non aprire l'app.** È il punto più delicato, quindi si verifica per primo con un prototipo.

> * Su iPhone, un'azione che non apre l'app avvia l'app in background senza mostrarla; il codice TypeScript scrive il completamento nel database e cancella i promemoria rimasti.
> * Su Android, per funzionare anche ad app chiusa, l'azione passa da un task in background (registerTaskAsync con expo-task-manager), come indica la documentazione di Expo.
> * Il codice dell'azione non dipende da schermate o stato di React: scrive solo nel database e conta ogni completamento una volta sola.
> * Vincolo iOS: al massimo 64 notifiche programmate per app. Si programmano solo i prossimi giorni e si riprogramma a ogni apertura e nel task in background.
> * Vincolo Android 14 e successivi: le sveglie esatte vanno autorizzate dall'utente; senza, i promemoria arrivano con qualche minuto di tolleranza.
> * «Non disturbare» e cambio di fuso sono calcolati dall'app prima di programmare.
> * Il prototipo va provato su un iPhone e un Android veri: a telefono bloccato, offline e con l'app chiusa. Se un caso non funziona, quella parte si scrive in nativo con un piccolo modulo Expo.

## 6. Widget, smartwatch e schermata di blocco

**Deciso: expo-widgets per i widget e il timer sulla schermata di blocco; codice nativo solo per lo smartwatch.**

> * expo-widgets scrive i widget in TSX con componenti SwiftUI su iOS e Jetpack Compose su Android, senza Swift o Kotlin. I pulsanti nei widget funzionano da iOS 17; su Android il supporto è parziale e va verificato.
> * L'app scrive in uno spazio condiviso un'istantanea (missioni di oggi, serie, livello, colori del tema); il tocco su una missione la completa e aggiorna widget e app entro 2 secondi.
> * Se su Android expo-widgets non basta, l'alternativa è react-native-android-widget, che disegna i widget Android in JSX.
> * Timer sulla schermata di blocco (Could): Live Activity con expo-widgets.
> * Smartwatch (Could): app watchOS in SwiftUI e Wear OS in Kotlin, aggiunte al progetto Expo con un plugin di configurazione. Resta l'ultima fase.

## 7. Apple Salute e Health Connect

**Deciso: @kingstinct/react-native-healthkit su iPhone e react-native-health-connect su Android, dietro un'unica interfaccia nostra.**

> * Passi, minuti di attività e sonno; il permesso si chiede solo quando l'utente collega una missione.
> * Lettura all'apertura e nel task in background; i completamenti che ne risultano hanno origine «salute».

## 8. Temi, sprite e animazioni

**Deciso: i token di temi.json nel Context di React; animazioni con Reanimated; sprite pixel art come PNG già ingranditi, senza librerie grafiche in più.**

> * Un tema è un oggetto di token (colori, caratteri, forme, icone, compagno) dato a tutta l'app con il Context di React, senza dipendenze in più; cambiarlo ridisegna l'interfaccia senza toccare i dati. Unistyles è stato scartato: una libreria in più per un vantaggio che non si nota, perché il tema cambia di rado.
> * Celebrazione, barra del boss e numero del danno con react-native-reanimated, che anima sul thread dell'interfaccia e aiuta a stare nei 300 ms.
> * Sprite 16×16 ingranditi prima a 2×, 3× e 4× con filtro «nearest», partendo dai PNG del design, e mostrati come immagini normali con expo-image: restano nitidi e l'app resta leggera. Skia si aggiunge solo se in futuro servono effetti particolari.
> * Icone a linea in SVG con react-native-svg; caratteri Google Fonts inclusi nell'app con expo-font, così funzionano offline.
> * Evoluzione del compagno (Could): Rive o Lottie, solo se le animazioni a sprite non bastano.
> * «Riduci movimento» del sistema letto con AccessibilityInfo e rispettato da tutte le animazioni.

## 9. Lingue e lessico dei temi

**Deciso: i18next con react-i18next ed expo-localization.**

> * Un file JSON per lingua (it, en, de, fr, es); la lingua del telefono è preselezionata con expo-localization.
> * Il lessico del tema usa il «contesto» di i18next: la chiave missioni ha le varianti missioni_fantasy, missioni_cyberpunk e così via, con la forma base come ripiego.
> * Un test controlla che ogni chiave esista in tutte le lingue e in tutti i temi.

## 10. Strumenti, test e pubblicazione

> * **Editor:** VS Code con ESLint e Prettier, TypeScript in modalità strict come in Angular.
> * **Test:** Jest per le regole di gioco (la parte più importante), React Native Testing Library per i componenti, Maestro per i flussi completi su emulatore, anche con le schermate dei 6 temi.
> * **Build:** EAS Build compila iOS e Android nel cloud, quindi non serve un Mac; il piano gratuito ha un numero limitato di build al mese, ma nello sviluppo quotidiano l'app si ricarica da sola senza build. EAS Submit carica su TestFlight e Play Console.
> * **Correzioni rapide:** EAS Update distribuisce correzioni del codice TypeScript senza una nuova versione sugli store.
> * **Lavorare da Windows o Linux:** si scrive il codice sul PC e si prova su Android con l'emulatore di Android Studio o con un telefono collegato. Per iPhone si lancia eas build, un Mac di Expo compila nel cloud e la build si installa su un iPhone vero; servono un iPhone e l'account Apple Developer, che si può attivare quando la versione Android è avanti.
> * **CI:** GitHub Actions per lint e test a ogni push.
> * **Store:** Apple Developer Program 99 USD l'anno; Google Play 25 USD una tantum.
> * **Crash e statistiche:** nessun SDK di terze parti; si usano i rapporti di App Store Connect e Play Console.
> * **Portfolio:** repository pubblico su GitHub con README, schermate e test in CI, da mostrare nei colloqui.

## Prossimi passi

> 1. Prototipo delle azioni delle notifiche su iPhone e Android (punto 5).
> 2. Progetto Expo con struttura a funzioni, temi da temi.json e le 5 lingue.
> 3. Regole di gioco e database con i test.
> 4. Schermata Oggi e completamento, poi le altre sezioni secondo le priorità MoSCoW.
