import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  coverFieldsFromColumns,
  metaFileSchema,
  resolveWorkPlacement,
  selectDefaultPlaylist,
} from "@mimimilli/shared";
import type { Cover, MetaFile, ScanDiagnostic, ScanResult, Work } from "@mimimilli/shared";
import type { Db } from "./db.ts";
import { computeWorkRevisions } from "./fingerprint.ts";
import { MetaParseError } from "./meta.ts";
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
import { toPortableRelativePath } from "./paths.ts";
import { isPathWithin } from "../../lib/path.ts";

const scanLogger = getCategoryLogger("scan");

type ScanUpsertTracking = Pick<ScanResult, "coverErrors" | "insertedWorkIds" | "updatedWorkIds">;
type ScanErrorTracking = ScanUpsertTracking & Pick<ScanResult, "errors">;

function extractCandidateIdFromMetaContent(content: string): string | null {
  const match = content.match(/"id"\s*:\s*"([^"\\]+)"/);
  return match?.[1] ?? null;
}

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
      const bytes = readFileSync(metaPath);
      const content = bytes.toString("utf-8");
      const initialRaw = (() => {
        try {
          return JSON.parse(content) as unknown;
        } catch (e) {
          throw new MetaParseError(
            metaPath,
            `JSON パースエラー: ${(e as Error).message}`,
            extractCandidateIdFromMetaContent(content),
          );
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
          throw new MetaParseError(
            metaPath,
            `JSON パースエラー: ${(e as Error).message}`,
            extractCandidateIdFromMetaContent(content),
          );
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
      if (
        canSkipIncremental(full, cachedRevisions, revisions, coverSatisfied, state?.status) &&
        state?.physicalPath === placement.physicalPath
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
  existingByPhysicalPath: Map<string, { id: string; state: ScanWorkState }>,
  root: string,
  identityConflicts: ScanDiagnostic[],
): void {
  scanLogger.warn(error.message, { metaPath });
  const workDir = dirname(metaPath);
  const existingByPath = existingByPhysicalPath.get(workDir) ?? null;
  if (existingByPath) {
    batch.addError(existingByPath.id, workDir, metaPath, error.message);
    seenIds.work.add(existingByPath.id);
    trackUpsertedWork(result, existingByPath.id, false);
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
      existingById.physicalPath !== workDir &&
      isPathWithin(root, existingById.physicalPath)
    ) {
      const brokenPath = toPortableRelativePath(root, workDir);
      const ownerPath = toPortableRelativePath(root, existingById.physicalPath);
      const existingConflict = identityConflicts.find(
        (diagnostic): diagnostic is Extract<ScanDiagnostic, { kind: "identity_conflict" }> =>
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
  const { metaPath, meta, placement, revisions, cachedRevisions, cachedStatus, coverSatisfied } =
    prepared;
  const { mediaRoot } = placement.placement;
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
    placement.placement,
    meta.playlists,
    probeCacheForWork,
    checkAbort,
  );

  const errorMessage = deriveWorkErrorMessage(mediaRoot, meta, invalidStartTracks);
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
