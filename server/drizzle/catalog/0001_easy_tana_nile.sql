ALTER TABLE `tags` ADD `search_key` text NOT NULL;--> statement-breakpoint
ALTER TABLE `works` ADD `title_sort_key` text NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_works_title_sort_key` ON `works` (`title_sort_key`,`id`);