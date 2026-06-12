ALTER TABLE `matches` ADD `source_db` text NOT NULL DEFAULT 'tvdb';--> statement-breakpoint
DELETE FROM `matches`;