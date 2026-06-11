// 音声ファイルの再生時間プローブ。music-metadata（pure JS）でヘッダー解析し、
// (size, mtime) キーで SQLite にキャッシュする。読めないファイルは 0 を返して警告ログ
// （非対応フォーマットは仕様上あり得るため、作品全体をエラーにはしない）。
import { statSync } from "node:fs";
import { eq } from "drizzle-orm";
import { parseFile } from "music-metadata";
import type { Db } from "./db.ts";
import { audioProbeCache } from "./schema.ts";

export async function probeDurationSec(db: Db, filePath: string): Promise<number> {
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return 0; // ファイル欠損は scanner 側で errorMessage として扱う
  }

  const cached = db.select().from(audioProbeCache).where(eq(audioProbeCache.path, filePath)).get();
  if (cached && cached.size === stat.size && cached.mtimeMs === Math.floor(stat.mtimeMs)) {
    return cached.durationSec;
  }

  let duration = 0;
  try {
    const meta = await parseFile(filePath, { duration: true });
    duration = meta.format.duration ?? 0;
  } catch (e) {
    console.warn(`再生時間を取得できません: ${filePath}: ${(e as Error).message}`);
  }

  const values = { path: filePath, size: stat.size, mtimeMs: Math.floor(stat.mtimeMs), durationSec: duration };
  db.insert(audioProbeCache)
    .values(values)
    .onConflictDoUpdate({ target: audioProbeCache.path, set: values })
    .run();
  return duration;
}
