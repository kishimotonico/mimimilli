ALTER TABLE `works` ADD `cover_width` integer;--> statement-breakpoint
ALTER TABLE `works` ADD `cover_height` integer CONSTRAINT "cover_dimensions_valid" CHECK ((`cover_width` IS NULL AND `cover_height` IS NULL) OR (typeof(`cover_width`) = 'integer' AND typeof(`cover_height`) = 'integer' AND `cover_width` > 0 AND `cover_height` > 0));
