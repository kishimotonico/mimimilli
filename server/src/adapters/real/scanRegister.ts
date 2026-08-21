import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { coverFieldsFromColumns, metaFileSchema, selectDefaultPlaylist } from "@mimimilli/shared";
import type { Cover, MetaFile, ScanResult, Work } from "@mimimilli/shared";
import type { Db } from "./db.ts";
import { computeWorkRevisions } from "./fingerprint.ts";
import { MetaParseError, readMetaFile, readMetaSource, syncDetectedRjCode } from "./meta.ts";
import type { SeenMetaIds } from "./duplicateMetaIdRepair.ts";
import type { ProbeCacheEntry } from "./probe.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import type { CoverColumns, ScanWorkState } from "./workRowMapping.ts";
import { coverDtoFromColumns } from "./coverDto.ts";
import { resolvePlaylistDurations } from "./workProbe.ts";
import type { ScanUpsertBatch } from "./scanUpsertBatch.ts";
import {
  canSkipIncremental,
  coverSatisfiedForState,
  type PreparedEntry,
  type PreparedMeta,
} from "./scanTypes.ts";
import type { CoverDimensions } from "./thumbnailCache.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import { resolveMetaDlsiteProjection } from "./dlsiteProjection.ts";

const scanLogger = getCategoryLogger("scan");

type ScanUpsertTracking = Pick<ScanResult, "coverErrors" | "insertedWorkIds" | "updatedWorkIds">;
type ScanErrorTracking = ScanUpsertTracking & Pick<ScanResult, "errors">;

function trackUpsertedWork(result: ScanUpsertTracking, workId: string, isNew: boolean): void {
  if (isNew) result.insertedWorkIds.push(workId);
  else result.updatedWorkIds.push(workId);
}

function assertUniqueMetaIds(metaPath: string, meta: MetaFile, seenIds: SeenMetaIds): void {
  const id = meta.id;
  if (seenIds.work.has(id)) {
    throw new MetaParseError(metaPath, `Work IDが重複しています: ${id}`, id);
  }
  seenIds.work.add(id);
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
  revisions: ReturnType<typeof computeWorkRevisions>;
}

async function assembleWorkForUpsert(
  prepared: PreparedMeta,
  existing: ScanWorkState | undefined,
  measureCover: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>,
  checkAbort: () => void,
  dlsiteCache?: DlsiteCache | null,
): Promise<{ assembled: AssembledWork; coverErrors: number }> {
  const { metaPath } = prepared;
  const workDir = dirname(metaPath);

  syncDetectedRjCode(metaPath, basename(workDir));
  const source = readMetaSource(metaPath);
  const meta = source.meta;
  const id = meta.id;
  checkAbort();

  const cover: CoverColumns = { image: meta.coverImage, dimensions: null };
  let coverErrors = 0;
  if (meta.coverImage) {
    const dimensions = await measureCover(join(workDir, meta.coverImage));
    checkAbort();
    if (dimensions) cover.dimensions = dimensions;
    else coverErrors += 1;
  }
  const workCover: Cover = coverDtoFromColumns(
    id,
    workDir,
    cover.image,
    cover.dimensions?.width ?? null,
    cover.dimensions?.height ?? null,
  );
  const { coverKind, coverImage } = coverFieldsFromColumns(
    cover.image,
    cover.dimensions?.width ?? null,
    cover.dimensions?.height ?? null,
  );

  const revisions = computeWorkRevisions(metaPath, meta, source.bytes);
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
    dlsite: resolveMetaDlsiteProjection(meta.dlsite, dlsiteCache),
  };

  return {
    assembled: { work, cover, revisions },
    coverErrors,
  };
}

