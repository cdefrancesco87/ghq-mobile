# GHQ Mobile – Modello dati e schema del database

*Versione del 30/10/2026, con le 4 scelte decise da Claudio. Si basa su «GHQ Mobile – Analisi funzionale v3», «GHQ Mobile – Stack tecnologico (definitivo)» e «GHQ Mobile – Design delle sezioni». Criteri di Claudio: semplice da mantenere, compatibile con altri sistemi per integrazioni future, scalabile.*

## Riepilogo delle scelte

| # | Scelta | Decisione | Stato |
| --- | --- | --- | --- |
| 1 | Stato dell'eroe e registro | Tabelle con lo stato corrente più un registro degli eventi in sola aggiunta, scritti nella stessa transazione | Deciso da Claudio il 30/10 |
| 2 | Identificativi | UUID v7 in testo | Deciso da Claudio il 30/10 |
| 3 | Formato della frequenza | Un campo JSON tipizzato con TypeScript e Zod | Deciso da Claudio il 30/10 |
| 4 | Eliminazione di una missione | Cancellazione logica: la missione resta nel database con `deleted_at`, sparisce dall'app e resta ritrovabile nello storico | Deciso da Claudio il 30/10 |
| 5 | Date e ore | Giorno di gioco come testo `AAAA-MM-GG`, istanti in millisecondi UTC più fuso | Deciso da Claude, motivato sotto |
| 6 | Contenuti fissi | Negozio, badge, modelli, titoli e temi nel codice (JSON versionato), non nel database | Deciso da Claude, motivato sotto |
| 7 | Impostazioni | Nel database, tabella chiave-valore validata con Zod | Deciso da Claude, motivato sotto |

## 1. Principi

- **Il database contiene solo i dati dell'utente.** Tutto ciò che è uguale per tutti (articoli del negozio, badge, modelli di missione, titoli, temi, lessico) vive nel codice come JSON tipizzato e si aggiorna con l'app. Nel database ci sono solo le chiavi (`item_key = 'potion'`). Così un nuovo badge non richiede una migrazione.
- **Ogni azione di gioco è una transazione unica**: aggiorna le tabelle di stato e aggiunge una riga al registro. Se una delle due scritture fallisce, non succede niente.
- **Le regole non stanno nel database.** XP, danni, serie, vita e statistiche sono calcolati dalle funzioni pure in TypeScript (la cartella `rules/` dello stack); il database salva il risultato. Niente trigger con logica di gioco.
- **I valori del passato non si ricalcolano.** Ogni evento salva le variazioni effettive (XP, monete, vita, punti statistica) al momento in cui è avvenuto. Cambiare la difficoltà di una missione vale solo dai completamenti successivi, come chiede US-EDT-02.
- **Nomi in inglese, `snake_case` nel database e `camelCase` in TypeScript.** È la convenzione più diffusa e rende lo schema leggibile da chiunque, anche in un colloquio o in un'integrazione.
- **Idempotenza.** Ogni scrittura che può arrivare due volte (app, notifica, widget, salute) ha una chiave unica: la seconda volta non cambia niente.

## 2. Mappa delle entità

```
hero (1) ─── hero_stats (6)
companion (1)
settings (chiave → valore)

boss ──< boss_steps
  │
  └──< missions ──< mission_reminders
          │
          ├──< mission_days        (un giorno di una missione: fatta, parziale, saltata)
          └──< day_plan            (le 3 priorità del giorno)

day_summaries                      (chiusura di ogni giorno di gioco)
inventory   (articolo → quantità)
badges      (badge sbloccati)
trophies    = boss con stato «sconfitto»
app_notifications                  (notifiche in app, bollino del widget)
scheduled_reminders                (notifiche programmate nel sistema)

events  ◄── registro in sola aggiunta, riferisce mission, boss, articoli
```

Le frecce `──<` sono relazioni uno-a-molti. «(1)» indica una tabella con una sola riga (singleton): l'app ha un solo eroe e un solo compagno; se un giorno servissero più profili basta aggiungere una colonna `profile_id`.

## 3. Entità e campi

### 3.1 Eroe (`hero`, una riga)

