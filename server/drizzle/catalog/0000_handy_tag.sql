CREATE TABLE `audio_probe_cache` (
	`path` text PRIMARY KEY NOT NULL,
	`size` integer NOT NULL,
	`mtime_ms` integer NOT NULL,
	`duration_sec` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `work_dlsite` (
	`work_id` text PRIMARY KEY NOT NULL,
	`state_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_tags` (
	`work_id` text NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`work_id`, `tag_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_work_tags_tag` ON `work_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `works` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`cover_image` text,
	`default_playlist` text,
	`created_at` text,
	`status` text NOT NULL,
	`physical_path` text NOT NULL,
	`total_duration_sec` real DEFAULT 0 NOT NULL,
	`error_message` text,
	`urls_json` text NOT NULL,
	`playlists_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_works_physical_path` ON `works` (`physical_path`);