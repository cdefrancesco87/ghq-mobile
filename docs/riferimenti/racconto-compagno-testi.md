# Racconto del compagno: testi da scrivere

Elenco dei testi per US-COMP-05 e design-sezioni 6.14. Scritto il 12/11/2026. Stato: **elenco approvato il 12/11**, testi ancora da scrivere.

## Voci

Una voce per compagno: Pixel (Arcade), Rocky (Fantasy), Glitchy (Cyberpunk), Lumin (Lovecraft), Cloudy (Minimal chiaro e scuro, stessi testi). Quindi **5 voci**.

## Situazioni e varianti

| # | Momento | Situazione | Quando | Varianti per voce e lingua |
| --- | --- | --- | --- | --- |
| 1 | Mattino | Ritorno dalla pausa | Primo giorno dopo la pausa generale | 3 |
| 2 | Mattino | Ritorno dopo assenza | 2 o più giorni senza aprire l'app | 3 |
| 3 | Mattino | Serie record | Ieri la serie dell'eroe ha superato il massimo | 5 |
| 4 | Mattino | Boss sconfitto | Ieri un boss è stato sconfitto (non in Essenziale) | 5 |
| 5 | Mattino | Giornata piena | Ieri tutte le missioni previste fatte | 5 |
| 6 | Mattino | Giornata parziale | Ieri almeno una missione, non tutte | 5 |
| 7 | Mattino | Giornata vuota | Ieri nessuna missione fatta; solo incoraggiamento | 5 |
| 8 | Mattino | Giorno di riposo | Ieri giorno di riposo | 3 |
| 9 | Mattino | Incoraggiamento per oggi | Seconda frase, dopo una delle situazioni 1–8 | 5 |
| 10 | Sera | Tutto fatto | Riepilogo serale, giornata completa | 5 |
| 11 | Sera | Mancano alcune missioni | Riepilogo serale con l'elenco (11.5) | 5 |
| 12 | Sera | Nessuna ancora fatta | Riepilogo serale, zero completamenti | 5 |

Le situazioni 3, 4, 5, 6, 7 hanno le 5 varianti chieste da US-COMP-05; 1, 2 e 8 sono nuove (approvate da Claudio il 12/11) e ne hanno 3 perché capitano di rado.

## Conteggio

Le frasi del mattino (1–9) hanno una variante per umore: felice, normale, triste (Claudio, 12/11). Quelle della sera no.

- Per voce e lingua: 39 × 3 umori = 117 frasi del mattino + 15 della sera = **132**.
- Per lingua: 132 × 5 voci = **660**.
- Totale: 660 × 5 lingue (it, en, de, fr, es) = **3.300 frasi**.

## Segnaposto ammessi

`{{eroe}}`, `{{compagno}}`, `{{fatte}}`, `{{previste}}`, `{{serie}}`, `{{boss}}`, `{{danno}}`, `{{giorni}}` (assenza o pausa), `{{mancanti}}` (sera, già formattato come in 11.5), `{{n}}` (missioni che mancano). Il lessico del tema (monete, vita, boss…) va preso da `lessico-v2.json`, non scritto a mano. Le frasi con un numero hanno le forme singolare e plurale di i18next (`_one`, `_other`).

## Regole di scrittura

- Al massimo 120 caratteri per frase in italiano; i numeri vanno tra `**` per il grassetto.
- Mai rimproveri, mai «hai mancato»: le situazioni 2, 7 e 12 invitano, come in 6.4 e 11.5.
- Situazione 4 e frasi con `{{danno}}` o monete non si usano in Essenziale.
- Chiavi: `racconto.<voce>.<situazione>.<umore>.<n>` al mattino, `racconto.<voce>.<situazione>.<n>` la sera, nei file di lessico per lingua.

## Ordine proposto

1. Italiano (660 frasi), da far scrivere in un thread a parte e far rivedere a Claudio.
2. Inglese, poi tedesco, francese e spagnolo in bozza (scelta minore 7 di `CLAUDE.md`).
3. Nel frattempo il task T91 lavora con una frase per situazione e voce in italiano e inglese.
