ALTER TABLE `boss` ADD `is_main` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `boss` ADD `chain_prev_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `boss_main_idx` ON `boss` (`is_main`) WHERE "boss"."is_main" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX `boss_chain_prev_idx` ON `boss` (`chain_prev_id`) WHERE "boss"."chain_prev_id" IS NOT NULL;