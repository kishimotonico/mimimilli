import { realpathSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { requireConfiguredRoot } from "../../core/rootFolder.ts";
import { InvalidRootFolderError } from "../../errors.ts";
import type {
  RootReconfigurationRecord,
  ScanExecution,
  ScanExecutionResult,
  ScanOptions,
  StoredSettings,
} from "../../adapter/index.ts";
import { z } from "zod";
import type { ScanDiagnostics } from "@mimimilli/shared";
import { formatError, getCategoryLogger } from "../../lib/logger.ts";
import { type DbLocation } from "./db.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import type { DlsiteParser } from "./dlsite.ts";
import { createDlsiteProductResolver, readUsableDlsite } from "./dlsiteProductResolve.ts";
import { identityConflictMetaPath } from "./paths.ts";
import { Scanner } from "./scanner.ts";
import { createCandidateDlsiteSource } from "./scanCandidateDlsite.ts";
import { createCandidateMaterials, resolveRootIdentity } from "./scanCandidateMaterials.ts";
import { LAST_SCAN_TIME_KEY, scanAndFinalize } from "./scanFinalize.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

const serverLogger = getCategoryLogger("server");
const KEY_ROOT_FOLDER = "root_folder";
const KEY_ROOT_RECONFIGURATION = "root_reconfiguration";
const KEY_ROOT_RECONFIGURATION_COMPLETED_AT = "root_reconfiguration_completed_at";

const storedRootReconfigurationSchema = z.discriminatedUnion("phase", [
  z.object({ phase: z.literal("running") }),
  z.object({ phase: z.literal("failed"), message: z.string() }),
]);
type StoredRootReconfiguration = z.infer<typeof storedRootReconfigurationSchema>;

export function createSettingsScanMethods(deps: {
  database: DbLocation;
  query: Pick<
    WorkQueryRepository,
    | "listSummaries"
    | "listMissingWorksWithRjCode"
    | "listWorkPhysicalPaths"
    | "listDataIntegritySkips"
    | "listMissingWorks"
    | "getWorkIdentities"
  >;
  catalog: Pick<
    CatalogWorkRepository,
    | "getScanState"
    | "setScanState"
    | "listIdentityConflicts"
    | "listInvalidMetaFiles"
    | "listUnreadablePaths"
    | "clearDiagnostics"
    | "deleteWorksOutsideRoot"
  >;
  user: Pick<
    UserWorkStateRepository,
    | "getUserSetting"
    | "setUserSetting"
    | "listScanCandidateExclusions"
    | "excludeScanCandidates"
    | "restoreScanCandidateExclusions"
    | "setUserSettings"
    | "deleteUserSetting"
  >;
  scanner: Scanner;
  thumbnailCacheDir: string;
  dlsiteCache: DlsiteCache;
  parser: DlsiteParser;
  runFileScanInWorker: (
    database: Extract<DbLocation, { kind: "files" }>,
    root: string,
    thumbnailCacheDir: string,
    dlsiteCache: DlsiteCache["config"],
    options: ScanOptions,
  ) => Promise<ScanExecutionResult>;
}) {
  const {
    database,
    query,
    catalog,
    user,
    scanner,
    thumbnailCacheDir,
    dlsiteCache,
    runFileScanInWorker,
  } = deps;
  const resolveDlsiteProduct = createDlsiteProductResolver(dlsiteCache, deps.parser);
  const candidateDlsite = createCandidateDlsiteSource(dlsiteCache, resolveDlsiteProduct);
  const readUsableInfo = (productCode: string) =>
    readUsableDlsite(resolveDlsiteProduct, productCode)?.info ?? null;
  const requireRoot = (): string => requireConfiguredRoot(user.getUserSetting(KEY_ROOT_FOLDER));
  const candidateMaterials = createCandidateMaterials({
    getRoot: () => user.getUserSetting(KEY_ROOT_FOLDER),
    requireRoot,
    user,
    query,
    scanner,
    dlsiteCache,
    candidateDlsite,
    readUsableInfo,
  });
  const getSettings = async (): Promise<StoredSettings> => ({
    rootFolder: user.getUserSetting(KEY_ROOT_FOLDER),
    lastScanTime: catalog.getScanState(LAST_SCAN_TIME_KEY),
  });
  const scanRoot = async (root: string, normalized: ScanOptions): Promise<ScanExecution> => {
    const withRootIdentity = (execution: ScanExecutionResult): ScanExecution => ({
      ...execution,
      rootIdentity: resolveRootIdentity(root),
    });
    if (database.kind === "files") {
      const execution = await runFileScanInWorker(
        {
          ...database,
          catalogPath: resolve(database.catalogPath),
          userPath: resolve(database.userPath),
        },
        resolve(root),
        resolve(thumbnailCacheDir),
        dlsiteCache.config,
        normalized,
      );
      return withRootIdentity(execution);
    }
    const execution = await scanAndFinalize({
      scanner,
      query,
      catalog,
      thumbnailCacheDir,
      root,
      options: normalized,
      throwIfCancelled: () => {
        if (normalized.signal?.aborted) {
          throw new DOMException("スキャンはキャンセルされました", "AbortError");
        }
      },
    });
    return withRootIdentity(execution);
  };
  return {
    getSettings,

    async resolveRootFolder(requested: string): Promise<string> {
      // 正規化した絶対パスで保存する。スキャンが記録する physicalPath / fs ブラウズの
      // realpath と表現を一致させるため（相対パスのまま保存すると突合に失敗する）
      let absRoot: string;
      try {
        absRoot = realpathSync(resolve(requested));
      } catch (error) {
        const properties: Record<string, unknown> = {
          requestedPath: requested,
          ...formatError(error),
        };
        if (
          error instanceof Error &&
          "code" in error &&
          typeof (error as NodeJS.ErrnoException).code === "string"
        ) {
          properties.code = (error as NodeJS.ErrnoException).code;
        }
        serverLogger.warn("ルートフォルダーの解決に失敗しました", properties);
        throw new InvalidRootFolderError(`指定されたルートフォルダーが存在しません: ${requested}`);
      }
      if (!statSync(absRoot).isDirectory()) {
        serverLogger.warn("ルートフォルダーの解決に失敗しました", {
          requestedPath: requested,
          resolvedPath: absRoot,
          reason: "not-a-directory",
        });
        throw new InvalidRootFolderError(`指定されたパスはフォルダーではありません: ${requested}`);
      }
      serverLogger.info("ルートフォルダーを解決しました", {
        requestedPath: requested,
        resolvedPath: absRoot,
      });
      return absRoot;
    },

    async getRootReconfigurationRecord(): Promise<RootReconfigurationRecord | null> {
      const raw = user.getUserSetting(KEY_ROOT_RECONFIGURATION);
      if (raw === null) return null;
      const stored = storedRootReconfigurationSchema.parse(JSON.parse(raw));
      const rootFolder = requireRoot();
      return stored.phase === "running"
        ? { phase: "running", rootFolder }
        : { phase: "failed", rootFolder, message: stored.message };
    },

    async beginRootReconfiguration(rootFolder: string): Promise<{ rootChanged: boolean }> {
      const previousRoot = user.getUserSetting(KEY_ROOT_FOLDER);
      const rootChanged = previousRoot !== null && previousRoot !== rootFolder;
      const running: StoredRootReconfiguration = { phase: "running" };
      user.setUserSettings(
        { [KEY_ROOT_FOLDER]: rootFolder, [KEY_ROOT_RECONFIGURATION]: JSON.stringify(running) },
        { discardScanCandidateExclusions: rootChanged },
      );
      if (rootChanged) catalog.clearDiagnostics();
      return { rootChanged };
    },

    async rebuildCatalogForRoot(
      rootFolder: string,
      options: Omit<ScanOptions, "full">,
    ): Promise<ScanExecution> {
      const removed = catalog.deleteWorksOutsideRoot(rootFolder);
      serverLogger.info("ルートフォルダー外の作品をカタログから削除しました", {
        rootFolder,
        removed,
      });
      return scanRoot(rootFolder, { ...options, full: true });
    },

    async failRootReconfiguration(message: string): Promise<void> {
      const failed: StoredRootReconfiguration = { phase: "failed", message };
      user.setUserSetting(KEY_ROOT_RECONFIGURATION, JSON.stringify(failed));
    },

    async completeRootReconfiguration(): Promise<void> {
      user.deleteUserSetting(KEY_ROOT_RECONFIGURATION);
      user.setUserSetting(KEY_ROOT_RECONFIGURATION_COMPLETED_AT, new Date().toISOString());
    },

    async getRootReconfigurationCompletedAt(): Promise<string | null> {
      return user.getUserSetting(KEY_ROOT_RECONFIGURATION_COMPLETED_AT);
    },

    async scan(scanOptions?: ScanOptions): Promise<ScanExecution> {
      return scanRoot(requireRoot(), scanOptions ?? {});
    },

    async listScanDiagnostics(): Promise<ScanDiagnostics> {
      const root = requireRoot();
      const conflicts = catalog.listIdentityConflicts();
      const skips = query.listDataIntegritySkips();
      const identities = query.getWorkIdentities([
        ...conflicts.map((conflict) => conflict.workId),
        ...skips.map((skip) => skip.workId),
      ]);
      return {
        identityConflicts: conflicts.map((conflict) => {
          const registered = identities.get(conflict.workId);
          return {
            ...conflict,
            registeredTitle: registered?.title ?? null,
            registeredPath:
              conflict.paths.find(
                (path) => identityConflictMetaPath(join(root, path)) === registered?.metaPath,
              ) ?? null,
          };
        }),
        invalidMetaFiles: catalog.listInvalidMetaFiles(),
        unreadablePaths: catalog.listUnreadablePaths(),
        dataIntegrityWorks: skips.map((skip) => ({
          workId: skip.workId,
          title: identities.get(skip.workId)?.title ?? null,
        })),
        missingWorks: query.listMissingWorks(root),
      };
    },
    ...candidateMaterials,
    async excludeScanCandidates(paths: string[]): Promise<void> {
      user.excludeScanCandidates(paths);
    },
    async listScanCandidateExclusions(): Promise<string[]> {
      return user.listScanCandidateExclusions();
    },
    async restoreScanCandidateExclusions(paths: string[]): Promise<void> {
      user.restoreScanCandidateExclusions(paths);
    },
    requireRoot,
  };
}