| Campo | Tipo | Note |
| --- | --- | --- |
| `id` | testo | sempre `'hero'` |
| `name` | testo | obbligatorio al Primo avvio |
| `level` | intero | da 1 a 50 |
| `xp_in_level` | intero | XP verso il livello successivo |
| `xp_total` | intero | XP totali guadagnati, utile per i controlli |
| `hp` | intero | da 0 a 50 |
| `coins` | intero | mai negativo (`CHECK`) |
| `streak` / `streak_best` | intero | serie dell'eroe e record |
| `exhausted_day` | testo o nullo | giorno di gioco in cui è «esausto» (metà XP) |
| `created_at` / `updated_at` | intero (ms) | |

`hero_stats` ha 6 righe, una per statistica (`strength`, `constitution`, `intelligence`, `wisdom`, `charisma`, `discipline`), con `points` totali. Il livello di ogni statistica non si salva: si calcola dai punti con la formula 100 × (n+1). La freccia di forma si calcola dal registro (punti degli ultimi 30 giorni contro i 30 precedenti).

### 3.2 Compagno (`companion`, una riga)

`name` (nullo = nome predefinito del tema), `stage` (`egg`, `baby`, `adult`, e in futuro il quarto), `completions_total`, `hatched_at`. L'umore **non si salva**: si calcola dagli ultimi 3 giorni in `day_summaries`, più l'eventuale regalo del giorno (dal registro). I cosmetici, quando arriveranno, avranno una tabella propria.

### 3.3 Missione (`missions`)

| Campo | Tipo | Note |
| --- | --- | --- |
| `id` | testo (UUID v7) | |
| `kind` | `habit` · `task` | abitudine ricorrente o attività singola |
| `name` | testo | |
| `difficulty` | `easy` · `medium` · `hard` | |
| `frequency` | JSON | vedi 3.4; nullo per le attività singole |
| `due_day` | testo o nullo | scadenza dell'attività singola |
| `goal_type` | `none` · `quantity` · `duration` | |
| `goal_target` | reale o nullo | es. 2 (litri), 20 (pagine), 10 (minuti) |
| `goal_unit` | testo o nullo | chiave dell'unità (`liter`, `page`, `minute`) |
| `goal_step` | reale o nullo | incremento del tocco singolo (es. 0,25 L) |
| `stat_primary` / `stat_secondary` | testo o nullo | chiavi delle statistiche, diverse tra loro (`CHECK`) |
| `boss_id` | testo o nullo | FK a `boss`, una sola alla volta |
| `category_key` / `icon_key` | testo o nullo | |
| `template_key` | testo o nullo | modello d'origine |
| `health_metric` | testo o nullo | `steps`, `active_minutes`, `sleep_hours` |
| `notes` | testo o nullo | |
| `status` | `active` · `paused` · `archived` | |
| `paused_until` | testo o nullo | giorno di fine pausa |
| `sort_order` | reale | riordino manuale; un reale permette di inserire tra due righe senza rinumerare |
| `streak` / `streak_best` | intero | serie della missione |
| `completed_at` | intero o nullo | per le attività singole: dopo 7 giorni passano in archivio |
| `created_at` / `updated_at` / `archived_at` | intero (ms) | |
| `deleted_at` | intero o nullo | cancellazione logica, vedi 4.5 |

`mission_reminders`: `id`, `mission_id`, `time` (`HH:MM`) per le abitudini oppure `lead_minutes` (0, 5, 15, 30) per le attività singole.

### 3.4 Frequenza

Un JSON con un campo `type` che dice quale forma ha il resto (in TypeScript si chiama «unione discriminata», ed è validata con Zod a ogni lettura e scrittura):

```ts
type Frequency =
  | { type: 'daily' }
  | { type: 'weekdays'; days: Weekday[] }            // 1 = lunedì … 7 = domenica
  | { type: 'times_per_week'; times: number }        // appare ogni giorno finché non raggiunge il numero
  | { type: 'every_n_days'; n: number; from: GameDay }
  | { type: 'monthly'; day: number }                 // 1–31, l'ultimo giorno se il mese è più corto
  | { type: 'yearly'; month: number; day: number };
```

La funzione pura `isScheduled(frequency, day, history)` decide se una missione è prevista in un giorno.

### 3.5 Giorno della missione (`mission_days`)

Una riga per missione e giorno di gioco in cui è successo qualcosa. È la tabella che usano Oggi, la heatmap, le serie e il dettaglio della missione.

