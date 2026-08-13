ALTER TABLE `works` ADD `source_revision` text;--> statement-breakpoint
ALTER TABLE `works` ADD `projection_revision` text;--> statement-breakpoint
ALTER TABLE `works` ADD `media_revision` text;--> statement-breakpoint
ALTER TABLE `works` ADD `verification_status` text DEFAULT 'verified' NOT NULL;--> statement-breakpoint
ALTER TABLE `works` DROP COLUMN `fingerprint`;
