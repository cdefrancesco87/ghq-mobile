-- The event log is append-only (modello-dati.md, 4.3): an undo writes a new `event.reverted`
-- event and never changes or deletes the old one. Only «Elimina tutti i dati» removes the log,
-- by deleting the whole database file.
CREATE TRIGGER `events_no_update` BEFORE UPDATE ON `events`
BEGIN
  SELECT RAISE(ABORT, 'events is append-only: an event cannot be changed');
END;
--> statement-breakpoint
CREATE TRIGGER `events_no_delete` BEFORE DELETE ON `events`
BEGIN
  SELECT RAISE(ABORT, 'events is append-only: an event cannot be deleted');
END;
