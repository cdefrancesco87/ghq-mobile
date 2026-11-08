# Lotto 0 · Schizzi dei compagni · esito

08/11/2026 · controllo secondo `design/claude-design/04-controllo-consegne.md`

**Esito: OK. Scelte di Claudio (08/11): Golem di muschio, Axolotl neon, Falena dai mille occhi, Nuvola; faccina Arcade per risoluzione.**

## Cosa c'è

- `tavole/lotto0-<tema>.html` e `.png`: una tavola per Fantasy, Cyberpunk, Lovecraft, Minimal e Arcade. Ogni posa a 4× su sfondo e superficie del tema, più la sagoma nera a 48 px.
- `svg/`: 39 SVG. Pixel a quadrati interi 32×32 (Arcade risoluzione: 8, 16, 32). Minimal vettoriale, in chiaro e scuro.
- Sorgenti per rigenerare tutto: `../sorgenti/` (Python, `build0.py`).

| Tema | Candidati | Pose |
| --- | --- | --- |
| Fantasy | Golem di muschio, Forziere mimico | cucciolo felice, normale, triste |
| Cyberpunk | Axolotl neon, Gatto randagio cyborg | idem |
| Lovecraft | Falena dai mille occhi, Tomo vivente | idem |
| Minimal | Nuvola, Sassolino | idem, chiaro e scuro |
| Arcade | faccina: per risoluzione, per power-up, per corpo | uovo, cucciolo, adulto felici |

## Controlli

- Nomi e formati: ok, minuscolo-con-trattini, SVG.
- Sagoma a 48 px: si distinguono tutti. Le più chiare sono Golem, Falena (ali), Axolotl (branchie), Nuvola. Sassolino e Forziere hanno sagome quasi uguali tra un umore e l'altro: l'umore passa solo dalla faccia o dal coperchio.
- Originalità: nessun personaggio riconoscibile. Axolotl in azzurro, non rosa (per stare lontani da quello di Minecraft).
- Il triste non sembra malato: seduto, sguardo in basso, indicatore spento. Nessuna lacrima tranne le due gocce di pioggia della Nuvola.

## Decisioni

1. **Soggetti** per Fantasy, Cyberpunk, Lovecraft, Minimal, ed **evoluzione** della faccina Arcade.
2. **Colori degli sprite (deciso l'08/11).** I pixel usano la palette sprite di ogni tema (`icone-sprite/sprite/palette.json`, 18 colori, la stessa degli sprite attuali), che ha 31 valori non presenti in `colori-v2.json`. La regola «solo colori-v2» lascerebbe per esempio Fantasy senza grigio né verde per il golem. Deciso: `colori-v2` vale per l'interfaccia, la palette sprite per i disegni. La palette è stata allineata a colori-v2 dove i colori coincidono (12 valori, per esempio l'oro Fantasy = monete) ed è in `palette-sprite.json`, che sostituisce `icone-sprite/sprite/palette.json` per i lotti successivi. Minimal usa solo colori-v2.
3. In Arcade il colore di contorno degli sprite (#1a1c2c) è uguale allo sfondo: la sagoma regge grazie al riempimento, ma sul fondo scuro il contorno sparisce. Va bene così per uno stile pixel; se no, contorno #262b44 (traccia).

## Dopo la scelta

Aggiornare `design-sezioni.md` 6.10 e A10, il lessico di `temi.json`, `registro-decisioni.md` e la memoria `ridisegno-compagni`; poi lotto 3.
