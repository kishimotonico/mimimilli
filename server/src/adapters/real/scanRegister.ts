import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Cover, MetaFile, ScanResult, Work } from "@mimimilli/shared";
import { coverFieldsFromColumns, metaFileSchema, selectDefaultPlaylist } from "@mimimilli/shared";
import type { Db } from "./db.ts";
import { computeFingerprint, computeRawFingerprint } from "./fingerprint.ts";
import { MetaParseError, readMetaFile, syncDetectedRjCode } from "./meta.ts";
import type { SeenMetaIds } from "./duplicateMetaIdRepair.ts";
import { repairDuplicateMetaIds } from "./duplicateMetaIdRepair.ts";
import { toPortableRelativePath } from "./paths.ts";
import type { ProbeCacheEntry } from "./probe.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import type { CoverColumns, ScanWorkState } from "./workRowMapping.ts";
import { resolvePlaylistDurations } from "./workProbe.ts";
import type { ScanUpsertBatch } from "./scanUpsertBatch.ts";
import {
  canSkipIncremental,
  coverSatisfiedForState,
  type PreparedEntry,
  type PreparedMeta,
} from "./scanTypes.ts";
import type { CoverDimensions } from "./thumbnailCache.ts";

const scanLogger = getCategoryLogger("scan");

function assertUniqueMetaIds(metaPath: string, meta: MetaFile, seenIds: SeenMetaIds): void {
  const id = meta.id;
  if (seenIds.work.has(id)) {
    throw new MetaParseError(metaPath, `Work IDが重複しています: ${id}`, id);
  }
  for (const playlist of meta.playlists) {
    if (seenIds.playlist.has(playlist.id)) {
      throw new MetaParseError(metaPath, `Playlist IDが重複しています: ${playlist.id}`, id);
    }
    for (const track of playlist.tracks) {
      if (seenIds.track.has(track.id)) {
        throw new MetaParseError(metaPath, `Track IDが重複しています: ${track.id}`, id);
      }
    }
  }
  seenIds.work.add(id);
  for (const playlist of meta.playlists) {
    seenIds.playlist.add(playlist.id);
    for (const track of playlist.tracks) {
      seenIds.track.add(track.id);
    }
  }
}

function deriveWorkErrorMessage(
  workDir: string,
  meta: MetaFile,
  invalidStartTracks: Array<{ file: string; title: string }>,
): string | null {
  const playlist = selectDefaultPlaylist(meta.playlists, meta.defaultPlaylistId);
  const missingFiles = (playlist?.tracks ?? []).filter((t) => !existsSync(join(workDir, t.file)));
  if (missingFiles.length > 0) {
    return `参照先ファイルが見つかりません: ${missingFiles.map((t) => t.file).join(", ")}`;
  }
  if (invalidStartTracks.length > 0) {
    return `トラックの開始位置がファイル長を超えています: ${invalidStartTracks
      .map((t) => `${t.title}(${t.file})`)
      .join(", ")}`;
  }
  return null;
}

function totalDurationFromResolved(
  resolvedPlaylists: Array<{ id: string; tracks: Array<{ durationSec: number | null }> }>,
  defaultPlaylistId: string | null,
): number | null {
  const defaultResolved =
    resolvedPlaylists.find((p) => p.id === defaultPlaylistId) ?? resolvedPlaylists[0];
  const defaultTracks = defaultResolved?.tracks ?? [];
  return defaultTracks.some((track) => track.durationSec === null)
    ? null
    : defaultTracks.reduce((sum, track) => sum + track.durationSec!, 0);
}

interface AssembledWork {
  work: Work;
  cover: CoverColumns;
  finalFingerprint: string;
}