| Campo | Tipo | Note |
| --- | --- | --- |
| `mission_id` + `game_day` | chiave primaria | garantisce un solo stato al giorno per missione |
| `status` | `done` · `partial` · `skipped` | |
| `value` | reale o nullo | valore accumulato per le misurabili |
| `skip_reason` | testo o nullo | |
| `done_at` | intero o nullo | ora del completamento, mostrata in Oggi |
| `source` | `app` · `notification` · `widget` · `health` · `backfill` | origine del completamento |
| `updated_at` | intero (ms) | |

L'annullamento cancella la riga (o riporta `value` al valore precedente) e il registro ne conserva la traccia. I giorni previsti e non fatti **non** hanno una riga: si deducono dalla frequenza alla chiusura del giorno, che ne salva il risultato in `day_summaries`.

### 3.6 Piano del giorno (`day_plan`)

`game_day`, `mission_id`, `position` (0–2). Chiave primaria su (`game_day`, `mission_id`) e unicità su (`game_day`, `position`): una quarta priorità è impossibile già nel database. Il piano «si azzera» da solo, perché il giorno nuovo non ha righe.

### 3.7 Riepilogo del giorno (`day_summaries`)

Una riga per giorno di gioco chiuso, scritta dalla funzione di cambio giornata.

`game_day` (chiave), `scheduled_count`, `done_count`, `scheduled_xp`, `missed_xp`, `hp_lost`, `is_rest_day`, `full_day` (bonus dato), `plan_complete`, `shield_used`, `is_paused` (giorno di pausa generale, 12/11), `closed_at`.

