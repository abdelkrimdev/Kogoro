-- Contract phase: remove legacy (external_id, source_db) identity from anime table
-- Source references now live exclusively in anime_source_mappings (populated in 0004)

-- Drop the UNIQUE(external_id, source_db) index
DROP INDEX IF EXISTS `anime_external_id_source_db_unique`;
--> statement-breakpoint

-- SQLite does not support ALTER TABLE DROP COLUMN before 3.35.0.
-- Recreate the anime table without external_id and source_db columns.
PRAGMA foreign_keys = OFF;
--> statement-breakpoint

CREATE TABLE `anime_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`alternative_titles` text,
	`episode_count` integer DEFAULT 0 NOT NULL,
	`cover_art_path` text,
	`genres` text,
	`library_state` text DEFAULT 'not_on_disk' NOT NULL,
	`franchise_id` integer,
	`last_synced` text NOT NULL,
	`anilist_id` text,
	FOREIGN KEY (`franchise_id`) REFERENCES `franchises`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

INSERT INTO `anime_new` (`id`, `title`, `alternative_titles`, `episode_count`, `cover_art_path`, `genres`, `library_state`, `franchise_id`, `last_synced`, `anilist_id`)
SELECT `id`, `title`, `alternative_titles`, `episode_count`, `cover_art_path`, `genres`, `library_state`, `franchise_id`, `last_synced`, `anilist_id` FROM `anime`;
--> statement-breakpoint

DROP TABLE `anime`;
--> statement-breakpoint

ALTER TABLE `anime_new` RENAME TO `anime`;
--> statement-breakpoint

CREATE UNIQUE INDEX `anime_anilist_id_unique` ON `anime` (`anilist_id`);
--> statement-breakpoint

PRAGMA foreign_keys = ON;
--> statement-breakpoint

-- Drop the anime_tracker_mappings table (rows already migrated to anime_source_mappings in 0004)
DROP TABLE IF EXISTS `anime_tracker_mappings`;
