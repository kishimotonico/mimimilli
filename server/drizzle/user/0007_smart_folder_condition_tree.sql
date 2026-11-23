DROP TABLE `smart_folders`;--> statement-breakpoint
CREATE TABLE `smart_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`condition_json` text NOT NULL,
	`sort` text,
	`group_by_json` text,
	`group_sort` text,
	`position` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `tag_prefixes` DROP COLUMN `show_as_axis`;