async function assembleWorkForUpsert(
  prepared: PreparedMeta,
  existing: ScanWorkState | undefined,
  measureCover: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>,
  checkAbort: () => void,
): Promise<{ assembled: AssembledWork; coverErrors: number }> {
  const { metaPath, meta } = prepared;
  const workDir = dirname(metaPath);
  const id = meta.id;

  const dlsite = syncDetectedRjCode(metaPath, basename(workDir));
  checkAbort();

  const cover: CoverColumns = { image: meta.coverImage, dimensions: null };
  let coverErrors = 0;
  if (meta.coverImage) {
    const dimensions = await measureCover(join(workDir, meta.coverImage));
    checkAbort();
    if (dimensions) cover.dimensions = dimensions;
    else coverErrors += 1;
  }
  const workCover: Cover =
    cover.image !== null && cover.dimensions !== null
      ? { image: cover.image, dimensions: cover.dimensions }
      : null;
  const { coverKind, coverImage } = coverFieldsFromColumns(
    cover.image,
    cover.dimensions?.width ?? null,
    cover.dimensions?.height ?? null,
  );

  const finalFingerprint = computeFingerprint(metaPath, { ...meta, dlsite });
  const work: Work = {
    id,
    title: meta.title,
    cover: workCover,
    coverKind,
    coverImage,
    defaultPlaylistId: meta.defaultPlaylistId,
    createdAt: meta.createdAt ?? null,
    status: "ok",
    physicalPath: workDir,
    totalDurationSec: null,
    addedAt: existing?.addedAt ?? new Date().toISOString(),
    errorMessage: null,
    urls: meta.urls,
    tags: meta.tags,
    playlists: [],
    bookmarked: existing?.bookmarked ?? false,
    lastPlayedAt: existing?.lastPlayedAt ?? null,
    resume: existing?.resume ?? null,
    dlsite,
  };

  return {
    assembled: { work, cover, finalFingerprint },
    coverErrors,
  };
}

export function prepareMetaEntries(
  root: string,
  metaPaths: string[],
  existingWorks: Map<string, ScanWorkState>,
  full: boolean,
  seenIds: SeenMetaIds,
  checkAbort: () => void = () => {},
): PreparedEntry[] {
  const prepared: PreparedEntry[] = [];
  const externallyModified: string[] = [];

  for (const metaPath of metaPaths) {
    checkAbort();
    try {
      let content = readFileSync(metaPath, "utf-8");
      const repair = repairDuplicateMetaIds(metaPath, content, seenIds, checkAbort);
      if (repair.externallyModified) {
        externallyModified.push(toPortableRelativePath(root, metaPath));
        const candidateId = (() => {
          try {
            const value: unknown = JSON.parse(content);
            if (typeof value === "object" && value !== null && "id" in value) {
              const id = (value as { id: unknown }).id;
              return typeof id === "string" ? id : null;
            }
          } catch {
            return null;
          }
          return null;
        })();
        throw new MetaParseError(
          metaPath,
          "重複ID修復中に外部編集を検出したため、このスキャンでは登録をスキップします",
          candidateId,
        );
      }
      if (repair.repaired) {
        content = readFileSync(metaPath, "utf-8");
      }

      const raw = (() => {
        try {
          return JSON.parse(content) as unknown;
        } catch (e) {
          throw new MetaParseError(metaPath, `JSON パースエラー: ${(e as Error).message}`);
        }
      })();
      const rawFingerprint = computeRawFingerprint(metaPath, raw);
      if (rawFingerprint) {
        const state = existingWorks.get(rawFingerprint.id);
        const coverSatisfied = coverSatisfiedForState(
          { coverImage: rawFingerprint.coverImage },
          state,
        );
        if (
          canSkipIncremental(
            full,
            state?.fingerprint ?? undefined,
            rawFingerprint.fingerprint,
            coverSatisfied,
            state?.status,
          )
        ) {
          prepared.push({ kind: "skip", metaPath, id: rawFingerprint.id });
          continue;
        }
      }

      const parsed = metaFileSchema.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const candidateId =
          typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string"
            ? raw.id
            : null;
        throw new MetaParseError(
          metaPath,
          `${issue?.path.join(".") ?? ""} ${issue?.message ?? "不明"}`,
          candidateId,
        );
      }
      const meta = parsed.data;
      const fingerprint = computeFingerprint(metaPath, meta);
      const state = existingWorks.get(meta.id);
      prepared.push({
        kind: "ok",
        metaPath,
        meta,
        fingerprint,
        cachedFingerprint: state?.fingerprint ?? undefined,
        cachedStatus: state?.status,
        coverSatisfied: coverSatisfiedForState(meta, state),
      });
    } catch (e) {
      if (e instanceof MetaParseError) {
        prepared.push({ kind: "error", metaPath, error: e });
      } else {
        throw e;
      }
    }
  }

  if (externallyModified.length > 0) {
    scanLogger.warn("重複ID修復: 外部編集を検出したため上書きしませんでした", {
      paths: [...new Set(externallyModified)].sort(),
    });
  }

  return prepared;
}

