// real アダプタ: SQLite（キャッシュ）+ 実ファイルシステム + `mimimilli.json`（Source of Truth）。
// 作品検索・件数・ページングはcatalog接続からuser DBをATTACH JOINしてSQLで実行する。
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ScanProgressEvent, ScanResult } from "@mimimilli/shared";
import type { DataAdapter, ScanOptions } from "../../adapter.ts";
import { openDb, type Db, type DbLocation } from "./db.ts";
import { DlsiteCache, type DlsiteCacheOptions } from "./dlsiteCache.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG, type DlsiteRequestConfig } from "./dlsiteConfig.ts";
import { DlsiteScheduler, type DlsiteSchedulerDependencies } from "./dlsiteScheduler.ts";
import { Scanner } from "./scanner.ts";
import {
  measureCoverDimensions,
  ThumbnailCache,
  type ThumbnailCacheOptions,
} from "./thumbnailCache.ts";
import { WorkRepo } from "./workRepo.ts";
import { formatError, getCategoryLogger } from "../../lib/logger.ts";
import { createDlsiteMethods } from "./dlsiteMethods.ts";
import { createCoverMediaMethods } from "./coverMediaMethods.ts";
import { createSettingsScanMethods } from "./settingsScanMethods.ts";
import { createWorkMethods } from "./workMethods.ts";
import { createClassificationMethods, initializeTagPrefixes } from "./classificationMethods.ts";

const scanLogger = getCategoryLogger("scan");
export interface RealAdapterOptions {
  database: DbLocation;
  /** カバーサムネイルのキャッシュ置き場。ファイルDBの通常起動ではデータルート配下を渡す。 */
  thumbnailCacheDir?: string;
  /** サムネイル変換の同時実行数・変換関数（テスト用）を注入する。 */
  thumbnailCache?: ThumbnailCacheOptions;
  /** manifestとバックアップを保存するデータルート。 */
  dataRoot?: string;
  /** DBバックアップ退避先。ファイルDBの通常起動ではデータルート配下を渡す。 */
  dbBackupDir?: string;
  /** DLsiteの実HTTP設定。環境変数の解決はserver/src/index.tsだけで行う。 */
  dlsiteRequestConfig?: DlsiteRequestConfig;
  /** schedulerのtransport/clock/sleep/random/logger注入。実ネットワークなしの試験用。 */
  dlsiteSchedulerDependencies?: DlsiteSchedulerDependencies;
  /** DLsiteレスポンスキャッシュ。 */
  dlsiteCache: DlsiteCacheOptions;
  /** Worker隔離の結合テストで同期停止を作るSharedArrayBuffer。実運用では指定しない。 */
  scanWorkerTestGate?: SharedArrayBuffer;
  /** test gateを停止させる位置。省略時はscanner開始前。 */
  scanWorkerTestGateStage?: "before-scan" | "before-finalize";
  /** Workerがtest gateへ到達したことを通知する結合テスト用フック。 */
  onScanWorkerTestGateReady?: () => void;
}

export interface RealAdapter extends DataAdapter {
  close(): void;
}

interface ScanWorkerMessage {
  type: "progress" | "completed" | "cancelled" | "error" | "test-gate-ready";
  progress?: ScanProgressEvent;
  result?: ScanResult;
  message?: string;
  errorKind?: string;
  stack?: string;
}

function reconstructWorkerError(message: ScanWorkerMessage): Error {
  const error = new Error(message.message ?? "スキャンワーカーが失敗しました");
  if (message.errorKind) error.name = message.errorKind;
  if (message.stack) error.stack = message.stack;
  return error;
}

