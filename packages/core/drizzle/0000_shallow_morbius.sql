CREATE TABLE `anime` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_id` text NOT NULL,
	`source_db` text NOT NULL,
	`title` text NOT NULL,
	`title_japanese` text,
	`episode_count` integer DEFAULT 0 NOT NULL,
	`cover_art_path` text,
	`genres` text,
	`library_state` text DEFAULT 'not_on_disk' NOT NULL,
	`last_synced` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_external_id_source_db_unique` ON `anime` (`external_id`,`source_db`);--> statement-breakpoint
CREATE TABLE `episode_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anime_id` integer NOT NULL,
	`entry_type` text NOT NULL,
	`season_number` integer,
	`watch_status` text DEFAULT 'plan_to_watch' NOT NULL,
	`synopsis` text,
	`rating` real,
	`cover_art_path` text,
	`last_synced` text NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episode_groups_anime_id_entry_type_season_number_unique` ON `episode_groups` (`anime_id`,`entry_type`,`season_number`);--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anime_id` integer NOT NULL,
	`group_id` integer NOT NULL,
	`episode_number` integer NOT NULL,
	`file_path` text NOT NULL,
	`title` text,
	`season` integer DEFAULT 1,
	`watched` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`group_id`) REFERENCES `episode_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `episodes_anime_id_episode_number_season_unique` ON `episodes` (`anime_id`,`episode_number`,`season`);--> statement-breakpoint
CREATE TABLE `group_tracker_mappings` (
	`group_id` integer NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `episode_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_tracker_mappings_source_external_id_unique` ON `group_tracker_mappings` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`hash` text PRIMARY KEY NOT NULL,
	`anime_id` text NOT NULL,
	`anime_title` text,
	`episode_id` text,
	`entry_type` text NOT NULL,
	`season` integer,
	`episode` integer,
	`title` text,
	`source_db` text DEFAULT 'tvdb' NOT NULL,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_matches_hash_source_db` ON `matches` (`hash`,`source_db`);--> statement-breakpoint
CREATE TABLE `scan_state` (
	`path` text PRIMARY KEY NOT NULL,
	`size` integer NOT NULL,
	`mtime` integer NOT NULL,
	`hash` text DEFAULT '' NOT NULL
);
