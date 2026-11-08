# Lotto 5 · Schermate per tema · esito

08/11/2026 · controllo secondo `design/claude-design/04-controllo-consegne.md`

**Stato: fatta solo B2 (Oggi) nei 6 temi, in attesa di approvazione** (il prompt chiede di fermarsi dopo B2). Generato da codice (`../sorgenti/build5.py`), con i componenti del lotto 2 e gli asset dei lotti 3 e 4.

## B2 · Oggi

Tavole `tavole/B2-<tema>.html` e `.png`. Per ogni tema ci sono due frame: a sinistra lo schermo 390×844 come appare all'apertura; a destra la pagina intera scorsa, con una linea rossa dove finisce il primo schermo.

Contenuto (dati del brief): intestazione con data e saluto; scheda dell'eroe (compagno, nome, titolo, livello, vita 32/50, XP 320/500, serie 12, monete 245); Piano del giorno con 2 priorità e il posto vuoto; boss «Maratona» compatto (vita 100/160 con la parte protetta a righe, passi 3 di 8, 6 giorni, prossimo passo); missioni di oggi (una misurabile al 62%, due da fare, una fatta nel gruppo delle fatte).

Vesti per tema (v2 dell'08/11: ogni tema ha struttura visiva propria, non solo colori e font):
- **Arcade:** schermata da cabinato: righe 1UP, HI-SCORE e STAGE in alto, «PLAYER 1 · READY?», scheda HUD nera con cornice gialla e ombra dura, vita a cuori pixel, EXP a segmenti, COMBO e gettoni come contatori, sezioni con ▶ e puntini, «CLEAR!» al posto della spunta, stelle e scanline sullo sfondo.
- **Fantasy:** pergamena con grana e bordi bruniti, capolettera miniato nel saluto, compagno in un medaglione d'oro, nome su un nastro rosso, schede con doppio filetto e rombi agli angoli, titoli di sezione centrati tra due filetti, spunta come sigillo di ceralacca.
- **Cyberpunk:** schede ad angoli tagliati, griglia di fondo, titoli sdoppiati magenta e ciano, timestamp mono sulle fatte.
- **Lovecraft:** pagina di diario rigata con il margine rosso e la vignettatura, occhio inciso in alto, «Annotazione dell'8 novembre», sezioni numerate in romano (I., II., III.), voci tra due filetti con stelline agli angoli, compagno in un cerchio-sigillo, caselle tratteggiate, spunta come sigillo a stella.
- **Minimal chiaro e scuro:** stile svizzero: saluto grande in Display, anello del giorno in alto a destra, schede senza bordo con ombra leggera, titoli di sezione piccoli in maiuscolo, compagno a 40, barre sottili.

**Barra in basso:** 4 voci con il [+] al centro (Oggi, Abitudini, [+], Obiettivi, Profilo), decisione dell'08/11.
Barra in basso, una veste per tema (ridisegnata l'08/11):
- **Minimal:** barra a pillola che galleggia sopra il contenuto, con ombra morbida; voce attiva con l'icona in una pillola tenue; [+] tondo che sporge con alone.
- **Arcade:** barra nera con filo giallo in alto, etichette in maiuscolo, voce attiva con cornice pixel; [+] quadrato giallo con bordo bianco, ombra dura e base arancio.
- **Fantasy:** pergamena con filo d'oro e doppio filetto; voce attiva con rombo e sottolineatura; [+] come sigillo di ceralacca rosso in un anello d'oro.
- **Cyberpunk:** barra con staffe ciano agli angoli, etichette in maiuscolo, icona attiva con alone; [+] esagonale giallo con luce.
- **Lovecraft:** barra con vignettatura e filo dorato sfumato; voci spente più tenui, stellina sopra la voce attiva; [+] come sigillo con anello tratteggiato e luce verdastra.

## B3a–B10 (aggiunte l'08/11)

Schermate in `frame/` (un PNG per schermata e tema, es. `B4-fantasy.png`) e tavole per tema in `tavole/lotto5-<tema>.png`:
B3a Obiettivi, B3b Scheda del boss, B4 Abitudini, B5 Editor missione (mezza altezza), B6 Negozio, B7 Profilo, B8 Compagno, B9 Statistiche, B10 Widget (piccolo, medio, monocromo iPhone).

Contenuti inventati o semplificati:
- Titoli dell'eroe in B7 provvisori (Pro, Cavaliere, Runner, Studioso, Esperto).
- B6 mostra solo il gruppo Aiuti (pozione 50, scudo 300), senza regali né ricompense.
- B8: compagno nello stadio Cucciolo (2 di 3), umore Felice; B9: dati della heatmap di esempio.
- B5: etichette del bottone per tema (START, Accetta l'impresa, Firma il contratto, Incidi il rito, Salva).

## Controlli

- Solo componenti, colori e caratteri del lotto 2; sprite dei lotti 3 e 4. Misure come in `consegne/2/misure.md` (riga 64, priorità 72, controllo 48, barra 64 con il [+] rialzato).
- Etichette della barra in basso uguali in tutti i temi (Oggi, Abitudini, Obiettivi, Profilo); il resto usa il lessico del tema.
- Nel primo schermo si vedono scheda dell'eroe, Piano e l'inizio della scheda del boss (sprite, nome, barra); il prossimo passo e le missioni sono sotto, scorrendo.

## Note per Claudio

1. **Titoli dell'eroe provvisori:** Rookie, Scudiero, Netrunner, Detective; in Minimal solo «Livello 7». L'elenco dei titoli (uno ogni 5 livelli, per tema) è ancora da definire.
2. **Saluti e testi di contorno inventati da me:** «PLAYER 1 · READY?», «Salve, Claudio», «Online, Claudio», «Ancora sveglio, Claudio?», «Ciao, Claudio»; in Arcade HI-SCORE e STAGE sono decorativi.
3. **Boss in Minimal:** Minimal non ha sprite dei boss, quindi uso l'icona a linea del boss in un cerchio tenue.
