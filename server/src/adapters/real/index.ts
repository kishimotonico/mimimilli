// real アダプタ: SQLite（キャッシュ）+ 実ファイルシステム + `mimimilli.json`（Source of Truth）。
// 作品検索・件数・ページングはcatalog接続からuser DBをATTACH JOINしてSQLで実行する。
import { realpathSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import {
  applyDlsiteStatePatch,
  DEFAULT_TAG_PREFIXES,
  dedupeTags,
  tagEquals,
} from "@mimimilli/shared";
import type {
  AxisFacetItem,
  DataIntegrityWarning,
  DlsiteApplyBody,
  DlsiteBulkMode,
  DlsiteBulkProgressEvent,
  DlsiteBulkResult,
  DlsiteFetchResult,
  DlsiteNotificationKind,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  DlsiteStatePatch,
  FileEntry,
  FsListing,
  NormalizedTag,
  ResumeBody,
  ScanProgressEvent,
  ScanResult,
  Settings,
  SettingsUpdate,
  SmartFolder,
  SmartFolderCreate,
  SmartFolderUpdate,
  TagPrefix,
  TagPrefixCandidate,
  TagPrefixCreate,
  TagPrefixUpdate,
  Work,
  WorkCreateBody,
  WorkPatch,
  WorkRegisterPreview,
  WorksPage,
  WorksQuery,
} from "@mimimilli/shared";
import {
  createCoverValidators,
  NotConfiguredError,
  type AxisFacetsFilter,
  type CoverDescriptor,
  type DataAdapter,
  type MediaKind,
  type MediaLocation,
  type SmartFolderEvalQuery,
} from "../../adapter.ts";
import type { ScanOptions } from "../../adapter.ts";
import { isDefaultTitle } from "../../core/dlsiteTitle.ts";
import { buildTagPrefixCandidates } from "../../core/tagPrefixCandidates.ts";
import { openDb, type Db, type DbLocation } from "./db.ts";
import {
  detectRjCode,
  fetchDlsiteCover,
  fetchDlsiteHtml,
  listDlsiteMissingFields,
  mergeDlsiteTags,
  normalizeDlsiteCoverUrl,
  parseDlsiteHtml,
} from "./dlsite.ts";
import {
  DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES,
  DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES,
  DlsiteCache,
  type DlsiteCacheOptions,
} from "./dlsiteCache.ts";
import { DEFAULT_DLSITE_REQUEST_CONFIG, type DlsiteRequestConfig } from "./dlsiteConfig.ts";
import {
  DlsiteOfflineError,
  DlsiteScheduler,
  type DlsiteHttpLogContext,
  type DlsiteSchedulerDependencies,
} from "./dlsiteScheduler.ts";
import { browseFs } from "./fsBrowse.ts";
import { buildFileTree } from "./fileTree.ts";
import { patchMetaFile } from "./meta.ts";
import { mimeOf, isAudioPath, resolveWithin } from "./paths.ts";
import { Scanner } from "./scanner.ts";
import {
  gcThumbnailCache,
  measureCoverDimensions,
  ThumbnailCache,
  type ThumbnailCacheOptions,
  type WorkCoverEntry,
} from "./thumbnailCache.ts";
import type { CoverColumns } from "./workRepo.ts";
import { WorkRepo } from "./workRepo.ts";
import {
  buildWorkRegisterPreview,
  createWorkFromFolder,
  unregisterWork,
  WorkRegisterError,
} from "./workRegister.ts";
import { querySmartFolderWorks } from "./smartFolderWorks.ts";
import { logDataIntegritySkips, toDataIntegrityWarning } from "./dataIntegrity.ts";
import { SharedFlightPool, throwIfAborted } from "./sharedFlight.ts";
import { formatError, getCategoryLogger } from "../../lib/logger.ts";
import { createDlsiteMethods } from "./dlsiteMethods.ts";

const dlsiteLogger = getCategoryLogger("dlsite");
const scanLogger = getCategoryLogger("scan");
const serverLogger = getCategoryLogger("server");

const KEY_ROOT_FOLDER = "root_folder";
const KEY_LAST_SCAN_TIME = "last_scan_time";
const KEY_TAG_PREFIXES_SEEDED = "tag_prefixes_seeded";
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
  const dlsiteMethods = createDlsiteMethods({
    db,
    repo,
    dlsiteCache,
    dlsiteCacheOptions: options.dlsiteCache,
    dlsiteRequestConfig,
    dlsiteScheduler,
    schedulerDependencies: options.dlsiteSchedulerDependencies,
  });
  const { cachedCover } = dlsiteMethods;

  // prefix 定義の初回 seed（ADR-0005）。seed 済みフラグで管理し、
  // ユーザーが全定義を削除しても再投入しない
  if (repo.getUserSetting(KEY_TAG_PREFIXES_SEEDED) === null) {
    for (const def of DEFAULT_TAG_PREFIXES) {
      repo.createTagPrefix(def);
    }
    repo.setUserSetting(KEY_TAG_PREFIXES_SEEDED, "1");
  }

  function requireRoot(): string {
    const root = repo.getUserSetting(KEY_ROOT_FOLDER);
    if (!root) {
      throw new NotConfiguredError(
        "ルートフォルダーが設定されていません（PUT /api/settings で設定してください）",
      );
    }
    return root;
  }

  async function describeCover(workId: string, width?: number): Promise<CoverDescriptor | null> {
    const work = repo.getCoverLocation(workId);
    if (!work?.coverImage) return null;

    const sourceAbsolutePath = resolveWithin(
      work.physicalPath,
      join(work.physicalPath, work.coverImage),
    );
    if (!sourceAbsolutePath) return null;

    let sourceStat: Awaited<ReturnType<typeof stat>>;
    try {
      sourceStat = await stat(sourceAbsolutePath);
    } catch {
      return null;
    }
    if (!sourceStat.isFile()) return null;
    const source = { size: sourceStat.size, mtimeMs: sourceStat.mtimeMs };
    const validators = createCoverValidators(work.id, width, source);

    return {
      ...validators,
      async materialize(): Promise<MediaLocation> {
        if (width === undefined) {
          return {
            type: "file",
            absolutePath: sourceAbsolutePath,
            mime: mimeOf(sourceAbsolutePath),
            size: source.size,
          };
        }
        const thumbnail = await thumbnailCache.getOrCreate(
          thumbnailCacheDir,
          work.id,
          width,
          sourceAbsolutePath,
          source,
        );
        return {
          type: "file",
          absolutePath: thumbnail.absolutePath,
          mime: thumbnail.mime,
          size: thumbnail.size,
        };
      },
    };
  }

  return {
    // ── 設定・スキャン ────────────────────────────────────────
    async getSettings(): Promise<Settings> {
      return {
        rootFolder: repo.getUserSetting(KEY_ROOT_FOLDER),
        lastScanTime: repo.getScanState(KEY_LAST_SCAN_TIME),
      };
    },

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
      return this.getSettings();
    },

    async scan(scanOptions?: ScanOptions): Promise<ScanResult> {
      const root = requireRoot();
      const normalized = scanOptions ?? {};
      if (options.database?.kind === "files") {
        return runFileScanInWorker(
          {
            ...options.database,
            catalogPath: resolve(options.database.catalogPath),
            userPath: resolve(options.database.userPath),
          },
          resolve(root),
          resolve(dataRoot),
          resolve(thumbnailCacheDir),
          normalized,
          options.scanWorkerTestGate,
          options.scanWorkerTestGateStage,
          options.onScanWorkerTestGateReady,
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

    // ── 作品 ──────────────────────────────────────────────────
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

    // ── 分類軸・タグ prefix 定義・スマートフォルダー・プリセット ──
    async getAxisFacets(axis: string, filter?: AxisFacetsFilter): Promise<AxisFacetItem[]> {
      return repo.getAxisFacets(axis, filter);
    },

    async listTagPrefixes(): Promise<TagPrefix[]> {
      return repo.listTagPrefixes();
    },
    async createTagPrefix(input: TagPrefixCreate): Promise<TagPrefix | null> {
      return repo.createTagPrefix(input);
    },
    async updateTagPrefix(prefix: string, patch: TagPrefixUpdate): Promise<TagPrefix | null> {
      return repo.updateTagPrefix(prefix, patch);
    },
    async deleteTagPrefix(prefix: string): Promise<boolean> {
      return repo.deleteTagPrefix(prefix);
    },
    async listTagPrefixCandidates(): Promise<TagPrefixCandidate[]> {
      const { summaries, skipped } = repo.listSummaries();
      logDataIntegritySkips(scanLogger, "tag-prefix-candidates", skipped);
      return buildTagPrefixCandidates(
        summaries,
        repo.listTagPrefixes().map((p) => p.prefix),
      );
    },

    async listSmartFolders(): Promise<SmartFolder[]> {
      return repo.listSmartFolders();
    },
    async createSmartFolder(input: SmartFolderCreate): Promise<SmartFolder> {
      return repo.createSmartFolder(input);
    },
    async updateSmartFolder(id: string, input: SmartFolderUpdate): Promise<SmartFolder | null> {
      return repo.updateSmartFolder(id, input);
    },
    async deleteSmartFolder(id: string): Promise<boolean> {
      return repo.deleteSmartFolder(id);
    },
    async evalSmartFolder(id: string, query: SmartFolderEvalQuery): Promise<WorksPage | null> {
      const folder = repo.getSmartFolder(id);
      if (!folder) return null;
      return querySmartFolderWorks(repo, folder, query);
    },

    // ── 物理ファイルシステム ───────────────────────────────────
    async browseFs(path?: string): Promise<FsListing | null> {
      const root = requireRoot();
      const realRoot = resolveWithin(root, root);
      if (realRoot === null) return null;
      const target = resolveWithin(root, path ?? root);
      if (target === null) return null;
      return browseFs(realRoot, repo.listFsWorkRefs(target), target);
    },

    // ── メディア・DLsite ──────────────────────────────────────
    async locateFsAudio(absolutePath: string): Promise<MediaLocation | null> {
      const root = requireRoot();
      const resolved = resolveWithin(root, absolutePath);
      if (!resolved || !isAudioPath(resolved)) return null;
      try {
        const stats = await stat(resolved);
        if (!stats.isFile()) return null;
      } catch {
        return null;
      }
      return { type: "file", absolutePath: resolved, mime: mimeOf(resolved) };
    },

    async locateMedia(
      _kind: MediaKind,
      workId: string,
      relPath?: string,
    ): Promise<MediaLocation | null> {
      const root = repo.getMediaRoot(workId);
      if (!root) return null;

      const rel = relPath;
      if (!rel) return null;

      const resolved = resolveWithin(root.physicalPath, join(root.physicalPath, rel));
      if (!resolved) return null;

      return { type: "file", absolutePath: resolved, mime: mimeOf(resolved) };
    },

    async describeCover(workId: string, width?: number): Promise<CoverDescriptor | null> {
      return describeCover(workId, width);
    },

    ...dlsiteMethods,

    close(): void {
      dlsiteCache.close();
      db.close();
    },
  };
}

function tagsEqual(a: readonly NormalizedTag[], b: readonly NormalizedTag[]): boolean {
  return a.length === b.length && a.every((value, index) => tagEquals(value, b[index]!));
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
