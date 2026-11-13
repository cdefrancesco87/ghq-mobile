CREATE TABLE `rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`size` text NOT NULL,
	`created_at` integer NOT NULL,
	`archived_at` integer,
	CONSTRAINT "rewards_size_known" CHECK("rewards"."size" IN ('small', 'medium', 'large', 'epic'))
);
--> statement-breakpoint
CREATE INDEX `rewards_active_idx` ON `rewards` (`created_at`) WHERE "rewards"."archived_at" IS NULL;