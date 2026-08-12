CREATE TABLE `identity_conflicts` (
	`work_id` text NOT NULL,
	`path` text NOT NULL,
	PRIMARY KEY(`work_id`, `path`)
);
--> statement-breakpoint
CREATE INDEX `idx_identity_conflicts_work_id` ON `identity_conflicts` (`work_id`);