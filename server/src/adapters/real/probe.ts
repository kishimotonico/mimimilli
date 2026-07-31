// 音声ファイルの再生時間プローブ。music-metadata（pure JS）でヘッダー解析し、
// (size, mtime) キーで SQLite にキャッシュする。失敗モードは判別可能な結果型で返す
// （0 や null への潰し込みはしない）。
import { statSync } from "node:fs";
import { parseFile } from "music-metadata";
import type { ProbeDurationResult } from "@mimimilli/shared";
import { probeResultFromCache } from "@mimimilli/shared";
import { audioProbeCache } from "./catalogSchema.ts";
import type { CatalogDb } from "./db.ts";

export interface ProbeCacheEntry {
  size: number;
  mtimeMs: number;
  durationSec: number | null;
}

/**
 * 音声ファイルの再生時間を取得する。
 * @param cache 一括取得済みの probe cache。個別 SELECT は行わず、
 *              キャッシュの (size, mtimeMs) が一致しなければ parseFile して個別 INSERT する。
 */
export async function probeDurationSec(
  db: CatalogDb,
  filePath: string,
  cache: Map<string, ProbeCacheEntry>,
): Promise<ProbeDurationResult> {
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return { kind: "missing" };
  }

  const size = stat.size;
  const mtimeMs = Math.floor(stat.mtimeMs);

  const cached = cache.get(filePath);
  if (cached && cached.size === size && cached.mtimeMs === mtimeMs) {
    return probeResultFromCache(cached);
  }

  let duration: number | null = null;
  try {
    const meta = await parseFile(filePath, { duration: true });
    duration = meta.format.duration ?? null;
  } catch (e) {
    // ファイル記述子枯渇等のリソース起因エラーは「このファイルの計測失敗」ではないため、
    // 未知としてキャッシュに焼き付けず呼び出し元へ伝播させる。
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
  if (duration !== null) return { kind: "resolved", durationSec: duration };
  return { kind: "unsupported" };
}
