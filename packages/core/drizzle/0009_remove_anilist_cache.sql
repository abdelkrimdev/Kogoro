-- Drop anilist_cache table
DROP TABLE IF EXISTS `anilist_cache`;
--> statement-breakpoint

-- Drop anilist_id column and its unique index from franchises
DROP INDEX IF EXISTS `franchises_anilist_id_unique`;
--> statement-breakpoint
ALTER TABLE `franchises` DROP COLUMN `anilist_id`;
--> statement-breakpoint

-- Recreate anime_source_mappings with composite PK (anime_id, source)
-- SQLite does not support ALTER TABLE DROP PRIMARY KEY.
-- Recreate the table with the new schema, preserving existing data.

PRAGMA foreign_keys = OFF;
--> statement-breakpoint

CREATE TABLE `anime_source_mappings_new` (
	`anime_id` integer NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	PRIMARY KEY(`anime_id`, `source`),
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `anime_source_mappings_new` (`anime_id`, `source`, `external_id`)
SELECT `anime_id`, `source`, `external_id` FROM `anime_source_mappings`;
--> statement-breakpoint

DROP TABLE `anime_source_mappings`;
--> statement-breakpoint

ALTER TABLE `anime_source_mappings_new` RENAME TO `anime_source_mappings`;
--> statement-breakpoint

PRAGMA foreign_keys = ON;
