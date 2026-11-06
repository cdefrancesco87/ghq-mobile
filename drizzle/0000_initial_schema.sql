CREATE TABLE `app_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`params` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`seen_at` integer
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`badge_key` text PRIMARY KEY NOT NULL,
	`unlocked_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `boss` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'normal' NOT NULL,
	`difficulty` text NOT NULL,
	`stat_key` text,
	`hp_max` integer NOT NULL,
	`hp` integer NOT NULL,
	`deadline_day` text,
	`deadline_warned` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`defeated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `boss_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`boss_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`done_at` integer,
	FOREIGN KEY (`boss_id`) REFERENCES `boss`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `boss_steps_boss_idx` ON `boss_steps` (`boss_id`,`position`);--> statement-breakpoint
CREATE TABLE `companion` (
	`id` text PRIMARY KEY DEFAULT 'companion' NOT NULL,
	`name` text,
	`stage` text DEFAULT 'egg' NOT NULL,
	`completions_total` integer DEFAULT 0 NOT NULL,
	`hatched_at` integer
);
--> statement-breakpoint
CREATE TABLE `day_plan` (
	`game_day` text NOT NULL,
	`mission_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`game_day`, `mission_id`),
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "day_plan_max_three" CHECK("day_plan"."position" BETWEEN 0 AND 2)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_plan_slot` ON `day_plan` (`game_day`,`position`);--> statement-breakpoint
CREATE TABLE `day_summaries` (
	`game_day` text PRIMARY KEY NOT NULL,
	`scheduled_count` integer NOT NULL,
	`done_count` integer NOT NULL,
	`scheduled_xp` integer NOT NULL,
	`missed_xp` integer NOT NULL,
	`hp_lost` integer NOT NULL,
	`is_rest_day` integer NOT NULL,
	`full_day` integer NOT NULL,
	`plan_complete` integer NOT NULL,
	`shield_used` integer NOT NULL,
	`closed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`type` text NOT NULL,
	`v` integer DEFAULT 1 NOT NULL,
	`occurred_at` integer NOT NULL,
	`tz_offset` integer NOT NULL,
	`game_day` text NOT NULL,
	`source` text NOT NULL,
	`device_id` text NOT NULL,
	`mission_id` text,
	`boss_id` text,
	`item_key` text,
	`reverts_id` text,
	`idem_key` text,
	`d_xp` integer DEFAULT 0 NOT NULL,
	`d_coins` integer DEFAULT 0 NOT NULL,
	`d_hp` integer DEFAULT 0 NOT NULL,
	`d_stats` text,
	`payload` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_id_unique` ON `events` (`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_idem_key_unique` ON `events` (`idem_key`);--> statement-breakpoint
CREATE INDEX `events_day_idx` ON `events` (`game_day`);--> statement-breakpoint
CREATE INDEX `events_mission_idx` ON `events` (`mission_id`,`game_day`);--> statement-breakpoint
CREATE INDEX `events_type_idx` ON `events` (`type`,`game_day`);--> statement-breakpoint
CREATE TABLE `hero` (
	`id` text PRIMARY KEY DEFAULT 'hero' NOT NULL,
	`name` text NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`xp_in_level` integer DEFAULT 0 NOT NULL,
	`xp_total` integer DEFAULT 0 NOT NULL,
	`hp` integer DEFAULT 50 NOT NULL,
	`coins` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`streak_best` integer DEFAULT 0 NOT NULL,
	`exhausted_day` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "hero_coins_non_negative" CHECK("hero"."coins" >= 0)
);
--> statement-breakpoint
CREATE TABLE `hero_stats` (
	`stat_key` text PRIMARY KEY NOT NULL,
	`points` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`item_key` text PRIMARY KEY NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "inventory_shields_max" CHECK("inventory"."item_key" <> 'shield' OR "inventory"."quantity" <= 2)
);
--> statement-breakpoint
CREATE TABLE `mission_days` (
	`mission_id` text NOT NULL,
	`game_day` text NOT NULL,
	`status` text NOT NULL,
	`value` real,
	`skip_reason` text,
	`done_at` integer,
	`source` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`mission_id`, `game_day`),
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mission_days_day_idx` ON `mission_days` (`game_day`);--> statement-breakpoint
CREATE TABLE `mission_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`mission_id` text NOT NULL,
	`time` text,
	`lead_minutes` integer,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "mission_reminders_one_kind" CHECK(("mission_reminders"."time" IS NULL) <> ("mission_reminders"."lead_minutes" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `mission_reminders_mission_idx` ON `mission_reminders` (`mission_id`);--> statement-breakpoint
CREATE TABLE `missions` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`difficulty` text DEFAULT 'medium' NOT NULL,
	`frequency` text,
	`due_day` text,
	`goal_type` text DEFAULT 'none' NOT NULL,
	`goal_target` real,
	`goal_unit` text,
	`goal_step` real,
	`stat_primary` text,
	`stat_secondary` text,
	`boss_id` text,
	`category_key` text,
	`icon_key` text,
	`template_key` text,
	`health_metric` text,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`paused_until` text,
	`sort_order` real NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`streak_best` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`archived_at` integer,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`boss_id`) REFERENCES `boss`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "missions_stats_differ" CHECK("missions"."stat_secondary" IS NULL OR "missions"."stat_secondary" <> "missions"."stat_primary")
);
--> statement-breakpoint
CREATE INDEX `missions_status_idx` ON `missions` (`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `missions_boss_idx` ON `missions` (`boss_id`);--> statement-breakpoint
CREATE TABLE `scheduled_reminders` (
	`os_id` text PRIMARY KEY NOT NULL,
	`mission_id` text NOT NULL,
	`game_day` text NOT NULL,
	`fire_at` integer NOT NULL,
	`snooze_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`mission_id`) REFERENCES `missions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scheduled_reminders_mission_idx` ON `scheduled_reminders` (`mission_id`,`game_day`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
