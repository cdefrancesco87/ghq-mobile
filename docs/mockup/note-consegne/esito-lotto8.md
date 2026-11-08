# Esito lotto 8 · Asset Should e Could

45 SVG in `svg/` e una tavola in `tavole/lotto8.png`. Sorgenti: `sorgenti/lotto8.py`, `sheet8.py`.

| Asset | File | Note |
| --- | --- | --- |
| Piedistallo dei trofei | `piedistallo-<tema>.svg` | 32×16; i trofei si appoggiano sul bordo superiore |
| Badge sbloccato e bloccato | `badge-sbloccato-<tema>.svg`, `badge-bloccato-<tema>.svg` | 24×24: medaglia pixel (Arcade), sigillo di ceralacca (Fantasy), toppa (Cyberpunk), sigillo antico (Lovecraft), cerchio con icona (Minimal, 24 a tratto). Il bloccato è una sagoma |
| Regali | `regalo-biscotto|caramella|palla-<tema>.svg` | 16×16, stessa forma in tutti i temi con la palette del tema |
| Corona Main Quest | `corona-main-quest-<tema>.svg` (Minimal: `corona-minimal.svg`) | 16×16 |
| Evoluzione | `compagno-evoluzione-1|2-<tema>.svg` | 32×32 |

## Cose da sapere
- **Sprite intermedi:** generati ridistribuendo le righe e le colonne a basso contenuto dei due stadi (il cucciolo si allunga e si allarga, l'adulto si accorcia e si restringe), così le proporzioni cambiano davvero. Restano senza dettagli disegnati a mano (es. la cresta di Rocky che spunta). Se vuoi quei dettagli li aggiungo sprite per sprite.
- Arcade: la faccina cambia risoluzione, quindi gli intermedi sono la faccina adulta ricampionata a 21 e 27 pixel di lato.
- I regali hanno la stessa forma in tutti i temi; solo i colori cambiano. Nomi tematici (es. «Bonus» in Arcade) non definiti.
- Il bloccato del badge è una sagoma piena; nessun lucchetto nei temi pixel (solo in Minimal).
- Minimal: badge, regali e corona sono a tratto; il piedistallo è una forma semplice.
