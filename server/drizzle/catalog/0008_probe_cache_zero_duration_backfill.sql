-- 旧実装は probe失敗/解析失敗時に duration_sec を 0 で保存していたため、NULLIF で未知(NULL)に変換する
UPDATE `audio_probe_cache` SET `duration_sec` = NULL WHERE `duration_sec` = 0;--> statement-breakpoint
-- 旧scannerはデフォルトplaylistのみprobeしていたため、非デフォルトplaylistのトラックは
-- probe cache未取得のまま fingerprint一致でスキップされ続ける。全作品のfingerprintを
-- 無効化し、次回スキャンで強制的に全playlistを再処理させる
UPDATE `works` SET `fingerprint` = NULL;
