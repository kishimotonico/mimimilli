PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audio_probe_cache` (
	`path` text PRIMARY KEY NOT NULL,
	`size` integer NOT NULL,
	`mtime_ms` integer NOT NULL,
	`duration_sec` real
);
--> statement-breakpoint
-- 旧実装は probe失敗/解析失敗時に duration_sec を 0 で保存していたため、NULLIF で未知(NULL)に変換してコピーする
INSERT INTO `__new_audio_probe_cache`("path", "size", "mtime_ms", "duration_sec") SELECT "path", "size", "mtime_ms", NULLIF("duration_sec", 0) FROM `audio_probe_cache`;--> statement-breakpoint
DROP TABLE `audio_probe_cache`;--> statement-breakpoint
ALTER TABLE `__new_audio_probe_cache` RENAME TO `audio_probe_cache`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
-- 旧scannerはデフォルトplaylistのみprobeしていたため、非デフォルトplaylistのトラックは
-- probe cache未取得のまま fingerprint一致でスキップされ続ける。全作品のfingerprintを
-- 無効化し、次回スキャンで強制的に全playlistを再処理させる
UPDATE `works` SET `fingerprint` = NULL;