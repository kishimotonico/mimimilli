import { join } from "node:path";
import type { ProbeDurationResult } from "@mimimilli/shared";
import type { Db } from "./db.ts";
import { probeDurationSec, type ProbeCacheEntry } from "./probe.ts";

const PROBE_CONCURRENCY = 8;

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const item = items[cursor++]!;
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * トラックが参照するファイルの現在のプローブ結果を返す。
 * DBキャッシュを土台に stat 照合し、不一致なら再probeする。
 */
export async function liveFileProbeMap(
  db: Db,
  physicalPath: string,
  playlists: Array<{ tracks: Array<{ file: string }> }>,
  fetchProbeCache: (paths: string[]) => Map<string, ProbeCacheEntry>,
): Promise<Map<string, ProbeDurationResult>> {
  const paths = [
    ...new Set(playlists.flatMap((p) => p.tracks).map((t) => join(physicalPath, t.file))),
  ];
  const map = new Map<string, ProbeDurationResult>();
  if (paths.length === 0) return map;
  const cache = fetchProbeCache(paths);
  await mapWithConcurrency(paths, PROBE_CONCURRENCY, async (path) => {
    map.set(path, await probeDurationSec(db.catalog, path, cache));
  });
  return map;
}
