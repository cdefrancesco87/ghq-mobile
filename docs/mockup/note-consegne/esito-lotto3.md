# Lotto 3 · Compagni e boss · esito

08/11/2026 · controllo secondo `design/claude-design/04-controllo-consegne.md`

**Esito: completo, da guardare.** Sono disegni generati da codice (`../sorgenti/lotto3.py`): si possono ritoccare pixel per pixel.

## Cosa c'è (70 SVG)

- **Compagni pixel** (Golem di muschio, Axolotl neon, Falena dai mille occhi, faccina Arcade): 9 pose per tema. Uovo; cucciolo e adulto felice, normale, triste; esultanza del cucciolo e dell'adulto. Nomi `compagno-<tema>-uovo.svg` e `compagno-<tema>-<stadio>-<umore>.svg` (umore `esulta` per l'esultanza).
- **Arcade per risoluzione:** uovo 8×8, cucciolo 16×16, adulto 32×32, da mostrare sempre in un riquadro di 64 a scala intera (×8, ×4, ×2).
- **Nuvola (Minimal)**: le stesse 9 pose in vettoriale, chiaro e scuro (`compagno-minimal-<chiaro|scuro>-…`). Al massimo 3 colori per posa: bianco o grigio, contorno, un accento (sole in `monete`, gocce e arcobaleno in `primario`).
- **Boss** per i 4 temi pixel: quest, facile, medio, difficile (`boss-<tema>-<tipo>.svg`). Il difficile è il più grande, la quest il più piccolo. Tutti i boss sono figure intere nello stile dei difficili v2 (ridisegnati l'08/11, sorgenti `../sorgenti/boss_diff.py` e `boss_v2.py`); il difficile riempie il riquadro 32×32. Vista d'insieme: `tavole/boss-v2.png`.

| Tema | Quest | Facile | Medio | Difficile |
| --- | --- | --- | --- | --- |
| Arcade | Dring, sveglia ribelle | Gloop, blob saltellante | Rocket, robot a razzo | Zorg, disco volante |
| Fantasy | Snooze, pipistrello dormiglione | Spore, fungo velenoso | Grunk, orco zannuto | Ignis, drago rosso |
| Cyberpunk | Bugsy, bug | Cubit, cubetto glitch | Blaze, muro di fuoco | Titan, mech ICE |
| Lovecraft | Shade, fiammella d'ombra | Peeper, bolla dai molti occhi | Jelly, medusa del vuoto | Krakko, l'Antico |

## Controlli

- Pixel art su griglia intera, un `<rect>` per riga, niente sfumature: ok su tutti gli SVG pixel.
- Colori: solo la palette sprite (`consegne/0/palette-sprite.json`) e colori-v2. Nessun valore estraneo.
- Umore in scala di grigi a 48 px: si legge dalla posa (seduto e più basso nel triste), dall'indicatore (runa, branchie, ali) e dalla faccia. Nell'Arcade, dove la faccina non ha corpo, si legge solo dalla faccia: a 48 px va bene per l'adulto, per il cucciolo 16×16 è al limite.
- Il triste è seduto con la faccia triste; nessuna lacrima tranne la pioggerella della Nuvola.
- Originalità: nessun personaggio riconoscibile. Ho evitato il cerchio giallo con la faccia a «Pac» (bocca piena) e l'invasore a granchio di Space Invaders.

## Note per Claudio

1. **Stadi della Falena.** La ricerca proponeva «larva» per il cucciolo. Ho tenuto la piccola falena che hai scelto nel lotto 0; l'adulto ha le ali più grandi con le costellazioni.
2. **Boss:** approvati da Claudio i 16 nomi propri (tabella sopra, la descrizione segue il nome) e lo stile dei difficili v2 (08/11). Gli altri 12 sono stati ridisegnati nello stesso stile.
3. **Nomi dei compagni scelti (08/11):** Pixel (Arcade), Rocky (Fantasy), Glitchy (Cyberpunk), Lumin (Lovecraft), Cloudy (Minimal). Già in `design/temi.json`.
