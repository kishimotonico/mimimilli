import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { NotConfiguredError } from "../../errors.ts";
import type { ScanOptions } from "../../adapter/index.ts";
import type {
  ScanCandidate,
  ScanCandidatesRegisterResponse,
  ScanResult,
  Settings,
  SettingsUpdate,
} from "@mimimilli/shared";
import { formatError, getCategoryLogger } from "../../lib/logger.ts";
import { type DbLocation } from "./db.ts";
import { Scanner } from "./scanner.ts";
import { finalizeScan, LAST_SCAN_TIME_KEY } from "./scanFinalize.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { UserWorkStateRepository } from "./userWorkStateRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

const serverLogger = getCategoryLogger("server");
const KEY_ROOT_FOLDER = "root_folder";

export function createSettingsScanMethods(deps: {
  database: DbLocation;
  query: Pick<WorkQueryRepository, "listSummaries">;
  catalog: Pick<CatalogWorkRepository, "getScanState" | "setScanState" | "listIdentityConflicts">;
  user: Pick<
    UserWorkStateRepository,
    "getUserSetting" | "setUserSetting" | "listScanCandidateExclusions" | "excludeScanCandidates"
  >;
  scanner: Scanner;
  dataRoot: string;
  thumbnailCacheDir: string;
  runFileScanInWorker: (
    database: Extract<DbLocation, { kind: "files" }>,
    root: string,
    dataRoot: string,
    thumbnailCacheDir: string,
    options: ScanOptions,
  ) => Promise<ScanResult>;
}) {
  const {
    database,
    query,
    catalog,
    user,
    scanner,
    dataRoot,
    thumbnailCacheDir,
    runFileScanInWorker,
  } = deps;
  const requireRoot = (): string => {
    const root = user.getUserSetting(KEY_ROOT_FOLDER);
    if (!root)
      throw new NotConfiguredError(
        "ルートフォルダーが設定されていません（PUT /api/settings で設定してください）",
      );
    return root;
  };
  const getSettings = async (): Promise<Settings> => ({
    rootFolder: user.getUserSetting(KEY_ROOT_FOLDER),
    lastScanTime: catalog.getScanState(LAST_SCAN_TIME_KEY),
  });
  return {
    getSettings,

    async updateSettings(patch: SettingsUpdate): Promise<Settings> {
      // 正規化した絶対パスで保存する。スキャンが記録する physicalPath / fs ブラウズの
      // realpath と表現を一致させるため（相対パスのまま保存すると突合に失敗する）
      let absRoot: string;
      try {
        absRoot = realpathSync(resolve(patch.rootFolder));
      } catch (error) {
        const properties: Record<string, unknown> = {
          requestedPath: patch.rootFolder,
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
        throw new NotConfiguredError(
          `指定されたルートフォルダーが存在しません: ${patch.rootFolder}`,
        );
      }
      serverLogger.info("ルートフォルダーを解決しました", {
        requestedPath: patch.rootFolder,
        resolvedPath: absRoot,
      });
      user.setUserSetting(KEY_ROOT_FOLDER, absRoot);
      return getSettings();
    },

    async scan(scanOptions?: ScanOptions): Promise<ScanResult> {
      const root = requireRoot();
      const normalized = scanOptions ?? {};
      if (database.kind === "files") {
        return runFileScanInWorker(
          {
            ...database,
            catalogPath: resolve(database.catalogPath),
            userPath: resolve(database.userPath),
          },
          resolve(root),
          resolve(dataRoot),
          resolve(thumbnailCacheDir),
          normalized,
        );
      }
      const result = await scanner.scan(root, normalized);
      const checkAbort = () => {
        if (normalized.signal?.aborted) {
          throw new DOMException("スキャンはキャンセルされました", "AbortError");
        }
      };
      await finalizeScan({
        query,
        catalog,
        thumbnailCacheDir,
        throwIfCancelled: checkAbort,
        integrityLogContext: "scan-thumbnail-gc",
      });

      return result;
    },

    async listScanDiagnostics() {
      return catalog.listIdentityConflicts();
    },
    async listScanCandidates(): Promise<ScanCandidate[]> {
      return scanner.listCandidates(requireRoot());
    },
    async registerScanCandidates(
      paths: string[],
      onRegistered?: (workId: string) => void,
    ): Promise<ScanCandidatesRegisterResponse> {
      return scanner.registerCandidates(requireRoot(), paths, onRegistered);
    },
    async excludeScanCandidates(paths: string[]): Promise<void> {
      await scanner.excludeCandidates(requireRoot(), paths);
    },
    requireRoot,
  };
}
