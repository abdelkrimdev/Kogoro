-- Drop anime_id, season from episodes; drop last_synced from episode_groups
-- Change episodes unique constraint from (anime_id, episode_number, season) to (group_id, episode_number)
-- SQLite does not support ALTER TABLE DROP COLUMN before 3.35.0.
-- Recreate tables without the dropped columns.

PRAGMA foreign_keys = OFF;
--> statement-breakpoint

-- Recreate episodes table without anime_id and season, with new unique constraint
CREATE TABLE `episodes_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`file_path` text NOT NULL,
	`title` text,
	`watched` integer DEFAULT false NOT NULL,
	`notes` text,
	FOREIGN KEY (`group_id`) REFERENCES `episode_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `episodes_new` (`id`, `group_id`, `episode_number`, `file_path`, `title`, `watched`, `notes`)
SELECT `id`, `group_id`, `episode_number`, `file_path`, `title`, `watched`, `notes` FROM `episodes`;
--> statement-breakpoint

DROP TABLE `episodes`;
--> statement-breakpoint

ALTER TABLE `episodes_new` RENAME TO `episodes`;
--> statement-breakpoint

CREATE UNIQUE INDEX `episodes_group_id_episode_number_unique` ON `episodes` (`group_id`, `episode_number`);
--> statement-breakpoint

-- Recreate episode_groups table without last_synced
CREATE TABLE `episode_groups_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anime_id` integer NOT NULL,
	`entry_type` text NOT NULL,
	`season_number` integer,
	`watch_status` text DEFAULT 'plan_to_watch' NOT NULL,
	`synopsis` text,
	`rating` real,
	`cover_art_path` text,
	`updated_at` text NOT NULL DEFAULT '',
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

INSERT INTO `episode_groups_new` (`id`, `anime_id`, `entry_type`, `season_number`, `watch_status`, `synopsis`, `rating`, `cover_art_path`, `updated_at`)
SELECT `id`, `anime_id`, `entry_type`, `season_number`, `watch_status`, `synopsis`, `rating`, `cover_art_path`, `updated_at` FROM `episode_groups`;
--> statement-breakpoint

DROP TABLE `episode_groups`;
--> statement-breakpoint

ALTER TABLE `episode_groups_new` RENAME TO `episode_groups`;
--> statement-breakpoint

CREATE UNIQUE INDEX `episode_groups_anime_id_entry_type_season_number_unique` ON `episode_groups` (`anime_id`, `entry_type`, `season_number`);
--> statement-breakpoint

PRAGMA foreign_keys = ON;
