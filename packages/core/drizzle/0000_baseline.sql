CREATE TABLE IF NOT EXISTS `anime` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`source_db` text NOT NULL,
	`title` text NOT NULL,
	`title_japanese` text,
	`entry_type` text DEFAULT 'tv' NOT NULL,
	`episode_count` integer DEFAULT 0 NOT NULL,
	`cover_art_path` text,
	`last_synced` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `anime_external_id_source_db_unique` ON `anime` (`external_id`, `source_db`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anime_id` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`file_path` text NOT NULL,
	`title` text,
	`season` integer DEFAULT 1,
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `episodes_anime_id_episode_number_season_unique` ON `episodes` (`anime_id`, `episode_number`, `season`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `watch_status` (
	`episode_id` integer PRIMARY KEY NOT NULL,
	`watched` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `matches` (
	`hash` text PRIMARY KEY NOT NULL,
	`anime_id` text NOT NULL,
	`anime_title` text,
	`episode_id` text,
	`entry_type` text NOT NULL,
	`season` integer,
	`episode` integer,
	`title` text,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `scan_state` (
	`path` text PRIMARY KEY NOT NULL,
	`size` integer NOT NULL,
	`mtime` integer NOT NULL,
	`hash` text DEFAULT '' NOT NULL
);
