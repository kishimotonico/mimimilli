PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TABLE `tracks`;--> statement-breakpoint
DROP TABLE `playlists`;--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text NOT NULL,
	`work_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`work_id`, `id`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `idx_playlists_work_position` ON `playlists` (`work_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_playlists_work_name` ON `playlists` (`work_id`,`name`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text NOT NULL,
	`playlist_id` text NOT NULL,
	`work_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`file` text NOT NULL,
	`start` real,
	`end` real,
	PRIMARY KEY(`work_id`, `playlist_id`, `id`),
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`,`playlist_id`) REFERENCES `playlists`(`work_id`,`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tracks_playlist_position` ON `tracks` (`work_id`,`playlist_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_tracks_work` ON `tracks` (`work_id`);--> statement-breakpoint
ALTER TABLE `works` DROP COLUMN `playlists_json`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
