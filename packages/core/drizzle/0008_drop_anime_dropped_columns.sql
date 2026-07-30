-- Drop episode_count, genres, library_state, last_synced, anilist_id from anime table
-- SQLite does not support ALTER TABLE DROP COLUMN before 3.35.0.
-- Recreate the anime table without the dropped columns.

PRAGMA foreign_keys = OFF;
--> statement-breakpoint

CREATE TABLE `anime_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`alternative_titles` text,
	`cover_art_path` text,
	`franchise_id` integer,
	`anidb_id` text,
	`format` text,
	`updated_at` text NOT NULL DEFAULT '',
	FOREIGN KEY (`franchise_id`) REFERENCES `franchises`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

INSERT INTO `anime_new` (`id`, `title`, `alternative_titles`, `cover_art_path`, `franchise_id`, `anidb_id`, `format`, `updated_at`)
SELECT `id`, `title`, `alternative_titles`, `cover_art_path`, `franchise_id`, `anidb_id`, `format`, `updated_at` FROM `anime`;
--> statement-breakpoint

DROP TABLE `anime`;
--> statement-breakpoint

ALTER TABLE `anime_new` RENAME TO `anime`;
--> statement-breakpoint

PRAGMA foreign_keys = ON;
