import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  DataIntegrityWarning,
  IdentityConflictReassignBody,
  IdentityConflict,
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
  UnregisterMissingWorksResult,
  WorksQuery,
} from "@mimimilli/shared";
import { errorMessage, resolveWorkPlacement, tagEquals } from "@mimimilli/shared";
import { type Db } from "./db.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import { createDlsiteProductResolver, readUsableDlsite } from "./dlsiteProductResolve.ts";
import { MetaMutationReject, encodeMetaRaw, patchMetaFileCas, readMetaSource } from "./meta.ts";
import {
  SOURCE_IDENTITY_MISMATCH_MESSAGE,
  SOURCE_RELOAD_FAILED_MESSAGE,
  SOURCE_RELOAD_UNRESOLVED_MESSAGE,
  SourceChangedError,
  SourceConflictError,
} from "../../errors.ts";
import { removeIdentityConflictPath } from "../../core/identityConflicts.ts";
import { validateResumeRequest } from "../../core/resumeValidation.ts";
import { identityConflictMetaPath, identityConflictPathOf, resolveWithin } from "./paths.ts";
import { Scanner } from "./scanner.ts";
import { logDataIntegritySkips, toDataIntegrityWarning } from "./dataIntegrity.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import { getWorkFromCatalog, getWorkWithLiveProbe } from "./workRefresh.ts";
import { naturalCompare } from "./naturalCompare.ts";
import {
  mapMetaReadError,
  mutateVerifiedMetaSource,
  mutationResultFromOutcome,
  projectVerifiedSource,
  readVerifiedEditSource,
  toEditSnapshot,
} from "./workEditSource.ts";
import { registrationTargetOfPath } from "./registrationTarget.ts";
import { buildWorkRegisterPreview, createWorkFromPath, unregisterWork } from "./workRegister.ts";

const scanLogger = getCategoryLogger("scan");

export function createWorkMethods(deps: {
  db: Db;
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  user: UserWorkStateRepository;
  scanner: Scanner;
  requireRoot: () => string;
  dlsiteCache: DlsiteCache;
}) {
  const { db, query, catalog, user, scanner, requireRoot, dlsiteCache } = deps;
  const resolveDlsiteProduct = createDlsiteProductResolver(dlsiteCache);
  const readUsableInfo = (productCode: string) =>
    readUsableDlsite(resolveDlsiteProduct, productCode)?.info ?? null;

  function recordIdentityConflict(workId: string, ownerMetaPath: string, conflictMetaPath: string) {
    const root = requireRoot();
    const ownerPath = identityConflictPathOf(root, ownerMetaPath);
    const conflictPath = identityConflictPathOf(root, conflictMetaPath);
    const diagnostics = catalog.listIdentityConflicts();
    const existing = diagnostics.find(
      (diagnostic): diagnostic is Extract<IdentityConflict, { kind: "identity_conflict" }> =>
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
    const metaPath = registrationTargetOfPath(target)?.placement.metaPath;
    return metaPath && existsSync(metaPath) ? metaPath : null;
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
        const registrationTarget = registrationTargetOfPath(target);
        return registrationTarget
          ? buildWorkRegisterPreview(query, registrationTarget, root)
          : null;
      } catch {
        return null;
      }
    },

    async createWork(body: WorkCreateBody): Promise<WorkSourceMutationResult | null> {
      const root = requireRoot();
      return await createWorkFromPath({ db, query, catalog, user }, scanner, root, body, {
        dlsiteCache,
        readUsableInfo,
      });
    },

    async reassignIdentityConflict(
      body: IdentityConflictReassignBody,
    ): Promise<(WorkSourceMutationResult & { replacedWorkId: string | null }) | null> {
      const diagnostic = catalog
        .listIdentityConflicts()
        .find((candidate) => candidate.paths.includes(body.path));
      if (!diagnostic) return null;

      const root = requireRoot();
      const target = resolveWithin(root, join(root, body.path));
      if (!target) return null;
      const metaPath = identityConflictMetaPath(target);
      let source;
      try {
        source = readMetaSource(metaPath);
      } catch (error) {
        mapMetaReadError(error);
      }
      if (source.meta.id !== diagnostic.workId) return null;

      const replacedWorkId =
        query.getScanWorkMap().get(diagnostic.workId)?.metaPath === metaPath
          ? diagnostic.workId
          : null;
      const updated = patchMetaFileCas(metaPath, source.sourceRevision, {
        id: crypto.randomUUID(),
      });
      const physicalPath = resolveWorkPlacement(metaPath, updated.meta).physicalPath;
      const outcome = await scanner.projectMetaFile(metaPath, updated);
      catalog.replaceIdentityConflicts(
        removeIdentityConflictPath(catalog.listIdentityConflicts(), diagnostic.workId, body.path),
      );
      return {
        ...mutationResultFromOutcome(toEditSnapshot(updated, physicalPath), outcome),
        replacedWorkId,
      };
    },

    async projectWorkSource(path: WorkspacePath): Promise<WorkSourceMutationResult | null> {
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
      const physicalPath = resolveWorkPlacement(metaPath, source.meta).physicalPath;
      const existing = query.getScanWorkMap().get(source.meta.id);
      if (existing && existing.metaPath !== metaPath && existing.status !== "missing") {
        recordIdentityConflict(source.meta.id, existing.metaPath, metaPath);
        return {
          snapshot: toEditSnapshot(source, physicalPath),
          projection: { status: "pending", reason: "identity_conflict" },
        };
      }
      try {
        const outcome = await scanner.projectMetaFile(metaPath, source);
        return mutationResultFromOutcome(toEditSnapshot(source, physicalPath), outcome);
      } catch (error) {
        scanLogger.error("作品の一覧反映に失敗しました", {
          workId: source.meta.id,
          error: errorMessage(error),
        });
        return {
          snapshot: toEditSnapshot(source, physicalPath),
          projection: { status: "pending", reason: "error" },
        };
      }
    },

    async reloadWork(id: string): Promise<boolean> {
      const location = catalog.getWorkSourceLocation(id);
      if (!location) return false;
      let source;
      try {
        source = readMetaSource(location.metaPath);
      } catch (error) {
        mapMetaReadError(error);
      }
      if (source.meta.id !== id) throw new SourceConflictError(SOURCE_IDENTITY_MISMATCH_MESSAGE);
      const outcome = await scanner.projectMetaFile(location.metaPath, source);
      if (outcome.status === "unpublished" && outcome.reason === "source_changed") {
        throw new SourceChangedError();
      }
      if (outcome.status !== "published") {
        throw new SourceConflictError(SOURCE_RELOAD_FAILED_MESSAGE);
      }
      if (query.listSummaries([id]).summaries.length === 0) {
        throw new SourceConflictError(SOURCE_RELOAD_UNRESOLVED_MESSAGE);
      }
      return true;
    },

    async deleteWork(id: string): Promise<boolean> {
      return unregisterWork(catalog, user, requireRoot(), id);
    },

    async countMissingWorks(): Promise<number> {
      return query.countWorksByStatus("missing");
    },

    async unregisterMissingWorks(): Promise<
      UnregisterMissingWorksResult & { deletedWorkIds: string[] }
    > {
      const ids = query.listWorkIdsByStatus("missing");
      const root = requireRoot();
      const deletedWorkIds: string[] = [];
      let failedCount = 0;
      for (const id of ids) {
        try {
          if (unregisterWork(catalog, user, root, id)) deletedWorkIds.push(id);
          else failedCount++;
        } catch {
          failedCount++;
        }
      }
      return { deletedCount: deletedWorkIds.length, failedCount, deletedWorkIds };
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