export function prepareMetaEntries(
  _root: string,
  metaPaths: string[],
  existingWorks: Map<string, ScanWorkState>,
  full: boolean,
  _seenIds: SeenMetaIds,
  checkAbort: () => void = () => {},
  conflictedWorkIds: ReadonlySet<string> = new Set(),
): PreparedEntry[] {
  const prepared: PreparedEntry[] = [];
  for (const metaPath of metaPaths) {
    checkAbort();
    try {
      const content = readFileSync(metaPath, "utf-8");
      const initialRaw = (() => {
        try {
          return JSON.parse(content) as unknown;
        } catch (e) {
          throw new MetaParseError(metaPath, `JSON パースエラー: ${(e as Error).message}`);
        }
      })();
      const candidateId =
        typeof initialRaw === "object" &&
        initialRaw !== null &&
        "id" in initialRaw &&
        typeof initialRaw.id === "string"
          ? initialRaw.id
          : null;
      if (candidateId !== null && conflictedWorkIds.has(candidateId)) {
        prepared.push({ kind: "identity_conflict", metaPath, workId: candidateId });
        continue;
      }

      const raw = (() => {
        try {
          return JSON.parse(content) as unknown;
        } catch (e) {
          throw new MetaParseError(metaPath, `JSON パースエラー: ${(e as Error).message}`);
        }
      })();
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
      const revisions = computeWorkRevisions(metaPath, meta, Buffer.from(content));
      const state = existingWorks.get(meta.id);
      const cachedRevisions =
        state && state.sourceRevision && state.projectionRevision && state.mediaRevision
          ? {
              sourceRevision: state.sourceRevision,
              projectionRevision: state.projectionRevision,
              mediaRevision: state.mediaRevision,
            }
          : undefined;
      const coverSatisfied = coverSatisfiedForState(meta, state);
      if (
        canSkipIncremental(full, cachedRevisions, revisions, coverSatisfied, state?.status) &&
        state?.physicalPath === dirname(metaPath)
      ) {
        prepared.push({ kind: "skip", metaPath, id: meta.id });
        continue;
      }
      prepared.push({
        kind: "ok",
        metaPath,
        meta,
        revisions,
        cachedRevisions,
        cachedStatus: state?.status,
        coverSatisfied,
      });
    } catch (e) {
      if (e instanceof MetaParseError) {
        prepared.push({ kind: "error", metaPath, error: e });
      } else {
        throw e;
      }
    }
  }

  return prepared;
}

export function prepareSingleMeta(metaPath: string, suppliedMeta?: MetaFile): PreparedMeta {
  const meta = suppliedMeta ?? readMetaFile(metaPath);
  const source = readMetaSource(metaPath);
  const revisions = computeWorkRevisions(metaPath, meta, source.bytes);
  return {
    kind: "ok",
    metaPath,
    meta,
    revisions,
    cachedRevisions: undefined,
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
        entry.cachedRevisions,
        entry.revisions,
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
  batch: ScanUpsertBatch,
  metaPath: string,
  error: MetaParseError,
  seenIds: SeenMetaIds,
  result: ScanErrorTracking,
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
    batch.addError(existing.id, workDir, metaPath, error.message);
    seenIds.work.add(existing.id);
    trackUpsertedWork(result, existing.id, false);
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
  result: ScanUpsertTracking,
  full: boolean,
  idsAlreadyRegistered: boolean,
  measureCover: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>,
  checkAbort: () => void = () => {},
  dlsiteCache?: DlsiteCache | null,
): Promise<"skipped" | string> {
  const { metaPath, meta, revisions, cachedRevisions, cachedStatus, coverSatisfied } = prepared;
  const workDir = dirname(metaPath);
  const id = meta.id;

  if (!idsAlreadyRegistered) {
    assertUniqueMetaIds(metaPath, meta, seenIds);
  }

  if (canSkipIncremental(full, cachedRevisions, revisions, coverSatisfied, cachedStatus)) {
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
  const isNew = existing === undefined;
  const { assembled, coverErrors } = await assembleWorkForUpsert(
    prepared,
    existing,
    measureCover,
    checkAbort,
    dlsiteCache,
  );
  result.coverErrors += coverErrors;

  assembled.work.status = errorMessage ? "error" : "ok";
  assembled.work.errorMessage = errorMessage;
  assembled.work.totalDurationSec = totalDurationSec;
  assembled.work.playlists = resolvedPlaylists;

  checkAbort();
  batch.add(assembled.work, assembled.revisions, assembled.cover, metaPath);
  trackUpsertedWork(result, id, isNew);
  return id;
}
