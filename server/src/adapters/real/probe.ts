// 音声ファイルの再生時間プローブ。music-metadata（pure JS）でヘッダー解析し、
// (size, mtime) キーで SQLite にキャッシュする。ファイル欠損・非対応フォーマット・解析失敗は
// いずれも durationSec: null（未知）としてキャッシュする（0 で埋めると既知の0秒と区別できない）。
import { statSync } from "node:fs";
import { parseFile } from "music-metadata";
import { audioProbeCache } from "./catalogSchema.ts";
import type { CatalogDb } from "./db.ts";

export interface ProbeCacheEntry {
  size: number;
  mtimeMs: number;
  durationSec: number | null;
}

/**
 * 音声ファイルの再生時間を取得する。計測不能（ファイル欠損・解析失敗）は null。
 * @param cache 一括取得済みの probe cache。個別 SELECT は行わず、
 *              キャッシュの (size, mtimeMs) が一致しなければ parseFile して個別 INSERT する。
 */
export async function probeDurationSec(
  db: CatalogDb,
  filePath: string,
  cache: Map<string, ProbeCacheEntry>,
): Promise<number | null> {
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return null; // ファイル欠損は scanner 側で errorMessage として扱う
  }

  const size = stat.size;
  const mtimeMs = Math.floor(stat.mtimeMs);

  const cached = cache.get(filePath);
  if (cached && cached.size === size && cached.mtimeMs === mtimeMs) {
    return cached.durationSec;
  }

  let duration: number | null = null;
  try {
    const meta = await parseFile(filePath, { duration: true });
    duration = meta.format.duration ?? null;
  } catch (e) {
    // ファイル記述子枯渇等のリソース起因エラーは「このファイルの計測失敗」ではないため、
    // 未知(null)としてキャッシュに焼き付けず呼び出し元へ伝播させる。
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EMFILE" || code === "ENFILE") throw e;
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
