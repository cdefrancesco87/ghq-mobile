# Esito lotto 7 · Storyboard delle animazioni

Per ogni tema (Minimal, Arcade, Fantasy, Cyberpunk, Lovecraft) 8 storyboard, ciascuno con 4–5 fotogrammi numerati, durata di ogni passaggio, cosa si muove, curva e versione «Riduci movimento» (solo dissolvenza di 150 ms).
File: `storyboard/<codice>-<tema>.png` (es. `C2b-fantasy.png`) e una tavola per tema in `tavole/lotto7-<tema>.png`. Sorgente: `sorgenti/sb7.py`.

| Codice | Contenuto | Durata totale |
| --- | --- | --- |
| C1 | Spunta del completamento: effetto del tema, «+25 XP», monete verso la scheda dell'eroe | 300 ms |
| C2a | Salita di livello con nuovo titolo | 1,5 s |
| C2b | Vittoria sul boss (pixel, polvere d'oro, crash glitch, nebbia, anello e coriandoli) | 2,2 s |
| C2c | Badge sbloccato | 1,4 s |
| C3 | Schiusa dell'uovo | 2 s |
| C4 | Transizione verso Oggi e cambio di tema (sipario pixel, pergamena, glitch, inchiostro, dissolvenza) | 800 ms |
| C5a | Evoluzione del compagno | 2,2 s |
| C5b | Esultanza per un regalo (cuori pixel, scintille, coriandoli neon, lucciole, cuore) | 1,1 s |

## Cose da sapere
- I fotogrammi sono **bozzetti di sequenza**, non animazioni vere: mostrano gli stati chiave, le durate e le curve sono scritte in didascalia.
- C2b: in Minimal il boss è l'icona a linea in un cerchio. I boss usati sono quelli «difficile».
- L'uovo (C3) è piccolo nel disegno perché lo sprite uovo occupa poco della griglia 32×32.
- Il sipario pixel (C4) e le animazioni del compagno usano gli sprite dei lotti 3 e 4; non ci sono sprite intermedi per l'evoluzione (lotto 8).
- C1 completa entro 300 ms dall'inizio, come chiede la sezione 2.6; i momenti a schermo intero (C2) durano al massimo 2,5 s e sono saltabili.