async function runFileScanInWorker(
  database: Extract<DbLocation, { kind: "files" }>,
  root: string,
  dataRoot: string,
  thumbnailCacheDir: string,
  options: ScanOptions,
  testGate?: SharedArrayBuffer,
  testGateStage: "before-scan" | "before-finalize" = "before-scan",
  onTestGateReady?: () => void,
): Promise<ScanResult> {
  const abortBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const token = new Int32Array(abortBuffer);
  const worker = new Worker(new URL("./scanWorker.ts", import.meta.url), { type: "module" });
  return new Promise<ScanResult>((resolveResult, rejectResult) => {
    let settled = false;
    let terminalReceived = false;
    const abort = () => {
      Atomics.store(token, 0, 1);
      if (testGate) {
        const gate = new Int32Array(testGate);
        Atomics.store(gate, 0, 2);
        Atomics.notify(gate, 0);
      }
    };
    const onMessage = (event: MessageEvent<ScanWorkerMessage>) => {
      const message = event.data;
      if (message.type === "test-gate-ready") {
        onTestGateReady?.();
        return;
      }
      if (message.type === "progress" && message.progress) {
        options.onProgress?.(message.progress);
        return;
      }
      terminalReceived = true;
      if (message.type === "completed" && message.result) {
        settle(() => resolveResult(message.result!));
      } else if (message.type === "cancelled") {
        settle(() =>
          rejectResult(new DOMException("スキャンはキャンセルされました", "AbortError")),
        );
      } else {
        settle(() => rejectResult(reconstructWorkerError(message)));
      }
    };
    const onError = (event: ErrorEvent) => {
      scanLogger.error("スキャンワーカーでエラーが発生しました", {
        source: "worker-error",
        ...formatError(event.error ?? new Error(event.message)),
      });
      settle(() => rejectResult(event.error ?? new Error(event.message)));
    };
    const onMessageError = () => {
      scanLogger.error("スキャンワーカーでエラーが発生しました", {
        source: "worker-messageerror",
      });
      settle(() => rejectResult(new Error("スキャンワーカーのメッセージを復元できません")));
    };
    const onClose = () => {
      if (!terminalReceived) {
        scanLogger.error("スキャンワーカーでエラーが発生しました", {
          source: "worker-close",
        });
        settle(() => rejectResult(new Error("スキャンワーカーが結果を返さず終了しました")));
      }
    };
    const cleanup = () => {
      options.signal?.removeEventListener("abort", abort);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      worker.removeEventListener("messageerror", onMessageError);
      worker.removeEventListener("close", onClose);
      worker.terminate();
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.addEventListener("messageerror", onMessageError);
    // Bun 1.3.14のWorkerEventMapはcloseを公開する。exitイベントは公開されていない。
    worker.addEventListener("close", onClose);
    worker.postMessage({
      type: "start",
      input: {
        database,
        root,
        dataRoot,
        thumbnailCacheDir,
        abortBuffer,
        full: options.full ?? false,
        testGate,
        testGateStage,
      },
    });
  });
}

export function createRealAdapter(options: RealAdapterOptions): RealAdapter {
  const db: Db = openDb(
    options.database,
    options.dbBackupDir === undefined ? undefined : { backupDir: options.dbBackupDir },
  );
  const dlsiteCache = new DlsiteCache(options.dlsiteCache);
  const repo = new WorkRepo(db);
  const thumbnailCacheDir = options.thumbnailCacheDir ?? join(tmpdir(), "mimimilli-memory-cache");
  const thumbnailCache = new ThumbnailCache(options.thumbnailCache);
  const dataRoot =
    options.dataRoot ??
    (options.database.kind === "files"
      ? dirname(dirname(options.database.catalogPath))
      : join(tmpdir(), "mimimilli-memory-data"));
  const scanner = new Scanner(db, repo, dataRoot, { measureCover: measureCoverDimensions });
  const dlsiteRequestConfig: DlsiteRequestConfig = {
    ...DEFAULT_DLSITE_REQUEST_CONFIG,
    ...options.dlsiteRequestConfig,
  };
  const dlsiteScheduler = new DlsiteScheduler(
    dlsiteRequestConfig,
    options.dlsiteSchedulerDependencies,
  );
  initializeTagPrefixes(repo);

  const { cachedCover, ...dlsiteMethods } = createDlsiteMethods({
    db,
    repo,
    dlsiteCache,
    dlsiteCacheOptions: options.dlsiteCache,
    dlsiteRequestConfig,
    dlsiteScheduler,
    schedulerDependencies: options.dlsiteSchedulerDependencies,
  });
  const { requireRoot, ...settingsScanMethods } = createSettingsScanMethods({
    database: options.database,
    repo,
    scanner,
    dataRoot,
    thumbnailCacheDir,
    runFileScanInWorker,
    scanWorkerTestGate: options.scanWorkerTestGate,
    scanWorkerTestGateStage: options.scanWorkerTestGateStage,
    onScanWorkerTestGateReady: options.onScanWorkerTestGateReady,
  });
  const coverMediaMethods = createCoverMediaMethods({
    repo,
    thumbnailCache,
    thumbnailCacheDir,
    requireRoot,
  });
  const workMethods = createWorkMethods({ db, repo, scanner, requireRoot, cachedCover });
  const classificationMethods = createClassificationMethods({ repo });

  return {
    ...settingsScanMethods,
    ...workMethods,
    ...classificationMethods,
    ...coverMediaMethods,
    ...dlsiteMethods,
    close(): void {
      dlsiteCache.close();
      db.close();
    },
  };
}
