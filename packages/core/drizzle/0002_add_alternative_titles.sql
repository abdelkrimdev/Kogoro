-- Custom SQL migration file, put your code below! --
ALTER TABLE `anime` ADD `alternative_titles` text;
--> statement-breakpoint
UPDATE `anime` SET `alternative_titles` = CASE WHEN `title_japanese` IS NOT NULL THEN json_array(`title_japanese`) ELSE NULL END WHERE `title_japanese` IS NOT NULL;
--> statement-breakpoint
ALTER TABLE `anime` DROP COLUMN `title_japanese`;