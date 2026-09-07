ALTER TABLE `tag_prefixes` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `tag_prefixes` SET `sort_order` = (SELECT COUNT(*) FROM `tag_prefixes` AS t2 WHERE t2.id <= tag_prefixes.id) - 1;
