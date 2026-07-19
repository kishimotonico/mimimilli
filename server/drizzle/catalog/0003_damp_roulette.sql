ALTER TABLE `works` RENAME COLUMN "default_playlist" TO "default_playlist_id";--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`work_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_playlists_work_position` ON `playlists` (`work_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_playlists_work_name` ON `playlists` (`work_id`,`name`);--> statement-breakpoint
CREATE TABLE `tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`work_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`file` text NOT NULL,
	`start` real,
	`end` real,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`work_id`) REFERENCES `works`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tracks_playlist_position` ON `tracks` (`playlist_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_tracks_work` ON `tracks` (`work_id`);