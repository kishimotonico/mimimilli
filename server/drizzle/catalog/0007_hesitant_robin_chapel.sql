PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_works` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`title_sort_key` text NOT NULL,
	`cover_image` text,
	`cover_width` integer,
	`cover_height` integer,
	`default_playlist_id` text,
	`created_at` text,
	`status` text NOT NULL,
	`physical_path` text NOT NULL,
	`total_duration_sec` real,
	`track_count` integer DEFAULT 0 NOT NULL,
	`fingerprint` text,
	`error_message` text,
	`urls_json` text NOT NULL,
	`playlists_json` text NOT NULL,
	CONSTRAINT "cover_dimensions_valid" CHECK(("__new_works"."cover_width" IS NULL AND "__new_works"."cover_height" IS NULL) OR (typeof("__new_works"."cover_width") = 'integer' AND typeof("__new_works"."cover_height") = 'integer' AND "__new_works"."cover_width" > 0 AND "__new_works"."cover_height" > 0))
);
--> statement-breakpoint
INSERT INTO `__new_works`("id", "title", "title_sort_key", "cover_image", "cover_width", "cover_height", "default_playlist_id", "created_at", "status", "physical_path", "total_duration_sec", "track_count", "fingerprint", "error_message", "urls_json", "playlists_json") SELECT "id", "title", "title_sort_key", "cover_image", "cover_width", "cover_height", "default_playlist_id", "created_at", "status", "physical_path", "total_duration_sec", "track_count", "fingerprint", "error_message", "urls_json", "playlists_json" FROM `works`;--> statement-breakpoint
DROP TABLE `works`;--> statement-breakpoint
ALTER TABLE `__new_works` RENAME TO `works`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_works_physical_path` ON `works` (`physical_path`);--> statement-breakpoint
CREATE INDEX `idx_works_title_sort_key` ON `works` (`title_sort_key`,`id`);