# Lotto 4 · Logo, emblemi, habitat, arene, oggetti · esito

08/11/2026 · controllo secondo `design/claude-design/04-controllo-consegne.md`

**Esito: approvato da Claudio (08/11).** Generato da codice (`../sorgenti/lotto4.py`, `habitat2.py`, `build4.py`). Habitat e arene ridisegnati l'08/11 con più dettaglio (luci, sfumature a retino, oggetti). 49 SVG in `svg/`, tavole in `tavole/`.

## Cosa c'è

- **Logo** (`logo-marchio`, `logo-orizzontale`, `logo-orizzontale-scuro`, `logo-sigla`): segnaposto con la spunta, in `primario` di Minimal. Il testo è convertito in tracciati (Manrope 800), quindi non serve il font.
- **Icona dell'app**: `icona-app-1024` (iOS e store), `icona-app-sfondo` e `icona-app-primo-piano` (Android adattiva, segno dentro la zona sicura 66/108), `icona-app-monocroma` (Android 13) e `icona-notifica` (24 dp, bianco su trasparente).
- **Emblemi** `emblema-<tema>.svg`, 96×96: stemma pixel, scudo araldico, badge d'identità, sigillo di cera, cerchio. Gli SVG hanno solo la cornice: l'iniziale la scrive l'app con il font del tema, con le misure scritte sotto ogni emblema nella tavola. Leggibili anche a 40.
- **Habitat** `habitat-<tema>.svg`, 390×420 (pixel 130×140 a ×3; Minimal in vettoriale, chiaro e scuro). Ognuno ha un solo elemento che si muove, scritto nella tavola.
- **Arene** `arena-<tema>.svg`, 390×300, per i 4 temi pixel: città synthwave al tramonto (Arcade), cortile del castello con la grata (Fantasy), tetto sotto la pioggia (Cyberpunk), riva con rovine e tentacoli (Lovecraft). Minimal non ha boss.
- **Oggetti** `<oggetto>-<tema>.svg`: pozione, scudo, moneta, zaino, sigillo. 16×16 per i temi pixel, icona a linea 24 con un accento per Minimal. I nomi seguono il lessico (Power-up, Stim, Tonico…).

## Controlli

- Pixel su griglia intera; colori solo dalla palette sprite e da colori-v2.
- Contrasti della lettera degli emblemi: Arcade 5,3, Fantasy 9,2, Cyberpunk 15,0, Lovecraft 5,4. Minimal 4,45 va bene perché la lettera è grande (42 px, 800): la soglia lì è 3. Icona dell'app bianco su primario: 5,2.
- Oggetti leggibili a 16 px su superficie del tema. Ho corretto il power-up Arcade e gli zaini di Cyberpunk e Lovecraft, che erano troppo scuri.
- Originalità: niente funghi o stelle riconoscibili per il power-up; il disco volante e il manifesto di taglia sono generici.

## Note per Claudio

1. **Habitat scambiati rispetto al brief.** Il brief dava la stazione di ricarica a Cyberpunk e la vasca a Lovecraft, pensate per i compagni vecchi (drone e cucciolo informe). Con i compagni nuovi ho messo la **vasca illuminata dal basso a Cyberpunk** (ci vive Glitchy, l'axolotl) e uno **scrittoio con la lampada a olio a Lovecraft** (Lumin, la falena, vola attorno alla luce). Confermato da Claudio; 6.10 di design-sezioni aggiornato.
2. **Logo:** segnaposto approvato da Claudio (08/11); quello definitivo si disegna più avanti.
