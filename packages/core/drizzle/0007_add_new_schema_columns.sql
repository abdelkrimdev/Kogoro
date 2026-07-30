-- Add anidb_id, format, and updated_at columns to anime table
ALTER TABLE `anime` ADD COLUMN `anidb_id` text;
--> statement-breakpoint
ALTER TABLE `anime` ADD COLUMN `format` text;
--> statement-breakpoint
ALTER TABLE `anime` ADD COLUMN `updated_at` text NOT NULL DEFAULT '';
--> statement-breakpoint
-- Add updated_at column to episode_groups table
ALTER TABLE `episode_groups` ADD COLUMN `updated_at` text NOT NULL DEFAULT '';
--> statement-breakpoint
-- Add updated_at column to franchises table
ALTER TABLE `franchises` ADD COLUMN `updated_at` text NOT NULL DEFAULT '';
