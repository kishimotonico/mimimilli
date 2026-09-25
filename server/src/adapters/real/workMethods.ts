import { existsSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type {
  DataIntegrityWarning,
  DlsiteNotificationKind,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  IdentityConflictReassignBody,
  ScanDiagnostic,
  NormalizedTag,
  ResumeBody,
  Work,
  WorkBookmarkPatch,
  WorkBookmarkResult,
  WorkCreateBody,
  WorkEditSnapshot,
  WorkRegisterPreview,
  WorkSourceMutationResult,
  WorkSourcePatch,
  WorkspacePath,
  WorksPage,
  WorksQuery,
} from "@mimimilli/shared";
import type { WorkSourceProjectionResult } from "../../adapter/work.ts";
import { isAudioFileName, sidecarMetaFileName, tagEquals } from "@mimimilli/shared";
import { type Db } from "./db.ts";
import {
  META_FILE_NAME,
  MetaMutationReject,
  encodeMetaRaw,
  patchMetaFileCas,
  readMetaSource,
} from "./meta.ts";
import { SourceChangedError } from "../../errors.ts";
import { validateResumeRequest } from "../../core/resumeValidation.ts";
import { resolveWithin, toPortableRelativePath } from "./paths.ts";
import { Scanner } from "./scanner.ts";
import { logDataIntegritySkips, toDataIntegrityWarning } from "./dataIntegrity.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import { getWorkFromCatalog, getWorkWithLiveProbe } from "./workRefresh.ts";
import { physicalPathForMeta } from "./scanRegister.ts";
import { naturalCompare } from "./naturalCompare.ts";
import {
  mapMetaReadError,
  mutateVerifiedMetaSource,
  mutationResultFromOutcome,
  projectVerifiedSource,
  readVerifiedEditSource,
  toEditSnapshot,
} from "./workEditSource.ts";
import {
  buildFileWorkRegisterPreview,
  buildWorkRegisterPreview,
  createWorkFromPath,
  unregisterWork,
} from "./workRegister.ts";

const scanLogger = getCategoryLogger("scan");

export function createWorkMethods(deps: {
  db: Db;
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  user: UserWorkStateRepository;
  scanner: Scanner;
  requireRoot: () => string;
  cachedCover: (coverUrl: string, workDir: string, signal?: AbortSignal) => Promise<string>;
}) {
  const { db, query, catalog, user, scanner, requireRoot, cachedCover } = deps;

  function recordIdentityConflict(
    workId: string,
    ownerPhysicalPath: string,
    conflictPhysicalPath: string,
  ) {
    const root = requireRoot();
    const ownerPath = toPortableRelativePath(root, ownerPhysicalPath);
    const conflictPath = toPortableRelativePath(root, conflictPhysicalPath);
    const diagnostics = catalog.listIdentityConflicts();
    const existing = diagnostics.find(
      (diagnostic): diagnostic is Extract<ScanDiagnostic, { kind: "identity_conflict" }> =>
        diagnostic.kind === "identity_conflict" && diagnostic.workId === workId,
    );
    if (existing) {
      existing.paths = [...new Set([...existing.paths, ownerPath, conflictPath])].sort(
        naturalCompare,
      );
    } else {
      diagnostics.push({
        kind: "identity_conflict",
        workId,
        paths: [ownerPath, conflictPath].sort(naturalCompare),
      });
    }
    catalog.replaceIdentityConflicts(diagnostics);
  }

  function metaPathForTarget(target: string): string | null {
    try {
      const stat = statSync(target);
      if (stat.isDirectory()) {
        const metaPath = join(target, META_FILE_NAME);
        return existsSync(metaPath) ? metaPath : null;
      }
      if (stat.isFile() && isAudioFileName(basename(target))) {
        const metaPath = join(dirname(target), sidecarMetaFileName(basename(target)));
        return existsSync(metaPath) ? metaPath : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function persistSourceMutation(
    verified: ReturnType<typeof mutateVerifiedMetaSource>,
  ): Promise<WorkSourceMutationResult | null> {
    if (!verified) return null;
    return projectVerifiedSource(scanner, verified);
  }

  return {
    async queryWorks(params: WorksQuery): Promise<WorksPage> {
      return query.queryWorks(params, requireRoot());
    },

    async getDlsiteNotificationSummary(): Promise<DlsiteNotificationSummary> {
      return query.getDlsiteNotificationSummary();
    },

    async queryDlsiteNotifications(
      kind: DlsiteNotificationKind,
      queryParams: Required<DlsiteNotificationQuery>,
    ): Promise<DlsiteNotificationPage> {
      return query.queryDlsiteNotifications(kind, queryParams);
    },

    async getWork(id: string): Promise<Work | null> {
      return getWorkFromCatalog(query, id);
    },

    async prepareWorkPlayback(id: string): Promise<Work | null> {
      return getWorkWithLiveProbe(db, query, catalog, id);
    },

    async getWorkEditSnapshot(id: string): Promise<WorkEditSnapshot | null> {
      const verified = readVerifiedEditSource(catalog, id);
      if (!verified) return null;
      return toEditSnapshot(verified.source, verified.physicalPath);
    },

    async getWorkRegisterPreview(path: WorkspacePath): Promise<WorkRegisterPreview | null> {
      const root = requireRoot();
      const target = resolveWithin(root, join(root, path));
      if (!target) return null;
      try {
        const stat = statSync(target);
        if (stat.isDirectory()) return buildWorkRegisterPreview(query, target);
        if (stat.isFile() && isAudioFileName(basename(target))) {
          return buildFileWorkRegisterPreview(query, target, root);
        }
        return null;
      } catch {
        return null;
      }
    },

    async createWork(body: WorkCreateBody): Promise<WorkSourceMutationResult | null> {
      const root = requireRoot();
      return await createWorkFromPath(
        { db, query, catalog, user },
        scanner,
        root,
        body,
        (coverUrl, workDir) => cachedCover(coverUrl, workDir),
      );
    },

    async reassignIdentityConflict(
      body: IdentityConflictReassignBody,
    ): Promise<WorkSourceMutationResult | null> {
      const diagnostic = catalog
        .listIdentityConflicts()
        .find((candidate) => candidate.paths.includes(body.path));
      if (!diagnostic) return null;

      const root = requireRoot();
      const workDir = resolveWithin(root, join(root, body.path));
      if (!workDir) return null;
      const metaPath = join(workDir, META_FILE_NAME);
      let source;
      try {
        source = readMetaSource(metaPath);
      } catch (error) {
        mapMetaReadError(error);
      }
      if (source.meta.id !== diagnostic.workId) return null;

      const updated = patchMetaFileCas(metaPath, source.sourceRevision, {
        id: crypto.randomUUID(),
      });
      const physicalPath = physicalPathForMeta(metaPath, updated.meta);
      const outcome = await scanner.projectMetaFile(metaPath, updated);
      const remaining = catalog.listIdentityConflicts().flatMap((candidate) => {
        if (candidate.workId !== diagnostic.workId) return [candidate];
        const paths = candidate.paths.filter((path) => path !== body.path);
        return paths.length >= 2 ? [{ ...candidate, paths }] : [];
      });
      catalog.replaceIdentityConflicts(remaining);
      return mutationResultFromOutcome(toEditSnapshot(updated, physicalPath), outcome);
    },

    async projectWorkSource(path: WorkspacePath): Promise<WorkSourceProjectionResult | null> {
      const root = requireRoot();
      const target = resolveWithin(root, join(root, path));
      if (!target) return null;
      const metaPath = metaPathForTarget(target);
      if (!metaPath) return null;
      let source;
      try {
        source = readMetaSource(metaPath);
      } catch (error) {
        mapMetaReadError(error);
      }
      const physicalPath = physicalPathForMeta(metaPath, source.meta);
      const existing = query.getScanWorkMap().get(source.meta.id);
      const hadCatalogRow = existing !== undefined;
      if (existing && existing.physicalPath !== physicalPath && existing.status !== "missing") {
        recordIdentityConflict(source.meta.id, existing.physicalPath, physicalPath);
        return {
          snapshot: toEditSnapshot(source, physicalPath),
          projection: { status: "pending", reason: "identity_conflict" },
        };
      }
      try {
        const outcome = await scanner.projectMetaFile(metaPath, source);
        const result = mutationResultFromOutcome(toEditSnapshot(source, physicalPath), outcome);
        if (result.projection.status === "published" && !hadCatalogRow) {
          return { ...result, catalogInserted: true };
        }
        return result;
      } catch (error) {
        scanLogger.error("作品の一覧反映に失敗しました", {
          workId: source.meta.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          snapshot: toEditSnapshot(source, physicalPath),
          projection: { status: "pending", reason: "error" },
        };
      }
    },

    async deleteWork(id: string): Promise<boolean> {
      return unregisterWork(query, catalog, user, id);
    },

    async countMissingWorks(): Promise<number> {
      return query.countWorksByStatus("missing");
    },

    async unregisterMissingWorks(): Promise<{ deletedCount: number; failedCount: number }> {
      const ids = query.listWorkIdsByStatus("missing");
      let deletedCount = 0;
      let failedCount = 0;
      for (const id of ids) {
        try {
          if (unregisterWork(query, catalog, user, id)) deletedCount++;
          else failedCount++;
        } catch {
          failedCount++;
        }
      }
      return { deletedCount, failedCount };
    },

    async patchWorkSource(
      id: string,
      patch: WorkSourcePatch,
    ): Promise<WorkSourceMutationResult | null> {
      return persistSourceMutation(
        mutateVerifiedMetaSource(catalog, id, (source) => {
          if (source.sourceRevision !== patch.sourceRevision) {
            return new MetaMutationReject(new SourceChangedError());
          }
          const raw = JSON.parse(source.bytes.toString("utf-8")) as Record<string, unknown>;
          if (patch.title !== undefined) raw.title = patch.title;
          if (patch.tags !== undefined) raw.tags = patch.tags;
          if (patch.urls !== undefined) raw.urls = patch.urls;
          return encodeMetaRaw(raw);
        }),
      );
    },

    async patchWorkBookmark(
      id: string,
      patch: WorkBookmarkPatch,
    ): Promise<WorkBookmarkResult | null> {
      if (!catalog.workExists(id)) return null;
      user.patchBookmarked(id, patch.bookmarked);
      return { bookmarked: patch.bookmarked };
    },

    async addWorkTag(id: string, tag: NormalizedTag): Promise<WorkSourceMutationResult | null> {
      return persistSourceMutation(
        mutateVerifiedMetaSource(catalog, id, (source) => {
          if (source.meta.tags.some((existing) => tagEquals(existing, tag))) {
            return source.bytes;
          }
          const raw = JSON.parse(source.bytes.toString("utf-8")) as Record<string, unknown>;
          raw.tags = [...source.meta.tags, tag];
          return encodeMetaRaw(raw);
        }),
      );
    },

    async removeWorkTag(id: string, tag: NormalizedTag): Promise<WorkSourceMutationResult | null> {
      return persistSourceMutation(
        mutateVerifiedMetaSource(catalog, id, (source) => {
          if (!source.meta.tags.some((existing) => tagEquals(existing, tag))) {
            return source.bytes;
          }
          const raw = JSON.parse(source.bytes.toString("utf-8")) as Record<string, unknown>;
          raw.tags = source.meta.tags.filter((existing) => !tagEquals(existing, tag));
          return encodeMetaRaw(raw);
        }),
      );
    },

    async saveResume(id: string, body: ResumeBody): Promise<boolean> {
      if (!catalog.workExists(id)) return false;
      const track = catalog.resolveResumeTrackDuration(id, body.playlistId, body.trackId);
      validateResumeRequest(track, body.offsetSec);
      return user.saveResume(id, body);
    },

    async touchLastPlayed(id: string): Promise<boolean> {
      if (!catalog.workExists(id)) return false;
      return user.touchLastPlayed(id);
    },

    async listTags(): Promise<string[]> {
      return query.listAllTagNames();
    },

    async exportLibrary(): Promise<{ data: string; dataIntegrityWarning?: DataIntegrityWarning }> {
      const { summaries, skipped } = query.listSummaries();
      logDataIntegritySkips(scanLogger, "export", skipped);
      const dataIntegrityWarning = toDataIntegrityWarning(skipped);
      const payload: {
        version: number;
        works: typeof summaries;
        dataIntegritySkips?: typeof skipped;
      } = { version: 1, works: summaries };
      if (skipped.length > 0) {
        payload.dataIntegritySkips = skipped.map((skip) => ({
          workId: skip.workId,
          reason: skip.reason,
        }));
      }
      return {
        data: JSON.stringify(payload, null, 2),
        dataIntegrityWarning,
      };
    },
  };
}
