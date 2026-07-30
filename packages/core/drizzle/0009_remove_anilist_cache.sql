-- Drop anilist_cache table
DROP TABLE IF EXISTS `anilist_cache`;
--> statement-breakpoint

-- Drop anilist_id column and its unique index from franchises
DROP INDEX IF EXISTS `franchises_anilist_id_unique`;
--> statement-breakpoint
ALTER TABLE `franchises` DROP COLUMN `anilist_id`;
--> statement-breakpoint

-- Recreate anime_source_mappings with composite PK (anime_id, source)
-- First drop the old unique index
DROP INDEX IF EXISTS `anime_source_mappings_source_external_id`;
--> statement-breakpoint

-- Drop and recreate the table with new schema
DROP TABLE IF EXISTS `anime_source_mappings`;
--> statement-breakpoint

CREATE TABLE `anime_source_mappings` (
	`anime_id` integer NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	PRIMARY KEY(`anime_id`, `source`),
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade
);
