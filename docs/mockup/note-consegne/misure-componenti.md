# Lotto 2 · Misure finali dei componenti

08/11/2026 · **approvate da Claudio l'08/11**, comprese le 7 correzioni. Sostituiscono L02 e L05 di `lacune-design-schermate.md`.

Le tavole sono in `tavole/lotto2-<tema>.html` (e `.png`); `lotto2-minimal-chiaro-200.html` mostra il testo al 200%. Tutte le misure sono in punti (pt su iOS, dp su Android).

## Confermate come nel brief

- Griglia 4; margini laterali 16; interno schede 16; tra schede 12; tra sezioni 24.
- Pulsanti alti 48 (56 il «Continua» del primo avvio); campo di testo 48; chip 32 (area toccabile 44/48); controllo segmentato 40; interruttore 52×32.
- Riga missione ≥ 64; riga di priorità 72 con il numero a sinistra; riga di elenco e voce del menu ≥ 52.
- Controllo di completamento: area 48, cerchio 28; anello delle misurabili 40 di diametro, tratto 4 (3 in Lovecraft).
- Intestazione grande 96, compatta 56 con Indietro in un'area 48 a sinistra.
- [+] da 56, rialzato di 20 sopra la barra; barra di navigazione alta 64 più la zona sicura.
- Avviso con Annulla alto 48, a 16 dai bordi. Maniglia dei fogli 36×4, a 8 dal bordo.

| | Minimal | Arcade | Fantasy | Cyberpunk | Lovecraft |
| --- | --- | --- | --- | --- | --- |
| Scheda | raggio 18, bordo 1 | cornice 3 a gradini | raggio 8, bordo 1 + filetto interno a 3 | taglio 12 in alto a sinistra e in basso a destra, filo 1 | due filetti da 1 a 3 di distanza |
| Pulsante, campo | raggio 14 | cornice 2 | raggio 8 | taglio 8 | filetto 1 |
| Chip | pillola | cornice 2 | raggio 8 | taglio 6 | filetto 1 |
| Foglio dal basso | raggio 18 in alto | cornice 3 in alto | raggio 8 in alto | taglio 12, bordo alto in `esperienza` | doppio filetto in alto |
| Barra | 8, pillola | 12, segmenti 8 + 2 | 10, contorno 1 in `testoTenue` | 6, 20 segmenti, alone 4 | 4, piatta |
| Tacche | punti | quadrati | spade | barrette | cerchi |
| Voce attiva | pillola 32×4 sopra l'icona | cornice 2 attorno all'icona | rombo 6 | linea 2 con alone | stellina 6 |

Colori delle forme: il bordo delle schede usa `bordo` (decorativo); il bordo di pulsanti, campi, chip e controlli usa `testoTenue` (≥ 3:1).

## Correzioni (approvate)

1. **Etichette della barra di navigazione: un ruolo nuovo, «Etichetta barra».** Con 6 posti ogni voce ha circa 61 di spazio, e «Statistiche» nella Didascalia non ci sta: 79 in Arcade, 71 in Cyberpunk. Proposta: Minimal Manrope 600 11; Arcade VT323 14; Fantasy Alegreya 500 13; Cyberpunk Chakra Petch 600 11 (Share Tech Mono è troppo largo); Lovecraft Crimson Pro 600 13. Così «Statistiche» sta tra 57 e 62 in tutti i temi. In tedesco si tronca con «…» (come in L03) e il nome intero resta per il lettore di schermo.
2. **Minimal chiaro, `fatto` come grafica:** #30a46c ha 2,94:1 sullo sfondo (serve 3). Proposta: #2b9a66 (3,31 sullo sfondo, 3,55 sulle schede). Tutti gli altri ruoli dei 6 temi passano le soglie (tabella nella colonna destra di ogni tavola).
3. **Lovecraft, numero di priorità:** in IM Fell English SC l'«1» sembra una «I». Il numero usa il ruolo Numeri (Crimson Pro), non Display.
4. **Arcade, anello delle misurabili:** diventa un quadrato pixel, tratto 4, che si riempie in senso orario. Un cerchio a 12 pt non rende in pixel.
5. **Stati dei pulsanti senza colori nuovi:** premuto = stesso colore scurito del 18%; spento = sfondo `traccia` e testo `testoTenue`.
6. **Intestazione grande:** titolo nel ruolo Titolo schermata, con sopra la data in Didascalia. Display resta per i momenti di gioco (livello, vittoria). Compatta: Titolo sezione al centro.
7. **Cyberpunk:** il filo delle schede usa `bordo`. Il neon (`esperienza` o `primario` con alone) va solo sulla voce attiva e sul bordo alto dei fogli, così non si confonde con la barra degli XP. Nota per il codice: con gli angoli tagliati il bordo va disegnato come tracciato SVG, perché il ritaglio semplice lo interrompe sugli angoli.

## Testo grande (fontScale ≥ 1,3, vedi L03)

- Le altezze fisse diventano minime: pulsanti, campi, chip, voci di menu e avviso crescono col testo.
- I pulsanti affiancati vanno uno sotto l'altro, larghi quanto la scheda; nel dialogo l'azione principale sta sopra.
- Il controllo segmentato diventa una fila di chip che va a capo.
- Riga missione: XP sotto il nome, controllo sempre a destra; la percentuale nell'anello sparisce (resta «1,25 di 2 L»).
- Etichette della barra ferme a 1,3 e troncate. Le icone restano a 20 e 24: si può valutare di portarle a 24 e 28.
- Titoli e Display ferme al 150%, il resto fino al 200% (A3).
