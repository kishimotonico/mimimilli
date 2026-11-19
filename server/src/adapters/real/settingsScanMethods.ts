import { realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { requireConfiguredRoot } from "../../core/rootFolder.ts";
import { InvalidRootFolderError } from "../../errors.ts";
import type {
  RootReconfigurationRecord,
  ScanOptions,
  StoredSettings,
} from "../../adapter/index.ts";
import type {
  DlsiteRegistrationApply,
  ScanCandidate,
  ScanCandidatesRegisterResponse,
  ScanResult,
} from "@mimimilli/shared";
import { z } from "zod";
import { formatError, getCategoryLogger } from "../../lib/logger.ts";
import { type DbLocation } from "./db.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import type { DlsiteParser } from "./dlsite.ts";
import { createDlsiteProductResolver, readUsableDlsite } from "./dlsiteProductResolve.ts";
import { Scanner } from "./scanner.ts";
import { createCandidateDlsiteSource, groupMissingWorksByRjCode } from "./scanCandidateDlsite.ts";
import { ScanCandidateSession, type CandidateListContext } from "./scanCandidateSession.ts";
import { LAST_SCAN_TIME_KEY, scanAndFinalize } from "./scanFinalize.ts";
import type { ScanExecutionResult } from "./scanTypes.ts";
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
    "listSummaries" | "listMissingWorksWithRjCode" | "listWorkPhysicalPaths"
  >;
  catalog: Pick<
    CatalogWorkRepository,
    | "getScanState"
    | "setScanState"
    | "listIdentityConflicts"
    | "listInvalidMetaFiles"
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
  let candidateSession = ScanCandidateSession.empty();
  const resolveDlsiteProduct = createDlsiteProductResolver(dlsiteCache, deps.parser);
  const candidateDlsite = createCandidateDlsiteSource(dlsiteCache, resolveDlsiteProduct);
  const readUsableInfo = (productCode: string) =>
    readUsableDlsite(resolveDlsiteProduct, productCode)?.info ?? null;
  const candidateStores = { user, query };
  const candidateListContext = (): CandidateListContext => ({
    dlsite: candidateDlsite,
    missingWorksByRjCode: groupMissingWorksByRjCode(query.listMissingWorksWithRjCode()),
  });
  const requireRoot = (): string => requireConfiguredRoot(user.getUserSetting(KEY_ROOT_FOLDER));
  const getSettings = async (): Promise<StoredSettings> => ({
    rootFolder: user.getUserSetting(KEY_ROOT_FOLDER),
    lastScanTime: catalog.getScanState(LAST_SCAN_TIME_KEY),
  });
  const scanRoot = async (root: string, normalized: ScanOptions): Promise<ScanResult> => {
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
      candidateSession = ScanCandidateSession.fromPool(execution.candidatePool, root);
      return execution.result;
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
    candidateSession = ScanCandidateSession.fromPool(execution.candidatePool, root);
    return execution.result;
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

    async beginRootReconfiguration(rootFolder: string): Promise<void> {
      const previousRoot = user.getUserSetting(KEY_ROOT_FOLDER);
      const rootChanged = previousRoot !== null && previousRoot !== rootFolder;
      const running: StoredRootReconfiguration = { phase: "running" };
      user.setUserSettings(
        { [KEY_ROOT_FOLDER]: rootFolder, [KEY_ROOT_RECONFIGURATION]: JSON.stringify(running) },
        { discardScanCandidateExclusions: rootChanged },
      );
      if (rootChanged) {
        candidateSession = ScanCandidateSession.empty();
        catalog.clearDiagnostics();
      }
    },

    async rebuildCatalogForRoot(
      rootFolder: string,
      options: Omit<ScanOptions, "full">,
    ): Promise<ScanResult> {
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

    async scan(scanOptions?: ScanOptions): Promise<ScanResult> {
      return scanRoot(requireRoot(), scanOptions ?? {});
    },

    async listScanDiagnostics() {
      return {
        identityConflicts: catalog.listIdentityConflicts(),
        invalidMetaFiles: catalog.listInvalidMetaFiles(),
      };
    },
    async listScanCandidates(): Promise<ScanCandidate[]> {
      const root = user.getUserSetting(KEY_ROOT_FOLDER);
      if (!root) return [];
      return candidateSession.listCandidates(root, candidateStores, candidateListContext());
    },
    async setScanCandidateRjCode(path: string, rjCode: string | null): Promise<ScanCandidate> {
      return candidateSession.setRjCode(
        requireRoot(),
        path,
        rjCode,
        candidateStores,
        candidateListContext(),
      );
    },
    async registerScanCandidates(
      paths: string[],
      apply: DlsiteRegistrationApply,
    ): Promise<ScanCandidatesRegisterResponse> {
      return candidateSession.registerCandidates(requireRoot(), paths, apply, {
        scanner,
        stores: candidateStores,
        dlsiteCache,
        readUsableInfo,
      });
    },
    async excludeScanCandidates(paths: string[]): Promise<void> {
      await candidateSession.excludeCandidates(requireRoot(), paths, candidateStores, user);
    },
    async listScanCandidateExclusions(): Promise<string[]> {
      return candidateSession.listExcludedCandidates(user);
    },
    async restoreScanCandidateExclusions(paths: string[]): Promise<void> {
      candidateSession.restoreExcludedCandidates(paths, user);
    },
    requireRoot,
  };
}
