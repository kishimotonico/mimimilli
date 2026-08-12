ALTER TABLE `works` ADD `source_revision` text;--> statement-breakpoint
ALTER TABLE `works` ADD `projection_revision` text;--> statement-breakpoint
ALTER TABLE `works` ADD `media_revision` text;--> statement-breakpoint
ALTER TABLE `works` ADD `verification_status` text NOT NULL DEFAULT 'verified';--> statement-breakpoint
UPDATE `works` SET `source_revision` = NULL, `projection_revision` = NULL, `media_revision` = NULL;
