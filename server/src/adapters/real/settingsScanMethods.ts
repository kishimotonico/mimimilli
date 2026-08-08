import { realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { type ScanOptions, NotConfiguredError } from "../../adapter.ts";
import type { ScanResult, Settings, SettingsUpdate } from "@mimimilli/shared";
import { formatError, getCategoryLogger } from "../../lib/logger.ts";
import { type DbLocation } from "./db.ts";
import { logDataIntegritySkips } from "./dataIntegrity.ts";
import { resolveWithin } from "./paths.ts";
import { Scanner } from "./scanner.ts";
import { gcThumbnailCache, type WorkCoverEntry } from "./thumbnailCache.ts";
import { WorkRepo } from "./workRepo.ts";

const scanLogger = getCategoryLogger("scan");
const serverLogger = getCategoryLogger("server");
const KEY_ROOT_FOLDER = "root_folder";
const KEY_LAST_SCAN_TIME = "last_scan_time";

export function createSettingsScanMethods(deps: {
  database: DbLocation;
  repo: Pick<
    WorkRepo,
    "getUserSetting" | "getScanState" | "setUserSetting" | "listSummaries" | "setScanState"
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
    testGate?: SharedArrayBuffer,
    testGateStage?: "before-scan" | "before-finalize",
    onTestGateReady?: () => void,
  ) => Promise<ScanResult>;
  scanWorkerTestGate?: SharedArrayBuffer;
  scanWorkerTestGateStage?: "before-scan" | "before-finalize";
  onScanWorkerTestGateReady?: () => void;
}) {
  const {
    database,
    repo,
    scanner,
    dataRoot,
    thumbnailCacheDir,
    runFileScanInWorker,
    scanWorkerTestGate,
    scanWorkerTestGateStage,
    onScanWorkerTestGateReady,
  } = deps;
  const requireRoot = (): string => {
    const root = repo.getUserSetting(KEY_ROOT_FOLDER);
    if (!root)
      throw new NotConfiguredError(
        "ルートフォルダーが設定されていません（PUT /api/settings で設定してください）",
      );
    return root;
  };
  const getSettings = async (): Promise<Settings> => ({
    rootFolder: repo.getUserSetting(KEY_ROOT_FOLDER),
    lastScanTime: repo.getScanState(KEY_LAST_SCAN_TIME),
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
      repo.setUserSetting(KEY_ROOT_FOLDER, absRoot);
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
          scanWorkerTestGate,
          scanWorkerTestGateStage,
          onScanWorkerTestGateReady,
        );
      }
      const result = await scanner.scan(root, normalized);
      const checkAbort = () => {
        if (normalized.signal?.aborted) {
          throw new DOMException("スキャンはキャンセルされました", "AbortError");
        }
      };
      checkAbort();

      // 全作品を走査した直後の自然なタイミングでサムネイルキャッシュをGCする（TASK-26）
      const coverEntries: WorkCoverEntry[] = [];
      const { summaries, skipped } = repo.listSummaries();
      logDataIntegritySkips(scanLogger, "scan-thumbnail-gc", skipped);
      for (const work of summaries) {
        checkAbort();
        if (!work.cover) continue;
        const resolved = resolveWithin(
          work.physicalPath,
          join(work.physicalPath, work.cover.image),
        );
        if (!resolved) continue;
        coverEntries.push({ workId: work.id, coverAbsolutePath: resolved });
      }
      checkAbort();
      const gcResult = await gcThumbnailCache(thumbnailCacheDir, coverEntries, {
        throwIfCancelled: checkAbort,
      });
      checkAbort();
      if (gcResult.deleted > 0 || gcResult.skippedWorks > 0) {
        scanLogger.warn("サムネイルキャッシュGCを実行しました", {
          deleted: gcResult.deleted,
          kept: gcResult.kept,
          skippedWorks: gcResult.skippedWorks,
        });
      }

      checkAbort();
      repo.setScanState(KEY_LAST_SCAN_TIME, new Date().toISOString());

      return result;
    },
    requireRoot,
  };
}
