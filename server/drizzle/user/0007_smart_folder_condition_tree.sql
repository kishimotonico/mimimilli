DROP TABLE `smart_folders`;--> statement-breakpoint
CREATE TABLE `smart_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`condition_json` text NOT NULL,
	`sort` text,
	`group_by_json` text,
	`position` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `smart_folders` (`id`, `name`, `condition_json`, `sort`, `group_by_json`, `position`, `created_at`) VALUES ('all', 'すべて', '{"type":"and","children":[]}', 'added-desc', NULL, 0, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));--> statement-breakpoint
ALTER TABLE `tag_prefixes` DROP COLUMN `show_as_axis`;