export function prepareSingleMeta(metaPath: string, suppliedMeta?: MetaFile): PreparedMeta {
  const meta = suppliedMeta ?? readMetaFile(metaPath);
  const fingerprint = computeFingerprint(metaPath, meta);
  return {
    kind: "ok",
    metaPath,
    meta,
    fingerprint,
    cachedFingerprint: undefined,
    cachedStatus: undefined,
    coverSatisfied: false,
  };
}

export function buildProbeCache(
  query: WorkQueryRepository,
  prepared: PreparedEntry[],
  full: boolean,
  checkAbort: () => void = () => {},
): Map<string, ProbeCacheEntry> {
  if (full) return new Map();
  const trackPaths: string[] = [];
  for (const entry of prepared) {
    checkAbort();
    if (entry.kind !== "ok") continue;
    if (
      canSkipIncremental(
        full,
        entry.cachedFingerprint,
        entry.fingerprint,
        entry.coverSatisfied,
        entry.cachedStatus,
      )
    )
      continue;
    if (entry.cachedStatus === "error") continue;
    const workDir = dirname(entry.metaPath);
    for (const playlist of entry.meta.playlists) {
      for (const track of playlist.tracks) {
        checkAbort();
        trackPaths.push(join(workDir, track.file));
      }
    }
  }
  return query.fetchProbeCache(trackPaths);
}

export function handleMetaParseError(
  catalog: CatalogWorkRepository,
  metaPath: string,
  error: MetaParseError,
  seenIds: SeenMetaIds,
  result: ScanResult,
  existingWorks: Map<string, ScanWorkState>,
  existingByPhysicalPath: Map<string, { id: string; state: ScanWorkState }>,
): void {
  scanLogger.warn(error.message, { metaPath });
  const workDir = dirname(metaPath);
  const existingById =
    error.candidateId && !seenIds.work.has(error.candidateId)
      ? existingWorks.get(error.candidateId)
        ? { id: error.candidateId, state: existingWorks.get(error.candidateId)! }
        : null
      : null;
  const existing = existingById ?? existingByPhysicalPath.get(workDir) ?? null;
  if (existing) {
    catalog.markWorkError(existing.id, workDir, metaPath, error.message);
    seenIds.work.add(existing.id);
  }
  result.errors += 1;
}

export async function registerMetaFile(
  db: Db,
  prepared: PreparedMeta,
  seenIds: SeenMetaIds,
  probeCache: Map<string, ProbeCacheEntry>,
  batch: ScanUpsertBatch,
  existingWorks: Map<string, ScanWorkState>,
  result: Pick<ScanResult, "coverErrors">,
  full: boolean,
  idsAlreadyRegistered: boolean,
  measureCover: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>,
  checkAbort: () => void = () => {},
): Promise<"skipped" | string> {
  const { metaPath, meta, fingerprint, cachedFingerprint, cachedStatus, coverSatisfied } = prepared;
  const workDir = dirname(metaPath);
  const id = meta.id;

  if (!idsAlreadyRegistered) {
    assertUniqueMetaIds(metaPath, meta, seenIds);
  }

  if (canSkipIncremental(full, cachedFingerprint, fingerprint, coverSatisfied, cachedStatus)) {
    return "skipped";
  }

  const probeCacheForWork =
    full || cachedStatus === "error" ? new Map<string, ProbeCacheEntry>() : probeCache;

  const { resolvedPlaylists, invalidStartTracks } = await resolvePlaylistDurations(
    db,
    workDir,
    meta.playlists,
    probeCacheForWork,
    checkAbort,
  );

  const errorMessage = deriveWorkErrorMessage(workDir, meta, invalidStartTracks);
  const totalDurationSec = totalDurationFromResolved(resolvedPlaylists, meta.defaultPlaylistId);

  const existing = existingWorks.get(id);
  const { assembled, coverErrors } = await assembleWorkForUpsert(
    prepared,
    existing,
    measureCover,
    checkAbort,
  );
  result.coverErrors += coverErrors;

  assembled.work.status = errorMessage ? "error" : "ok";
  assembled.work.errorMessage = errorMessage;
  assembled.work.totalDurationSec = totalDurationSec;
  assembled.work.playlists = resolvedPlaylists;

  checkAbort();
  batch.add(assembled.work, assembled.finalFingerprint, assembled.cover, metaPath);
  return id;
}
