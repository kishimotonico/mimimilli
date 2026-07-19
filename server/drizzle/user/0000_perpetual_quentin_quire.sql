CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `search_presets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`query` text NOT NULL,
	`tag_filters_json` text NOT NULL,
	`sort_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `smart_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`rules_json` text NOT NULL,
	`sort` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tag_prefixes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prefix` text NOT NULL,
	`label` text NOT NULL,
	`color` text,
	`show_as_axis` integer DEFAULT true NOT NULL,
	`protected` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_prefixes_prefix_unique` ON `tag_prefixes` (`prefix`);--> statement-breakpoint
CREATE TABLE `work_states` (
	`work_id` text PRIMARY KEY NOT NULL,
	`added_at` text NOT NULL,
	`bookmarked` integer DEFAULT false NOT NULL,
	`last_played_at` text,
	`resume_position` real DEFAULT 0 NOT NULL,
	`resume_track_index` integer DEFAULT 0 NOT NULL
);
