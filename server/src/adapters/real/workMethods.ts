import { statSync } from "node:fs";
import { join } from "node:path";
import type {
  DataIntegrityWarning,
  DlsiteNotificationKind,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  FileEntry,
  IdentityConflictReassignBody,
  ResumeBody,
  Work,
  WorkCreateBody,
  WorkPatch,
  WorkRegisterPreview,
  WorkspacePath,
  WorksPage,
  WorksQuery,
} from "@mimimilli/shared";
import { type Db } from "./db.ts";
import { buildFileTree } from "./fileTree.ts";
import { MetaParseError, patchMetaFileCas, readMetaSource } from "./meta.ts";
import { SourceChangedError } from "../../errors.ts";
import { resolveWithin } from "./paths.ts";
import { Scanner } from "./scanner.ts";
import { logDataIntegritySkips, toDataIntegrityWarning } from "./dataIntegrity.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import { getWorkWithLiveProbe } from "./workRefresh.ts";
import { buildWorkRegisterPreview, createWorkFromFolder, unregisterWork } from "./workRegister.ts";

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
      const work = await getWorkWithLiveProbe(db, query, catalog, id);
      if (!work) return null;
      const metaPath = catalog.getWorkMetaPath(id);
      if (!metaPath) return null;
      try {
        return { ...work, sourceRevision: readMetaSource(metaPath).sourceRevision };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof MetaParseError)
          return work;
        throw error;
      }
    },

    async getWorkRegisterPreview(path: WorkspacePath): Promise<WorkRegisterPreview | null> {
      const root = requireRoot();
      const workDir = resolveWithin(root, join(root, path));
      if (!workDir) return null;
      try {
        if (!statSync(workDir).isDirectory()) return null;
      } catch {
        return null;
      }
      return buildWorkRegisterPreview(query, workDir);
    },

    async createWork(body: WorkCreateBody): Promise<Work | null> {
      const root = requireRoot();
      return await createWorkFromFolder(
        { query, catalog, user },
        scanner,
        root,
        body,
        (coverUrl, workDir) => cachedCover(coverUrl, workDir),
      );
    },

    async reassignIdentityConflict(body: IdentityConflictReassignBody): Promise<Work | null> {
      const diagnostic = catalog
        .listIdentityConflicts()
        .find((candidate) => candidate.paths.includes(body.path));
      if (!diagnostic) return null;

      const root = requireRoot();
      const workDir = resolveWithin(root, join(root, body.path));
      if (!workDir) return null;
      const metaPath = join(workDir, "mimimilli.json");
      const source = readMetaSource(metaPath);
      if (source.meta.id !== diagnostic.workId) return null;

      const updated = patchMetaFileCas(metaPath, source.sourceRevision, {
        id: crypto.randomUUID(),
      });
      const work = await scanner.projectMetaFile(metaPath, updated.meta);
      const remaining = catalog.listIdentityConflicts().flatMap((candidate) => {
        if (candidate.workId !== diagnostic.workId) return [candidate];
        const paths = candidate.paths.filter((path) => path !== body.path);
        return paths.length >= 2 ? [{ ...candidate, paths }] : [];
      });
      catalog.replaceIdentityConflicts(remaining);
      return { ...work, sourceRevision: updated.sourceRevision };
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

    async patchWork(id: string, patch: WorkPatch): Promise<Work | null> {
      const metaPath = catalog.getWorkMetaPath(id);
      if (!metaPath) return null;
      const source = readMetaSource(metaPath);
      if (patch.sourceRevision !== undefined && source.sourceRevision !== patch.sourceRevision) {
        throw new SourceChangedError();
      }
      if (patch.bookmarked !== undefined) {
        user.patchBookmarked(id, patch.bookmarked);
      }
      if (patch.title === undefined && patch.tags === undefined) {
        const work = await getWorkWithLiveProbe(db, query, catalog, id);
        return work ? { ...work, sourceRevision: source.sourceRevision } : null;
      }
      const updated = patchMetaFileCas(metaPath, patch.sourceRevision ?? source.sourceRevision, {
        title: patch.title,
        tags: patch.tags,
      });
      const work = await scanner.projectMetaFile(metaPath, updated.meta);
      return { ...work, sourceRevision: updated.sourceRevision };
    },

    async saveResume(id: string, body: ResumeBody): Promise<boolean> {
      if (!catalog.workExists(id)) return false;
      const track = catalog.resolveResumeTrackDuration(id, body.playlistId, body.trackId);
      return user.saveResume(id, body, track);
    },

    async touchLastPlayed(id: string): Promise<boolean> {
      if (!catalog.workExists(id)) return false;
      return user.touchLastPlayed(id);
    },

    async listWorkFiles(id: string): Promise<FileEntry | null> {
      const work = await getWorkWithLiveProbe(db, query, catalog, id);
      if (!work) return null;
      return buildFileTree(work.physicalPath);
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
