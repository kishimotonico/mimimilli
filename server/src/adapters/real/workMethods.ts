import { existsSync } from "node:fs";
import { prepareSingleMeta } from "./scanRegister.ts";
import type { PreparedMeta } from "./scanTypes.ts";
import { join } from "node:path";
import type {
  Condition,
  DataIntegrityWarning,
  IdentityConflictReassignBody,
  IdentityConflict,
  NormalizedTag,
  ResumeBody,
  Work,
  WorkBookmarkPatch,
  WorkBookmarkResult,
  WorkCreateBody,
  WorkCreateResponse,
  WorkEditSnapshot,
  WorkRegisterPreview,
  WorkSourceMutationResult,
  WorkSourcePatch,
  WorkspacePath,
  UnregisterMissingWorksResult,
} from "@mimimilli/shared";
import type {
  ConditionGroupQuery,
  ConditionWorksQuery,
  EvalContext,
} from "../../adapter/condition.ts";
import { errorMessage, resolveWorkPlacement, tagEquals } from "@mimimilli/shared";
import { type Db } from "./db.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import type { DlsiteParser } from "./dlsite.ts";
import { createDlsiteProductResolver, readUsableDlsite } from "./dlsiteProductResolve.ts";
import { MetaMutationReject, encodeMetaRaw, patchMetaFileCas, readMetaSource } from "./meta.ts";
import {
  SOURCE_IDENTITY_MISMATCH_MESSAGE,
  SOURCE_RELOAD_FAILED_MESSAGE,
  SourceChangedError,
  SourceConflictError,
  SourceReloadUnresolvedError,
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
  parser: DlsiteParser;
}) {
  const { db, query, catalog, user, scanner, requireRoot, dlsiteCache } = deps;
  const resolveDlsiteProduct = createDlsiteProductResolver(dlsiteCache, deps.parser);
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

  /** 旧IDを宣言している、再採番した以外のメタファイル（読めるもののうち先頭）。無ければ null */
  function findRemainingDeclarer(
    root: string,
    workId: string,
    conflictPaths: readonly string[],
    reassignedPath: string,
  ): PreparedMeta | null {
    for (const path of conflictPaths) {
      if (path === reassignedPath) continue;
      const target = resolveWithin(root, join(root, path));
      if (!target) continue;
      const metaPath = identityConflictMetaPath(target);
      try {
        const declared = readMetaSource(metaPath);
        if (declared.meta.id === workId) return prepareSingleMeta(metaPath, declared);
      } catch {
        continue;
      }
    }
    return null;
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
    async queryWorks(conditionQuery: ConditionWorksQuery, ctx: EvalContext) {
      return query.queryWorksByCondition(conditionQuery, requireRoot(), ctx);
    },

    async groupWorks(groupQuery: ConditionGroupQuery, ctx: EvalContext) {
      return query.groupWorksByCondition(groupQuery, ctx);
    },

    async countByConditions(conditions: Condition[], ctx: EvalContext) {
      return query.countByConditions(conditions, ctx);
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

    async createWork(body: WorkCreateBody): Promise<WorkCreateResponse | null> {
      const root = requireRoot();
      return await createWorkFromPath({ db, query, catalog, user }, scanner, root, body, {
        dlsiteCache,
        readUsableInfo,
      });
    },

    async reassignIdentityConflict(
      body: IdentityConflictReassignBody,
    ): Promise<WorkSourceMutationResult | null> {
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

      const reassignsOwnerRow =
        query.getScanWorkMap().get(diagnostic.workId)?.metaPath === metaPath;
      const updated = patchMetaFileCas(metaPath, source.sourceRevision, {
        id: crypto.randomUUID(),
      });
      const physicalPath = resolveWorkPlacement(metaPath, updated.meta).physicalPath;
      // 旧IDの行は、旧IDを宣言している残りのメタファイルへ移す。無ければ次のスキャンと同じく missing にする
      const rebound = reassignsOwnerRow
        ? findRemainingDeclarer(root, diagnostic.workId, diagnostic.paths, body.path)
        : null;
      const [outcome, ...others] = await scanner.projectPreparedBatch(
        [prepareSingleMeta(metaPath, updated), ...(rebound ? [rebound] : [])],
        reassignsOwnerRow && !rebound ? [diagnostic.workId] : [],
      );
      for (const each of [outcome!, ...others]) {
        if (each.status === "unpublished" && each.reason === "source_changed") {
          throw new SourceChangedError();
        }
        if (each.status !== "published")
          throw new SourceConflictError(SOURCE_RELOAD_FAILED_MESSAGE);
      }
      catalog.replaceIdentityConflicts(
        removeIdentityConflictPath(catalog.listIdentityConflicts(), diagnostic.workId, body.path),
      );
      return mutationResultFromOutcome(toEditSnapshot(updated, physicalPath), outcome!);
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
        const outcome = await scanner.projectPrepared(prepareSingleMeta(metaPath, source));
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
      const outcome = await scanner.projectPrepared(prepareSingleMeta(location.metaPath, source));
      if (outcome.status === "unpublished" && outcome.reason === "source_changed") {
        throw new SourceChangedError();
      }
      if (outcome.status !== "published") {
        throw new SourceConflictError(SOURCE_RELOAD_FAILED_MESSAGE);
      }
      if (query.listDataIntegritySkips([id]).length > 0) {
        throw new SourceReloadUnresolvedError();
      }
      return true;
    },

    async deleteWork(id: string): Promise<boolean> {
      return unregisterWork(catalog, user, requireRoot(), id);
    },

    async getWorkStatuses(ids: readonly string[]): Promise<Map<string, Work["status"]>> {
      return query.getWorkStatuses(ids);
    },

    async countMissingWorks(): Promise<number> {
      return query.countWorksByStatus("missing");
    },

    async unregisterMissingWorks(): Promise<UnregisterMissingWorksResult> {
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
      return { deletedCount: deletedWorkIds.length, failedCount };
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
