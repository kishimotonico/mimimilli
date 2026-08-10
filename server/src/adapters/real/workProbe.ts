import { join } from "node:path";
import {
  isInvalidTrackStart,
  resolveTrackDuration,
  toTrackDurationFields,
  type MetaFile,
  type ProbeDurationResult,
  type ResolvedPlaylist,
} from "@mimimilli/shared";
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

export interface ResolvedPlaylistsResult {
  resolvedPlaylists: ResolvedPlaylist[];
  invalidStartTracks: Array<{ file: string; title: string }>;
}

/** 全playlistのトラックについて解決済み durationSec を求める。同一ファイルは1回だけ probe する。 */
export async function resolvePlaylistDurations(
  db: Db,
  workDir: string,
  playlists: MetaFile["playlists"],
  probeCache: Map<string, ProbeCacheEntry>,
  checkAbort: () => void = () => {},
): Promise<ResolvedPlaylistsResult> {
  const fileProbeCache = new Map<string, ProbeDurationResult>();
  const invalidStartTracks: Array<{ file: string; title: string }> = [];
  const resolvedPlaylists: ResolvedPlaylist[] = [];
  for (const p of playlists) {
    const tracks = [];
    for (const track of p.tracks) {
      checkAbort();
      let probe: ProbeDurationResult;
      if (fileProbeCache.has(track.file)) {
        probe = fileProbeCache.get(track.file)!;
      } else {
        probe = await probeDurationSec(db.catalog, join(workDir, track.file), probeCache);
        checkAbort();
        fileProbeCache.set(track.file, probe);
      }
      if (probe.kind === "resolved" && isInvalidTrackStart(track, probe.durationSec)) {
        invalidStartTracks.push({ file: track.file, title: track.title });
      }
      tracks.push({ ...track, ...toTrackDurationFields(resolveTrackDuration(track, probe)) });
    }
    resolvedPlaylists.push({ id: p.id, name: p.name, tracks });
  }
  return { resolvedPlaylists, invalidStartTracks };
}
