CREATE TABLE `franchises` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`anilist_id` text,
	`cover_art_path` text,
	`synopsis` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `franchises_anilist_id_unique` ON `franchises` (`anilist_id`);--> statement-breakpoint
CREATE TABLE `anime_tracker_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`anime_id` integer NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	FOREIGN KEY (`anime_id`) REFERENCES `anime`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `anime_tracker_mappings_source_external_id` ON `anime_tracker_mappings` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `anilist_cache` (
	`anilist_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`format` text,
	`episodes` integer,
	`relations` text NOT NULL,
	`external_links` text,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `anime` ADD `franchise_id` integer REFERENCES `franchises`(`id`) ON UPDATE no action ON DELETE set null;