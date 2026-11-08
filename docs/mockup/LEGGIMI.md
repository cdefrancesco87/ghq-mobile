# Mockup di GHQ Mobile · riferimenti per Claude Code

Consegna dei lotti 0–8 del design (08/11). Questi file dicono **come deve apparire** ogni schermata; il **comportamento** resta in `docs/riferimenti/design-sezioni.md` e in `analisi-funzionale.md`. Se mockup e testo si contraddicono, segnalalo nel resoconto del task e segui il testo, tranne dove sotto è scritto altrimenti.

## Cosa c'è
| Cartella | Contenuto | Come si chiamano i file |
| --- | --- | --- |
| `schermate-per-tema/` | Le 9 schermate principali nei 6 temi (Minimal chiaro e scuro, Arcade, Fantasy, Cyberpunk, Lovecraft) | `<codice>-<tema>.png`, es. `B4-fantasy.png`. `B2-*` è una tavola più larga con le note |
| `flussi-minimal/` | Flussi, fogli, stati vuoti, errori in Minimal chiaro (la struttura è uguale negli altri temi) | `D<nn>[lettera].png`, es. `D09.png`, `D10B.png` |
| `storyboard/` | Animazioni in fotogrammi con durate e curve, un file per animazione e tema | `C1-arcade.png`, `C2b-fantasy.png`… |
| `componenti/` | Fogli dei componenti per tema (pulsanti, chip, righe, fogli, barre) | |
| `asset/` | SVG di sprite e icone (lotti 0, 1, 3, 4, 8) e `palette-sprite.json` | `lotto3/` compagni e boss, `lotto4/` habitat, arene, emblemi, logo, icone app; `lotto8/` badge, regali, corona, piedistallo |
| `note-consegne/` | `esito-lotto<n>.md` con scelte, segnaposto e cose inventate; `misure-componenti.md` con le misure | |
| `elenco-schermate.md` | Tabella codice → schermata → user story → sezione di `design-sezioni.md` | |

Tutte le schermate sono 390×844 (PNG a 2×, quindi 780 px di larghezza); D43 (tablet) è 900×640. Le pagine lunghe (Oggi, Abitudini, Negozio…) sono mostrate intere con una linea rossa dove finisce il primo schermo.

## Come usarli per un task
1. Trova nell'`elenco-schermate.md` il codice della schermata del task (B = per tema, D = flussi/stati).
2. Apri `schermate-per-tema/<codice>-<tema>.png` per l'aspetto in ogni tema; per gli stati e i fogli apri i `D…`.
3. Colori, caratteri e forme vengono da `temi.json` (v2) e dai fogli `componenti/`, **non** dai pixel del mockup: i mockup sono HTML disegnato, non il codice da copiare.
4. Gli sprite e le icone si prendono da `asset/` (SVG), mai ridisegnati.

## Segnaposto e cose da non prendere come definitive
- **Logo e icona dell'app:** segnaposto (pin con spunta). Da rifare a fine app.
- **Sprite intermedi di evoluzione** (`asset/lotto8/compagno-evoluzione-*`): segnaposto generati; usarli ma isolati in un punto solo, così si sostituiscono.
- **Titoli dell'eroe** (Rookie, Scudiero, Netrunner, Detective, e quelli del Profilo): provvisori; l'elenco dei titoli per livello è ancora da definire.
- **Testi inventati nei mockup:** saluti, notifiche d'esempio, nomi di trofei e badge, battute dei boss. Elencati in ogni `esito-lotto<n>.md`; in codice vanno nei file di lessico, non nelle schermate.
- **Minimal non ha sprite dei boss:** usa l'icona a linea in un cerchio.
- **Icone mancanti:** scudo e pozione (si usano icone esistenti in D27/D28), nel codice servono quelle vere.
- **Storyboard:** sono bozzetti di sequenza; la durata e la curva scritte in didascalia valgono, la grafica dei fotogrammi no.

## Decisioni di design prese durante i lotti (valgono più dei testi vecchi)
- **Barra in basso:** 4 voci più il [+] al centro (Oggi, Abitudini, [+], Obiettivi, Profilo); Statistiche si apre dal Profilo. Una veste per tema.
- **Compagni:** Pixel (Arcade), Rocky (Fantasy), Glitchy (Cyberpunk), Lumin (Lovecraft), Cloudy (Minimal). Stadi Uovo, Cucciolo, Adulto.
- **Habitat v2:** Cyberpunk acquario illuminato dal basso, Lovecraft scrivania con lampada a olio.
- **Nomi dei boss** e lessico per tema: `temi.json` e `esito-lotto3.md`.
