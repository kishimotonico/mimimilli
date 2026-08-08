import { statSync } from "node:fs";
import type {
  DataIntegrityWarning,
  DlsiteNotificationKind,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  FileEntry,
  ResumeBody,
  Work,
  WorkCreateBody,
  WorkPatch,
  WorkRegisterPreview,
  WorksPage,
  WorksQuery,
} from "@mimimilli/shared";
import { type Db } from "./db.ts";
import { buildFileTree } from "./fileTree.ts";
import { patchMetaFile } from "./meta.ts";
import { resolveWithin } from "./paths.ts";
import { Scanner } from "./scanner.ts";
import { logDataIntegritySkips, toDataIntegrityWarning } from "./dataIntegrity.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import { WorkRepo } from "./workRepo.ts";
import {
  buildWorkRegisterPreview,
  createWorkFromFolder,
  unregisterWork,
  WorkRegisterError,
} from "./workRegister.ts";

const scanLogger = getCategoryLogger("scan");

export function createWorkMethods(deps: {
  db: Db;
  repo: WorkRepo;
  scanner: Scanner;
  requireRoot: () => string;
  cachedCover: (coverUrl: string, workDir: string, signal?: AbortSignal) => Promise<string>;
}) {
  const { db, repo, scanner, requireRoot, cachedCover } = deps;
  return {
    async queryWorks(params: WorksQuery): Promise<WorksPage> {
      return repo.queryWorks(params);
    },

    async getDlsiteNotificationSummary(): Promise<DlsiteNotificationSummary> {
      return repo.getDlsiteNotificationSummary();
    },

    async queryDlsiteNotifications(
      kind: DlsiteNotificationKind,
      query: Required<DlsiteNotificationQuery>,
    ): Promise<DlsiteNotificationPage> {
      return repo.queryDlsiteNotifications(kind, query);
    },

    async getWork(id: string): Promise<Work | null> {
      return repo.getWork(id);
    },

    async getWorkRegisterPreview(path: string): Promise<WorkRegisterPreview | null> {
      const root = requireRoot();
      const workDir = resolveWithin(root, path);
      if (!workDir) return null;
      try {
        if (!statSync(workDir).isDirectory()) return null;
      } catch {
        return null;
      }
      return buildWorkRegisterPreview(repo, workDir);
    },

    async createWork(body: WorkCreateBody): Promise<Work | null> {
      const root = requireRoot();
      try {
        return await createWorkFromFolder(repo, scanner, root, body, (coverUrl, workDir) =>
          cachedCover(coverUrl, workDir),
        );
      } catch (error) {
        if (error instanceof WorkRegisterError) throw error;
        throw error;
      }
    },

    async deleteWork(id: string): Promise<boolean> {
      return unregisterWork(repo, id);
    },

    async patchWork(id: string, patch: WorkPatch): Promise<Work | null> {
      if (patch.title === undefined && patch.tags === undefined) {
        const updated = repo.patchWork(id, patch);
        if (!updated) return null;
        return repo.getWork(id);
      }
      // user書き込みはcatalogトランザクションの外で先に確定させる。
      if (patch.bookmarked !== undefined) {
        const updated = repo.patchWork(id, { bookmarked: patch.bookmarked });
        if (!updated) return null;
      }
      const ok = db.transaction(() => {
        const updated = repo.patchWork(id, {
          title: patch.title,
          tags: patch.tags,
        });
        if (!updated) return false;
        patchMetaFile(updated.metaPath, { title: patch.title, tags: patch.tags });
        return true;
      });
      if (!ok) return null;
      return repo.getWork(id);
    },

    async saveResume(id: string, body: ResumeBody): Promise<boolean> {
      return repo.saveResume(id, body);
    },

    async touchLastPlayed(id: string): Promise<boolean> {
      return repo.touchLastPlayed(id);
    },

    async listWorkFiles(id: string): Promise<FileEntry | null> {
      const work = await repo.getWork(id);
      if (!work) return null;
      return buildFileTree(work.physicalPath);
    },

    async listTags(): Promise<string[]> {
      return repo.listAllTagNames();
    },

    async exportLibrary(): Promise<{ data: string; dataIntegrityWarning?: DataIntegrityWarning }> {
      const { summaries, skipped } = repo.listSummaries();
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
