CREATE TABLE `resume_v1_pending` (
	`work_id` text PRIMARY KEY NOT NULL,
	`position` real NOT NULL,
	`track_index` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `resume_v1_pending` (`work_id`, `position`, `track_index`)
SELECT `work_id`, `resume_position`, `resume_track_index`
FROM `work_states`
WHERE `resume_position` > 0;--> statement-breakpoint
ALTER TABLE `work_states` ADD `resume_playlist_id` text;--> statement-breakpoint
ALTER TABLE `work_states` ADD `resume_track_id` text;--> statement-breakpoint
ALTER TABLE `work_states` ADD `resume_offset_sec` real;--> statement-breakpoint
ALTER TABLE `work_states` DROP COLUMN `resume_position`;--> statement-breakpoint
ALTER TABLE `work_states` DROP COLUMN `resume_track_index`;
