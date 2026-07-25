PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audio_probe_cache` (
	`path` text PRIMARY KEY NOT NULL,
	`size` integer NOT NULL,
	`mtime_ms` integer NOT NULL,
	`duration_sec` real
);
--> statement-breakpoint
INSERT INTO `__new_audio_probe_cache`("path", "size", "mtime_ms", "duration_sec") SELECT "path", "size", "mtime_ms", "duration_sec" FROM `audio_probe_cache`;--> statement-breakpoint
DROP TABLE `audio_probe_cache`;--> statement-breakpoint
ALTER TABLE `__new_audio_probe_cache` RENAME TO `audio_probe_cache`;--> statement-breakpoint
PRAGMA foreign_keys=ON;