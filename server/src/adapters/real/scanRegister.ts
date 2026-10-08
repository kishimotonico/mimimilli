import { existsSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import {
  coverFieldsFromColumns,
  resolveWorkPlacement,
  selectDefaultPlaylist,
  sumTrackDurations,
  unresolvedWorkPhysicalPath,
  workPlacementNotAFileMessage,
  workPlacementOf,
} from "@mimimilli/shared";
import type {
  Cover,
  MetaFile,
  IdentityConflict,
  ScanResult,
  Work,
  WorkPlacementResolution,
} from "@mimimilli/shared";
import type { Db } from "./db.ts";
import { computeWorkRevisions } from "./fingerprint.ts";
import { MetaParseError, metaParseErrorOf, type MetaInspection } from "./meta.ts";
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
import { naturalCompare } from "./naturalCompare.ts";
import { identityConflictPathOf } from "./paths.ts";
import { isPathWithin } from "../../lib/path.ts";

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

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function placementErrorMessage(resolution: WorkPlacementResolution): string | null {
  if (!resolution.ok) return resolution.message;
  if (resolution.placement.kind === "audio-file" && !isFile(resolution.physicalPath)) {
    return workPlacementNotAFileMessage(resolution.placement, basename(resolution.physicalPath));
  }
  return null;
}

function deriveWorkErrorMessage(
  mediaRoot: string,
  meta: MetaFile,
  invalidStartTracks: Array<{ file: string; title: string }>,
): string | null {
  const playlist = selectDefaultPlaylist(meta.playlists, meta.defaultPlaylistId);
  const missingFiles = (playlist?.tracks ?? []).filter((t) => !existsSync(join(mediaRoot, t.file)));
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
  return sumTrackDurations(defaultResolved?.tracks ?? []);
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
  const { meta, placement, revisions } = prepared;
  const { mediaRoot } = placement.placement;
  const id = meta.id;
  checkAbort();

  const cover: CoverColumns = { image: meta.coverImage, dimensions: null };
  let coverErrors = 0;
  if (meta.coverImage) {
    const dimensions = await measureCover(join(mediaRoot, meta.coverImage));
    checkAbort();
    if (dimensions) cover.dimensions = dimensions;
    else coverErrors += 1;
  }
  const workCover: Cover = coverDtoFromColumns(
    id,
    placement.placement,
    cover.image,
    cover.dimensions?.width ?? null,
    cover.dimensions?.height ?? null,
  );
  const { coverKind, coverImage } = coverFieldsFromColumns(
    cover.image,
    cover.dimensions?.width ?? null,
    cover.dimensions?.height ?? null,
  );

  const work: Work = {
    id,
    title: meta.title,
    cover: workCover,
    coverKind,
    coverImage,
    defaultPlaylistId: meta.defaultPlaylistId,
    createdAt: meta.createdAt ?? null,
    status: "ok",
    physicalPath: placement.physicalPath,
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
  inspections: ReadonlyMap<string, MetaInspection>,
  existingWorks: Map<string, ScanWorkState>,
  full: boolean,
  checkAbort: () => void = () => {},
  conflictedWorkIds: ReadonlySet<string> = new Set(),
): PreparedEntry[] {
  const prepared: PreparedEntry[] = [];
  for (const [metaPath, inspection] of inspections) {
    checkAbort();
    try {
      const { declaredId } = inspection;
      if (declaredId !== null && conflictedWorkIds.has(declaredId)) {
        prepared.push({ kind: "identity_conflict", metaPath, workId: declaredId });
        continue;
      }
      if (inspection.diagnostic !== null) throw metaParseErrorOf(metaPath, inspection);
      const { meta, bytes } = inspection;
      const placement = resolveWorkPlacement(metaPath, meta);
      const revisions = computeWorkRevisions(metaPath, meta, bytes);
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
      const placementSettled = placement.ok && state?.metaPath === metaPath;
      if (
        canSkipIncremental(
          full,
          cachedRevisions,
          revisions,
          coverSatisfied,
          state?.status,
          placementSettled,
        )
      ) {
        prepared.push({ kind: "skip", metaPath, id: meta.id });
        continue;
      }
      prepared.push({
        kind: "ok",
        metaPath,
        meta,
        placement,
        bytes,
        revisions,
        cachedRevisions,
        cachedStatus: state?.status,
        coverSatisfied,
        placementSettled,
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

export function prepareSingleMeta(
  metaPath: string,
  snapshot: { meta: MetaFile; bytes: Buffer },
): PreparedMeta {
  const revisions = computeWorkRevisions(metaPath, snapshot.meta, snapshot.bytes);
  return {
    kind: "ok",
    metaPath,
    meta: snapshot.meta,
    placement: resolveWorkPlacement(metaPath, snapshot.meta),
    bytes: snapshot.bytes,
    revisions,
    cachedRevisions: undefined,
    cachedStatus: undefined,
    coverSatisfied: false,
    placementSettled: false,
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
        entry.placementSettled,
      )
    )
      continue;
    if (entry.cachedStatus === "error") continue;
    const { mediaRoot } = entry.placement.placement;
    for (const playlist of entry.meta.playlists) {
      for (const track of playlist.tracks) {
        checkAbort();
        trackPaths.push(join(mediaRoot, track.file));
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
  existingByMetaPath: Map<string, { id: string; state: ScanWorkState }>,
  root: string,
  identityConflicts: IdentityConflict[],
): void {
  scanLogger.warn(error.message, { metaPath });
  const existing = existingByMetaPath.get(metaPath) ?? null;
  if (existing) {
    batch.addError(
      existing.id,
      unresolvedWorkPhysicalPath(workPlacementOf(metaPath)),
      metaPath,
      error.message,
    );
    seenIds.work.add(existing.id);
    trackUpsertedWork(result, existing.id, false);
    result.errors += 1;
    return;
  }

  const candidateId = error.candidateId;
  if (candidateId) {
    const existingById = existingWorks.get(candidateId);
    // 旧rootに残った投影（root変更後にstatus="missing"化したもの等）とのID一致は、
    // 現root配下のpathで表現できないためidentity_conflictにはせず、独立したerrorとして扱う。
    if (
      existingById &&
      existingById.metaPath !== metaPath &&
      isPathWithin(root, existingById.metaPath)
    ) {
      const brokenPath = identityConflictPathOf(root, metaPath);
      const ownerPath = identityConflictPathOf(root, existingById.metaPath);
      const existingConflict = identityConflicts.find(
        (diagnostic): diagnostic is Extract<IdentityConflict, { kind: "identity_conflict" }> =>
          diagnostic.kind === "identity_conflict" && diagnostic.workId === candidateId,
      );
      if (existingConflict) {
        const merged = new Set([...existingConflict.paths, brokenPath, ownerPath]);
        existingConflict.paths = [...merged].sort(naturalCompare);
      } else {
        identityConflicts.push({
          kind: "identity_conflict",
          workId: candidateId,
          paths: [brokenPath, ownerPath].sort(naturalCompare),
        });
        identityConflicts.sort((a, b) => {
          if (a.kind !== "identity_conflict" || b.kind !== "identity_conflict") return 0;
          return naturalCompare(a.workId, b.workId);
        });
      }
      result.errors += 1;
      return;
    }
  }

  result.errors += 1;
}

export type RegisterMetaFileOptions = {
  full: boolean;
  idsAlreadyRegistered: boolean;
};

export async function registerMetaFile(
  db: Db,
  prepared: PreparedMeta,
  seenIds: SeenMetaIds,
  probeCache: Map<string, ProbeCacheEntry>,
  batch: ScanUpsertBatch,
  existingWorks: Map<string, ScanWorkState>,
  result: ScanUpsertTracking,
  options: RegisterMetaFileOptions,
  measureCover: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>,
  checkAbort: () => void = () => {},
  dlsiteCache?: DlsiteCache | null,
): Promise<"skipped" | string> {
  const { full, idsAlreadyRegistered } = options;
  const {
    metaPath,
    meta,
    placement,
    revisions,
    cachedRevisions,
    cachedStatus,
    coverSatisfied,
    placementSettled,
  } = prepared;
  const { mediaRoot } = placement.placement;
  const id = meta.id;

  if (!idsAlreadyRegistered) {
    assertUniqueMetaIds(metaPath, meta, seenIds);
  }

  if (
    canSkipIncremental(
      full,
      cachedRevisions,
      revisions,
      coverSatisfied,
      cachedStatus,
      placementSettled,
    )
  ) {
    return "skipped";
  }

  const probeCacheForWork =
    full || cachedStatus === "error" ? new Map<string, ProbeCacheEntry>() : probeCache;

  const { resolvedPlaylists, invalidStartTracks } = await resolvePlaylistDurations(
    db,
    placement.placement,
    meta.playlists,
    probeCacheForWork,
    checkAbort,
  );

  const workErrorMessage =
    placementErrorMessage(placement) ?? deriveWorkErrorMessage(mediaRoot, meta, invalidStartTracks);
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

  assembled.work.status = workErrorMessage ? "error" : "ok";
  assembled.work.errorMessage = workErrorMessage;
  assembled.work.totalDurationSec = totalDurationSec;
  assembled.work.playlists = resolvedPlaylists;

  checkAbort();
  batch.add(assembled.work, assembled.revisions, assembled.cover, metaPath);
  trackUpsertedWork(result, id, isNew);
  return id;
}
