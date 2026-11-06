# Good Habits Quest: proposta di design

Sei temi selezionabili (Arcade, Fantasy, Cyberpunk, Lovecraft, Minimal chiaro, Minimal scuro) sopra la stessa app. Funzioni, layout e progressi non cambiano: cambiano palette, caratteri, icone, compagno e **lessico di gioco**.

- Schermate e sistema dei temi: canvas di design (link nel thread del progetto).
- Token completi (colori, font, forme, lessico): [temi.json](temi.json)
- Sprite e icone pronti da estrarre: cartella [icone-sprite/](icone-sprite/), archivio `icone-sprite.zip`, indice visuale in `icone-sprite/catalogo.html`.

## Principi

1. **Un'unica struttura.** Ogni tema usa la stessa schermata «Oggi»: eroe e compagno, vita ed esperienza, serie, boss in corso, missioni del giorno, navigazione a 5 voci con pulsante «+». Un tema è un set di token, non un'altra app.
2. **Il lessico fa metà del tema.** La vita diventa Vitalità (Lovecraft) o Integrità (Cyberpunk), le missioni diventano Imprese, Contratti o Rituali. I testi vanno chiavati per concetto (`vita`, `esperienza`…) e risolti per tema; la tabella è in `temi.json`.
3. **Leggibilità prima del costume.** I caratteri decorativi (Press Start 2P, Cinzel, IM Fell) restano su titoli, etichette brevi e numeri; il testo lungo usa sempre un carattere leggibile (VT323 a 20+ px, Alegreya, Chakra Petch, Crimson Pro, Manrope). Contrasto del testo almeno 4,5:1 in tutti i temi; aree toccabili di almeno 44 px.
4. **Minimal è il tema di default** per chi non vuole il gioco in primo piano, e segue chiaro/scuro del telefono.

## Caratteri (tutti Google Fonts, licenza SIL OFL, utilizzabili in app)

| Tema | Titoli | Testo | Perché |
|---|---|---|---|
| Arcade | Press Start 2P | VT323 | Il carattere dei cabinati anni '80 per i numeri; VT323 è un pixel font leggibile a corpi grandi. |
| Fantasy | Cinzel | Alegreya | Capitali lapidarie romane per titoli e ranghi; Alegreya è un serif calligrafico pensato per testi lunghi. |
| Cyberpunk | Chakra Petch | Share Tech Mono (dati) | Sans squadrato tecnico; il mono per timestamp, crediti, statistiche. |
| Lovecraft | IM Fell English SC | Crimson Pro | Riproduzione dei caratteri Fell del '600, sapore da tomo antico; Crimson Pro per leggere senza fatica. |
| Minimal | Manrope | Manrope | Geometrico morbido, cifre tabellari per barre e contatori. |

## Icone e sprite

- **Sprite pixel art 16×16** (20 elementi: uovo, 4 compagni in 2 stadi, boss, 10 oggetti) con un sistema a **ruoli di colore**: lo stesso disegno si ricolora per ogni tema (`sprite/palette.json`). Per aggiungere uno sprite basta disegnarlo una volta.
- **Icone pixel 12×12** per il tema Arcade (navigazione e azioni), monocromatiche (`currentColor`).
- **Icone a linea 24×24** (29 icone) per gli altri temi: stesso disegno, cambia il tratto (Fantasy 1,5 tondo, Cyberpunk 1,75 squadrato, Lovecraft 1,25 tondo, Minimal 1,75 tondo). Formati: SVG, PNG 96 px, Vector Drawable Android, sprite `<symbol>` per il web.
- Il compagno del tema Minimal (Goccia) è vettoriale, in 3 stadi.
- **Compagni in ridisegno (dal 31/10):** i soggetti attuali (Blob, Brace, BIT-0, Glub, Goccia) verranno sostituiti con un soggetto nuovo per tema; candidati in [compagni/ricerca-candidati-compagni.md](compagni/ricerca-candidati-compagni.md). Per Arcade è scelta una faccina pixel disegnata da noi.

In app gli sprite vanno scalati a multipli interi (2×, 3×, 4×) e con filtro *nearest neighbor* per restare nitidi: nell'app (React Native con Expo) si usano PNG già ingranditi a 2×, 3× e 4×, sul web `image-rendering: pixelated`.

## Da decidere più avanti

- Suoni e animazioni per tema (chiptune, pergamena, glitch, sussurri): non progettati in questa proposta.
- Sprite dei compagni allo stadio 3 e boss dedicati per tema: ora il boss è uno solo, ricolorato.
