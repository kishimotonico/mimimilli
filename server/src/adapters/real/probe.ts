// 音声ファイルの再生時間プローブ。music-metadata（pure JS）でヘッダー解析し、
// (size, mtime) キーで SQLite にキャッシュする。読めないファイルは 0 を返して警告ログ
// （非対応フォーマットは仕様上あり得るため、作品全体をエラーにはしない）。
import { statSync } from "node:fs";
import { eq } from "drizzle-orm";
import { parseFile } from "music-metadata";
import { audioProbeCache } from "./catalogSchema.ts";
import type { CatalogDb } from "./db.ts";

export interface ProbeCacheEntry {
  size: number;
  mtimeMs: number;
  durationSec: number;
}

/**
 * 音声ファイルの再生時間を取得する。
 * @param cache 一括取得済みの probe cache。提供された場合は個別 SELECT を行わず、
 *              キャッシュの (size, mtimeMs) が一致しなければ parseFile して個別 INSERT する。
 */
export async function probeDurationSec(
  db: CatalogDb,
  filePath: string,
  cache?: Map<string, ProbeCacheEntry>,
): Promise<number> {
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return 0; // ファイル欠損は scanner 側で errorMessage として扱う
  }

  const size = stat.size;
  const mtimeMs = Math.floor(stat.mtimeMs);

  const cached = cache?.get(filePath);
  if (cached && cached.size === size && cached.mtimeMs === mtimeMs) {
    return cached.durationSec;
  }

  // キャッシュが提供されていない場合のみ、個別 SELECT で DB キャッシュを参照する（下位互換）
  if (cache === undefined) {
    const dbCached = db
      .select()
      .from(audioProbeCache)
      .where(eq(audioProbeCache.path, filePath))
      .get();
    if (dbCached && dbCached.size === size && dbCached.mtimeMs === mtimeMs) {
      return dbCached.durationSec;
    }
  }

  let duration = 0;
  try {
    const meta = await parseFile(filePath, { duration: true });
    duration = meta.format.duration ?? 0;
  } catch (e) {
    console.warn(`再生時間を取得できません: ${filePath}: ${(e as Error).message}`);
  }

  const values = {
    path: filePath,
    size,
    mtimeMs,
    durationSec: duration,
  };
  db.insert(audioProbeCache)
    .values(values)
    .onConflictDoUpdate({ target: audioProbeCache.path, set: values })
    .run();
  return duration;
}