Serve a tre cose: rende la chiusura idempotente (un giorno già chiuso non si richiude, anche dopo giorni senza aprire l'app), alimenta la heatmap con una query semplice, e dà all'umore del compagno gli ultimi 3 giorni.

### 3.8 Boss (`boss`) e passi (`boss_steps`)

`boss`: `id`, `name`, `difficulty`, `stat_key`, `hp_max` (passi × 20), `hp`, `deadline_day`, `deadline_warned` (avviso a 3 giorni già mandato), `status` (`active`, `defeated`, `archived`), `defeated_at`, `kind` (`normal`, `starter` per la quest di partenza), `deleted_at` (cancellazione logica, scelta minore 21 del 14/11; le query filtrano `deleted_at IS NULL`), `created_at`, `updated_at`. Un indice parziale e un controllo nel codice impediscono più di 3 boss attivi.

`boss_steps`: `id`, `boss_id`, `position`, `title`, `done_at`. La Sala dei trofei è semplicemente `boss` con `status = 'defeated'`, ordinata per `defeated_at`.

### 3.9 Inventario, badge e notifiche

- `inventory`: `item_key` (chiave), `quantity`. Il limite di 2 scudi è un `CHECK`.
- `badges`: `badge_key` (chiave), `unlocked_at`. Le condizioni e i premi stanno nel codice.
- `rewards` (Should dal 12/11): `id`, `name`, `size`, `created_at`, `archived_at`; i riscatti sono eventi nel registro, con nome e prezzo copiati nell'evento. Nessun limite al numero.
- `app_notifications`: `id`, `kind`, `params` (JSON), `created_at`, `seen_at`. Alimentano il bollino del widget piccolo e il foglio «Notifiche recenti».
- `scheduled_reminders`: `os_id` (identificativo della notifica nel sistema), `mission_id`, `game_day`, `fire_at`, `snooze_count`. Serve per cancellare i promemoria di una missione completata (US-NOT-03), contare i posticipi (massimo 3) e riprogrammare entro il limite iOS di 64.

### 3.10 Impostazioni (`settings`)

Tabella chiave-valore: `key`, `value` (JSON), `updated_at`. Ogni chiave ha uno schema Zod nel codice (`language`, `theme`, `game_mode`, `day_change`, `week_start`, `rest_days`, `quiet_hours`, `evening_summary`, `reduce_motion`, `colorblind`, `backup`, `general_pause` = `{ from_day, until_day | null }` della pausa in corso o programmata, `null` senza pausa (12/11; `until_day` compreso), `tale` = `{ shown_day, last_open_day, recent }` per il fumetto del mattino…). I cambi della giornata valgono da domani (scelta 10.4 del design): la chiave `day_change` contiene sia il valore attuale sia `{ next, from_day }`.

Perché nel database e non in MMKV: un solo file da salvare nel backup e da ripristinare, e lo store Zustand delle impostazioni si carica da qui all'avvio.

## 4. Registro degli eventi (`events`)

### 4.1 Struttura

| Campo | Tipo | Note |
| --- | --- | --- |
| `id` | testo (UUID v7) | ordinabile nel tempo |
| `seq` | intero autoincrementale | ordine di scrittura sul dispositivo |
| `type` | testo | es. `mission.completed`, vedi 4.2 |
| `v` | intero | versione del formato di quel tipo di evento |
| `occurred_at` | intero (ms UTC) | |
| `tz_offset` | intero (minuti) | fuso al momento dell'evento |
| `game_day` | testo | giorno di gioco a cui l'evento appartiene |
| `source` | `app` · `notification` · `widget` · `health` · `system` · `backfill` | |
| `device_id` | testo | generato all'installazione, serve alla sincronizzazione futura |
| `mission_id` / `boss_id` / `item_key` | nullo o riferimento | per filtrare il Quest Log |
| `reverts_id` | testo o nullo | evento annullato da questo |
| `idem_key` | testo, unico | chiave di idempotenza (es. `notif:<os_id>`) |
| `d_xp` / `d_coins` / `d_hp` | intero | variazioni, positive o negative |
| `d_stats` | JSON o nullo | es. `{ "strength": 20, "wisdom": 6 }` |
| `payload` | JSON | dettagli propri del tipo |

### 4.2 Tipi di evento

| Gruppo | Tipi |
| --- | --- |
| Missioni | `mission.created`, `mission.updated`, `mission.paused`, `mission.resumed`, `mission.archived`, `mission.restored`, `mission.deleted` |
| Completamenti | `mission.completed`, `mission.progressed` (valore parziale), `mission.skipped`, `mission.backfilled`, `event.reverted` (annulla) |
| Giornata | `day.closed` (vita persa, scudo usato), `bonus.full_day`, `bonus.plan`, `pause.started`, `pause.ended` (giorni di pausa, scadenze dei boss spostate; `cancelled: true` se annullata prima dell'inizio), `pause.changed` (data di fine cambiata durante la pausa, con la vecchia e la nuova data) |
| Boss | `boss.created`, `boss.step_done`, `boss.damaged`, `boss.defeated`, `boss.deadline_missed` (monete rubate), `boss.archived`, `boss.updated` (nome, passi aggiunti, tolti, riordinati; con `hp_max` prima e dopo), `boss.deleted` |
| Eroe e compagno | `hero.level_up`, `hero.exhausted`, `hero.renamed`, `companion.stage_up`, `companion.gift` |
| Negozio | `item.bought`, `item.used`, `shield.consumed`, `reward.redeemed`, `badge.unlocked`; lo scudo della vittoria sta nei delta di `boss.defeated` |

### 4.3 Regole

- **Sola aggiunta**: due trigger SQLite rifiutano ogni `UPDATE` e `DELETE` sulla tabella. Nessuna riga si cancella, nemmeno eliminando una missione; l'unica eccezione è «Elimina tutti i dati», che cancella l'intero file.
- **Annullare** non cancella: scrive un evento `event.reverted` con le variazioni opposte e `reverts_id`. Il Quest Log mostra entrambi o li nasconde in coppia.
- **Ricostruzione**: la somma di `d_xp`, `d_coins`, `d_hp` e `d_stats` dà sempre i valori di `hero` e `hero_stats`. Un test Jest lo verifica su partite simulate, e l'app ha una funzione di riparazione che ricalcola l'eroe dal registro.
- **Compatibilità**: la forma dell'evento ricalca lo standard CloudEvents (`id`, `type`, `source`, `time`, `data`), quindi esportarlo verso un altro sistema o un server richiede solo di rinominare i campi.
- **Versioni**: se il formato di un tipo cambia, `v` sale e una funzione «upcaster» converte i vecchi eventi in lettura. I vecchi eventi non si riscrivono mai.

### 4.4 Esempio: completare «Bevi 2 L» dalla notifica

Una sola transazione:

1. Inserisce l'evento `mission.completed` con `idem_key = 'notif:abc123'`. Se la chiave esiste già, si ferma qui: il completamento era già stato contato.
2. Aggiorna `mission_days` (`status = 'done'`, `value = 2`, `source = 'notification'`).
3. Aggiorna `hero` (XP, monete, vita +1), `hero_stats`, `companion.completions_total`, la serie della missione e il `boss` collegato.
4. Cancella le righe di `scheduled_reminders` di quella missione e quel giorno; fuori dalla transazione annulla le notifiche nel sistema.

### 4.5 Eliminazione di una missione (cancellazione logica)

Deciso da Claudio il 30/10: eliminare una missione non cancella nessuna riga.

1. La missione riceve `deleted_at` e sparisce da Oggi, Abitudini, Statistiche e dal Quest Log. Tutte le query delle schermate filtrano `deleted_at IS NULL` (in Drizzle con una funzione condivisa `notDeleted(missions)`, così non ci si dimentica).
2. I promemoria e le notifiche programmate della missione si cancellano davvero, perché sono solo configurazione del sistema; le righe di `day_plan` future si tolgono.
3. `mission_days` ed eventi restano intatti: XP, monete e statistiche dell'eroe non cambiano e la somma del registro coincide sempre con l'eroe.
4. Si aggiunge un evento `mission.deleted`. Annullare l'eliminazione (se un giorno lo esporremo) è semplicemente `deleted_at = NULL` più un evento `mission.restored`.

**Da decidere più avanti**: se e dove mostrare le missioni eliminate (per esempio un filtro «Eliminate» nel Registro o un cestino nelle Impostazioni). Il database lo permette già, quindi la scelta non richiede migrazioni.

**Effetti sull'analisi**: US-ABI-03 oggi dice che l'eliminazione definitiva «cancella anche lo storico» e va aggiornata: l'eliminazione nasconde la missione e il suo storico dalle schermate, ma i dati restano sul telefono. Per la privacy resta «Elimina tutti i dati» (US-IMP-05), che cancella davvero tutto. Il backup contiene anche le missioni eliminate.

## 5. Date, ore e giorno di gioco

- **Giorno di gioco** (`game_day`): testo `AAAA-MM-GG` calcolato con il fuso del telefono e l'orario di cambio giornata (un completamento all'1:00 con cambio alle 6:00 vale per il giorno prima). È la chiave di quasi tutto: Oggi, piano, serie, heatmap.
- **Istanti**: interi in millisecondi UTC, più `tz_offset` negli eventi. Ordinabili, compatti e senza ambiguità.
- **Cambio di fuso**: si confronta il giorno di gioco, non le ore trascorse, quindi un volo non crea giorni mancati falsi. La chiusura dei giorni processa solo i giorni interi passati tra l'ultimo `day_summaries` e oggi.

## 6. Schema Drizzle (bozza)

File `src/db/schema.ts`. Un estratto delle tabelle principali; le altre seguono lo stesso modello.

```ts
import { sqliteTable, text, integer, real, primaryKey, uniqueIndex, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { Frequency } from '@/rules/frequency';

const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
};

export const hero = sqliteTable('hero', {
  id: text('id').primaryKey().default('hero'),
  name: text('name').notNull(),
  level: integer('level').notNull().default(1),
  xpInLevel: integer('xp_in_level').notNull().default(0),
  xpTotal: integer('xp_total').notNull().default(0),
  hp: integer('hp').notNull().default(50),
  coins: integer('coins').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  streakBest: integer('streak_best').notNull().default(0),
  exhaustedDay: text('exhausted_day'),
  ...timestamps,
}, (t) => [check('coins_non_negative', sql`${t.coins} >= 0`)]);

export const boss = sqliteTable('boss', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['normal', 'starter'] }).notNull().default('normal'),
  difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }).notNull(),
  statKey: text('stat_key'),
  hpMax: integer('hp_max').notNull(),
  hp: integer('hp').notNull(),
  deadlineDay: text('deadline_day'),
  deadlineWarned: integer('deadline_warned', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: ['active', 'defeated', 'archived'] }).notNull().default('active'),
  defeatedAt: integer('defeated_at'),
  ...timestamps,
});

export const missions = sqliteTable('missions', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['habit', 'task'] }).notNull(),
  name: text('name').notNull(),
  difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }).notNull().default('medium'),
  frequency: text('frequency', { mode: 'json' }).$type<Frequency>(),
  dueDay: text('due_day'),
  goalType: text('goal_type', { enum: ['none', 'quantity', 'duration'] }).notNull().default('none'),
  goalTarget: real('goal_target'),
  goalUnit: text('goal_unit'),
  goalStep: real('goal_step'),
  statPrimary: text('stat_primary'),
  statSecondary: text('stat_secondary'),
  bossId: text('boss_id').references(() => boss.id, { onDelete: 'set null' }),
  categoryKey: text('category_key'),
  iconKey: text('icon_key'),
  templateKey: text('template_key'),
  healthMetric: text('health_metric'),
  notes: text('notes'),
  status: text('status', { enum: ['active', 'paused', 'archived'] }).notNull().default('active'),
  pausedUntil: text('paused_until'),
  sortOrder: real('sort_order').notNull(),
  streak: integer('streak').notNull().default(0),
  streakBest: integer('streak_best').notNull().default(0),
  completedAt: integer('completed_at'),
  archivedAt: integer('archived_at'),
  deletedAt: integer('deleted_at'),
  ...timestamps,
}, (t) => [
  index('missions_status_idx').on(t.status, t.sortOrder),
  index('missions_boss_idx').on(t.bossId),
  check('stats_differ', sql`${t.statSecondary} IS NULL OR ${t.statSecondary} <> ${t.statPrimary}`),
]);

export const missionDays = sqliteTable('mission_days', {
  missionId: text('mission_id').notNull().references(() => missions.id, { onDelete: 'cascade' }),
  gameDay: text('game_day').notNull(),
  status: text('status', { enum: ['done', 'partial', 'skipped'] }).notNull(),
  value: real('value'),
  skipReason: text('skip_reason'),
  doneAt: integer('done_at'),
  source: text('source', { enum: ['app', 'notification', 'widget', 'health', 'backfill'] }).notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (t) => [
  primaryKey({ columns: [t.missionId, t.gameDay] }),
  index('mission_days_day_idx').on(t.gameDay),
]);

export const dayPlan = sqliteTable('day_plan', {
  gameDay: text('game_day').notNull(),
  missionId: text('mission_id').notNull().references(() => missions.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
}, (t) => [
  primaryKey({ columns: [t.gameDay, t.missionId] }),
  uniqueIndex('day_plan_slot').on(t.gameDay, t.position),
  check('max_three', sql`${t.position} BETWEEN 0 AND 2`),
]);

export const events = sqliteTable('events', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  type: text('type').notNull(),
  v: integer('v').notNull().default(1),
  occurredAt: integer('occurred_at').notNull(),
  tzOffset: integer('tz_offset').notNull(),
  gameDay: text('game_day').notNull(),
  source: text('source').notNull(),
  deviceId: text('device_id').notNull(),
  missionId: text('mission_id'),
  bossId: text('boss_id'),
  itemKey: text('item_key'),
  revertsId: text('reverts_id'),
  idemKey: text('idem_key').unique(),
  dXp: integer('d_xp').notNull().default(0),
  dCoins: integer('d_coins').notNull().default(0),
  dHp: integer('d_hp').notNull().default(0),
  dStats: text('d_stats', { mode: 'json' }).$type<Partial<Record<StatKey, number>>>(),
  payload: text('payload', { mode: 'json' }).notNull().default('{}'),
}, (t) => [
  index('events_day_idx').on(t.gameDay),
  index('events_mission_idx').on(t.missionId, t.gameDay),
  index('events_type_idx').on(t.type, t.gameDay),
]);
```

Nota per chi viene da Angular: `sqliteTable` somiglia a una classe entità di TypeORM, ma è un semplice oggetto. Drizzle ne ricava i tipi TypeScript (`typeof missions.$inferSelect`), quindi l'interfaccia `Mission` non si scrive mai a mano.

Le chiavi esterne (`references`) funzionano solo con `PRAGMA foreign_keys = ON`, che l'app imposta all'apertura insieme a `PRAGMA journal_mode = WAL` (scritture più veloci e letture che non si bloccano a vicenda).

## 7. Accesso ai dati nel codice

```
src/db/
  schema.ts          tabelle Drizzle
  client.ts          apertura del database, PRAGMA, migrazioni
  repositories/      una funzione per azione di gioco: completeMission, undoEvent, closeDays, buyItem…
src/rules/           funzioni pure: calcolano le variazioni, non toccano il database
```

Una schermata non scrive mai direttamente nelle tabelle: chiama un'azione del repository, che chiede alle regole le variazioni, apre la transazione, scrive stato ed evento. Le liste si leggono con `useLiveQuery` di Drizzle e si aggiornano da sole. Lo store Zustand tiene solo ciò che serve ovunque (eroe, tema, impostazioni) e si rinfresca dopo ogni azione. È lo stesso schema di un servizio Angular che fa da unico punto d'accesso al backend.

Lo stesso codice del repository gira nell'app, nel task delle notifiche, nel widget e nella lettura dei dati di salute: è questo che garantisce che un completamento valga uguale da ovunque arrivi.

## 8. Migrazioni

- **Generazione**: si modifica `schema.ts` e si lancia `npx drizzle-kit generate`, che scrive un file SQL numerato in `drizzle/` (es. `0003_add_rewards.sql`). I file si versionano su Git e non si modificano mai dopo un rilascio.
- **Applicazione**: all'avvio, prima di mostrare qualsiasi schermata, `migrate()` di `drizzle-orm/expo-sqlite/migrator` applica le migrazioni mancanti e le registra nella tabella `__drizzle_migrations`. Il task delle notifiche e il widget aspettano la stessa funzione.
- **Copia di sicurezza**: prima di applicare una migrazione l'app copia il file del database; se la migrazione fallisce, ripristina la copia e mostra un errore invece di partire con dati a metà.
- **Backup e ripristino**: il file di backup porta la versione dello schema. Un backup più vecchio si ripristina e poi si migra; uno più nuovo dell'app viene rifiutato con l'invito ad aggiornarla.
- **Modifiche che SQLite non sa fare** (togliere una colonna con vincoli, cambiare un tipo): drizzle-kit genera la sequenza «crea tabella nuova, copia, rinomina». Va riletta a mano prima del commit.
- **Dati di partenza**: niente seed nel database; profilo, compagno e quest di partenza si creano con le normali azioni del repository al Primo avvio, così finiscono anche nel registro.
- **Test**: in Jest lo stesso schema gira su better-sqlite3; un test applica tutte le migrazioni da zero e un altro parte da un database di esempio della versione precedente.

## 9. Scalabilità e prestazioni

- **Volumi**: con 10 missioni al giorno si scrivono circa 20–30 eventi e 10 righe di `mission_days` al giorno, cioè meno di 15.000 righe l'anno. SQLite regge milioni di righe; gli indici su `game_day` e `mission_id` bastano per Oggi, heatmap e dettaglio.
- **Heatmap di 12 mesi**: una query su `day_summaries`, 365 righe.
- **Oggi entro 300 ms**: la transazione di completamento tocca 5–6 righe; l'interfaccia si aggiorna subito in modo ottimistico e `useLiveQuery` conferma.
- **Se il registro crescesse molto** (anni di uso): si possono aggiungere istantanee periodiche dell'eroe, senza cambiare il formato degli eventi.

## 10. Integrazioni e sincronizzazione futura

- **Formato aperto**: un unico file SQLite che qualsiasi strumento apre (DB Browser for SQLite, Python, Excel tramite ODBC).
- **Esportazione CSV**: missioni e registro, con la frequenza descritta in testo leggibile.
- **Server futuro**: Drizzle supporta PostgreSQL con quasi lo stesso schema. UUID v7, `device_id`, `updated_at` e il registro in sola aggiunta sono i mattoni di una sincronizzazione: ogni dispositivo invia i propri eventi, il server li ordina per `occurred_at` e gli altri li applicano con le stesse regole. Non serve nulla di tutto questo oggi, ma lo schema non lo impedisce.
- **Salute, widget, smartwatch**: scrivono attraverso lo stesso repository con la loro `source`; il widget legge un'istantanea separata scritta dall'app nello spazio condiviso, non il database.

## 11. Prossimi passi

1. Scrivere `schema.ts` completo e la prima migrazione nel progetto Expo.
2. Scrivere i test delle regole (XP, serie, vita, boss, statistiche, cambio giornata) e del repository `completeMission` / `undoEvent` / `closeDays`.
3. Test di ricostruzione: partita simulata di 90 giorni, poi confronto tra eroe salvato e somma del registro.
4. ~~Aggiornare US-ABI-03 nell'analisi funzionale con la cancellazione logica.~~ Fatto il 06/11.
