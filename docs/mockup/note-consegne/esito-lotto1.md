# Lotto 1 · Icone · esito

08/11/2026 · controllo secondo `design/claude-design/04-controllo-consegne.md`

**Esito: OK.** Aggiornato l'08/11 con il lotto 1-bis (10 icone in più) e le scelte di Claudio.

## Cosa c'è

- `svg/linea/`: 40 icone nuove × 4 tratti = 160 SVG, `icona-<nome>-<tema>.svg`. Le 30 del lotto 1 più le 10 del lotto 1-bis: indietro, avanti (freccia della riga), chiudi, lucchetto, avviso, esausto, riposo, notifiche-bloccate, quantita, sole.
- `svg/pixel/`: 59 icone pixel 12×12 per Arcade (le 19 esistenti che non l'avevano e le 40 nuove), `icona-<nome>-arcade.svg`. Con le 10 già fatte coprono tutte le 69 icone a linea.
- `svg/tacche/`: tacche della difficoltà per i 5 temi, piena e vuota, 12×12.
- `tavole/lotto1-icone.html` e `.png`: tutte le 69 icone nei 4 tratti e in pixel, a 24 e 16 px, su sfondo chiaro e scuro; tacche ai livelli 1–3.

## Controlli (automatici, sugli SVG)

- viewBox 24, `stroke="currentColor"`, nessun riempimento: ok su 160 file.
- Tratto: minimal 1,75 tondo, fantasy 1,5 tondo, cyberpunk 1,75 squadrato e a spigolo, lovecraft 1,25 tondo: ok.
- Pixel: solo quadrati interi, un colore (`currentColor`): ok. Nessuna icona a linea senza versione pixel.
- Salta (triangolo + barra) e pausa (due barre) non si confondono; archivio (scatola) e backup (nuvola con freccia) nemmeno.
- Leggibili a 16 px. Le più deboli in pixel a 16 sono Mente e Lingua (molti dettagli in poco spazio): vanno, ma sono le prime da rivedere se a schermo non convincono.

## Note (decise l'08/11)

1. **Casa** (categoria) è un divano, perché la casetta è già l'icona di Oggi.
2. **Tacche Lovecraft**: il brief e il lotto dicono «cerchi», `design-sezioni.md` A6 dice «occhi». Claudio ha confermato i cerchi (cerchio con il punto pieno, cerchio vuoto).
3. **Indicatore della barra Lovecraft**: il brief dice «stellina», A6 dice «sigillo». Claudio ha confermato la stellina. A6 va allineato quando si aggiorna design-sezioni.

Le icone esistenti hanno i file per tema con il colore scritto dentro (es. `#1f2328`); le nuove usano `currentColor`, come chiede il brief. Il T31 (barra) usa le icone esistenti: vedi `sviluppo/refactor-dopo-design.md`.
