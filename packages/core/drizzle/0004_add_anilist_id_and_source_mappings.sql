-- Add anilist_id column to anime table (nullable, unique)
ALTER TABLE `anime` ADD `anilist_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_anilist_id_unique` ON `anime` (`anilist_id`);
--> statement-breakpoint

-- Create anime_source_mappings table
CREATE TABLE `anime_source_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anime_id` integer NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_source_mappings_source_external_id` ON `anime_source_mappings` (`source`,`external_id`);
--> statement-breakpoint

-- Migrate existing (external_id, source_db) from anime into anime_source_mappings
INSERT OR IGNORE INTO `anime_source_mappings` (`anime_id`, `source`, `external_id`)
SELECT `id`, `source_db`, `external_id` FROM `anime` WHERE `external_id` IS NOT NULL AND `source_db` IS NOT NULL;
--> statement-breakpoint

-- Migrate existing anime_tracker_mappings rows into anime_source_mappings
INSERT OR IGNORE INTO `anime_source_mappings` (`anime_id`, `source`, `external_id`)
SELECT `anime_id`, `source`, `external_id` FROM `anime_tracker_mappings`;
