// real アダプタ: SQLite（キャッシュ）+ 実ファイルシステム + `.meta.json`（Source of Truth）。
// 作品検索・件数・ページングはcatalog接続からuser DBをATTACH JOINしてSQLで実行する。
import { realpathSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import {
  applyDlsiteStatePatch,
  DEFAULT_TAG_PREFIXES,
  normalizeTags,
  toWorkListItem,
} from "@mimimilli/shared";
import type {
  AxisFacetItem,
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
  WorkPatch,
  WorksPage,
  WorksQuery,
} from "@mimimilli/shared";
import {
  createCoverValidators,
  NotConfiguredError,
  type CoverDescriptor,
  type DataAdapter,
  type MediaKind,
  type MediaLocation,
} from "../../adapter.ts";
import type { ScanOptions } from "../../adapter.ts";
import { isDefaultTitle } from "../../core/dlsiteTitle.ts";
import { buildTagPrefixCandidates } from "../../core/tagPrefixCandidates.ts";
import { evalSmartFolder } from "../../core/smartFolder.ts";
import { openDb, type Db, type DbLocation } from "./db.ts";
import {
  detectRjCode,
  downloadCover,
  fetchDlsiteCover,
  fetchDlsiteHtml,
  fetchDlsiteInfo,
  mergeDlsiteTags,
  normalizeDlsiteCoverUrl,
  parseDlsiteHtml,
  type DlsiteCoverResponse,
  type DlsiteHtmlResponse,
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
  type DlsiteSchedulerDependencies,
} from "./dlsiteScheduler.ts";
import { browseFs } from "./fsBrowse.ts";
import { buildFileTree } from "./fileTree.ts";
import { patchMetaFile } from "./meta.ts";
import { mimeOf, resolveWithin } from "./paths.ts";
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
  /** @deprecated dlsiteRequestConfig.requestIntervalMs を使う。既存テスト互換用。 */
  dlsiteRequestIntervalMs?: number;
  /** DLsiteの実HTTP設定。環境変数の解決はserver/src/index.tsだけで行う。 */
  dlsiteRequestConfig?: DlsiteRequestConfig;
  /** schedulerのtransport/clock/sleep/random/logger注入。実ネットワークなしの試験用。 */
  dlsiteSchedulerDependencies?: DlsiteSchedulerDependencies;
  /** DLsiteレスポンスキャッシュ。TASK-93.1ではDBを開くだけで、live取得経路の利用はTASK-93.2で行う。 */
  dlsiteCache?: DlsiteCacheOptions;
  /** テスト用の取得関数差し替え。省略時は実DLsite取得 */
  dlsiteFetcher?: (rjCode: string) => Promise<DlsiteFetchResult>;
  /** キャッシュ統合用の生HTML取得関数。テストでは実ネットワークを使わずここを注入する。 */
  dlsiteHtmlFetcher?: (productCode: string) => Promise<DlsiteHtmlResponse>;
  /** HTMLパーサの差し替え（cache hit時も毎回呼ばれることの検証用）。 */
  dlsiteParser?: (html: string, productCode: string) => DlsiteFetchResult;
  /** テスト用のカバーダウンロード関数差し替え */
  dlsiteCoverDownloader?: (coverUrl: string, workDir: string) => Promise<string>;
  /** キャッシュ統合用のカバーHTTP取得関数。 */
  dlsiteCoverFetcher?: (coverUrl: string) => Promise<DlsiteCoverResponse>;
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
        settle(() => rejectResult(new Error(message.message ?? "スキャンワーカーが失敗しました")));
      }
    };
    const onError = (event: ErrorEvent) => {
      settle(() => rejectResult(event.error ?? new Error(event.message)));
    };
    const onMessageError = () => {
      settle(() => rejectResult(new Error("スキャンワーカーのメッセージを復元できません")));
    };
    const onClose = () => {
      if (!terminalReceived) {
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
        testGate,
        testGateStage,
      },
    });
  });
}

export function createRealAdapter(options: RealAdapterOptions): RealAdapter {
  const db: Db = openDb(options.database);
  const dlsiteCache = options.dlsiteCache ? new DlsiteCache(options.dlsiteCache) : undefined;
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
    ...(options.dlsiteRequestIntervalMs === undefined
      ? {}
      : { requestIntervalMs: options.dlsiteRequestIntervalMs }),
  };
  const dlsiteScheduler = new DlsiteScheduler(
    dlsiteRequestConfig,
    options.dlsiteSchedulerDependencies,
  );
  const dlsiteHtmlTransferBytes =
    options.dlsiteCache?.maxTransferBytes ?? DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES;
  const dlsiteHtmlExpandedBytes =
    options.dlsiteCache?.maxExpandedBytes ?? DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES;
  const dlsiteCoverMaximumBytes =
    options.dlsiteCache?.maxTransferBytes ?? DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES;
  const dlsiteUserAgent = dlsiteRequestConfig.userAgent;
  const dlsiteFetcher =
    options.dlsiteFetcher ??
    ((rjCode: string) =>
      fetchDlsiteInfo(
        rjCode,
        dlsiteScheduler.fetch.bind(dlsiteScheduler),
        dlsiteHtmlTransferBytes,
        dlsiteHtmlExpandedBytes,
        dlsiteUserAgent,
      ));
  const dlsiteHtmlFetcher =
    options.dlsiteHtmlFetcher ??
    ((productCode: string, signal?: AbortSignal) =>
      fetchDlsiteHtml(
        productCode,
        (input, init) => dlsiteScheduler.fetch(input, { ...init, signal }),
        dlsiteHtmlTransferBytes,
        dlsiteHtmlExpandedBytes,
        dlsiteUserAgent,
      ));
  const dlsiteParser = options.dlsiteParser ?? parseDlsiteHtml;
  const dlsiteCoverDownloader =
    options.dlsiteCoverDownloader ??
    ((coverUrl: string, workDir: string) => downloadCover(coverUrl, workDir, dlsiteUserAgent));
  const dlsiteCoverFetcher =
    options.dlsiteCoverFetcher ??
    ((coverUrl: string, signal?: AbortSignal) =>
      fetchDlsiteCover(
        coverUrl,
        (input, init) => dlsiteScheduler.fetch(input, { ...init, signal }),
        dlsiteCoverMaximumBytes,
        dlsiteUserAgent,
      ));
  const scheduledDlsiteFetcher = options.dlsiteFetcher
    ? (rjCode: string, signal?: AbortSignal) =>
        dlsiteScheduler.schedule(() => dlsiteFetcher(rjCode), signal)
    : dlsiteFetcher;
  const scheduledDlsiteHtmlFetcher = options.dlsiteHtmlFetcher
    ? (productCode: string, signal?: AbortSignal) =>
        dlsiteScheduler.schedule(() => dlsiteHtmlFetcher(productCode), signal)
    : dlsiteHtmlFetcher;
  const scheduledDlsiteCoverFetcher = options.dlsiteCoverFetcher
    ? (coverUrl: string, signal?: AbortSignal) =>
        dlsiteScheduler.schedule(() => dlsiteCoverFetcher(coverUrl), signal)
    : dlsiteCoverFetcher;
  const scheduledDlsiteCoverDownloader = (
    coverUrl: string,
    workDir: string,
    signal?: AbortSignal,
  ) => dlsiteScheduler.schedule(() => dlsiteCoverDownloader(coverUrl, workDir), signal);
  const dlsiteFlights = new Map<string, Promise<DlsiteFetchAttempt>>();
  const dlsiteCoverFlights = new Map<
    string,
    Promise<{ body: Uint8Array; normalizedUrl: string }>
  >();

  /** キャッシュ越しのDLsite取得結果。httpAttemptedはHTTPへ実際に出たか（cache hitならfalse）。 */
  interface DlsiteFetchAttempt {
    result: DlsiteFetchResult;
    httpAttempted: boolean;
  }

  async function fetchCachedDlsiteAttempt(
    productCode: string,
    force = false,
    signal?: AbortSignal,
  ): Promise<DlsiteFetchAttempt> {
    // キャッシュ未設定の既存テスト注入契約は維持する。
    if (!dlsiteCache) {
      dlsiteScheduler.assertOnline();
      return { result: await scheduledDlsiteFetcher(productCode, signal), httpAttempted: true };
    }
    const key = productCode.trim().toUpperCase();
    if (signal?.aborted) {
      throw new DOMException("DLsite一括取得はキャンセルされました", "AbortError");
    }
    if (!force) {
      const resolution = dlsiteCache.resolve({ productCode: key });
      if (resolution.kind !== "miss") {
        options.dlsiteSchedulerDependencies?.logger?.({
          event: "dlsite_cache_hit",
          resource: "html",
          key,
        });
        if (resolution.kind === "html") {
          return { result: dlsiteParser(resolution.html, key), httpAttempted: false };
        }
        return {
          result: {
            ok: false,
            kind: resolution.outcome,
            message: `DLsite取得キャッシュ: ${resolution.outcome}（${key}）`,
          },
          httpAttempted: false,
        };
      }
    }
    options.dlsiteSchedulerDependencies?.logger?.({
      event: "dlsite_cache_miss",
      resource: "html",
      key,
      force,
    });
    try {
      dlsiteScheduler.assertOnline();
    } catch (error) {
      if (error instanceof DlsiteOfflineError) {
        return {
          result: { ok: false, kind: "offline", message: error.message },
          httpAttempted: false,
        };
      }
      throw error;
    }
    // fresh hitはここまでに返す。networkを始める場合だけforce/normalを問わず合流する。
    const ongoing = dlsiteFlights.get(key);
    if (ongoing) return ongoing;
    const request: Promise<DlsiteFetchAttempt> = (async (): Promise<DlsiteFetchAttempt> => {
      try {
        const response = await scheduledDlsiteHtmlFetcher(key, signal);
        if (response.status === 404) {
          dlsiteCache.recordFailure({ productCode: key, outcome: "not_found" });
          return {
            result: {
              ok: false,
              kind: "not_found",
              message: `DLsite作品が見つかりません（${key}）`,
            },
            httpAttempted: true,
          };
        }
        if (response.status < 200 || response.status >= 300) {
          dlsiteCache.recordFailure({ productCode: key, outcome: "error" });
          return {
            result: {
              ok: false,
              kind: "error",
              message: `DLsiteの取得に失敗しました（${key}: HTTP ${response.status}）`,
            },
            httpAttempted: true,
          };
        }
        const parsed = dlsiteParser(response.body, key);
        // HTTPが成功した以上、パースの成否にかかわらずsnapshotを更新し失敗記録は消す。
        dlsiteCache.recordSuccess({
          productCode: key,
          outcome: parsed.ok ? "ok" : "parse_error",
          contentType: response.contentType ?? "",
          html: response.body,
          transferSize: response.transferSize,
        });
        if (!parsed.ok && parsed.kind === "parse_error") {
          options.dlsiteSchedulerDependencies?.logger?.({
            event: "dlsite_parse_error",
            productCode: key,
            httpAttempted: true,
          });
        }
        return { result: parsed, httpAttempted: true };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        dlsiteCache.recordFailure({ productCode: key, outcome: "error" });
        return {
          result: {
            ok: false,
            kind: "error",
            message: `DLsiteとの通信に失敗しました（${key}: ${(error as Error).message}）`,
          },
          httpAttempted: true,
        };
      }
    })();
    dlsiteFlights.set(key, request);
    try {
      return await request;
    } finally {
      dlsiteFlights.delete(key);
    }
  }

  async function fetchCachedDlsite(productCode: string, force = false): Promise<DlsiteFetchResult> {
    return (await fetchCachedDlsiteAttempt(productCode, force)).result;
  }

  async function cachedCover(
    coverUrl: string,
    workDir: string,
    signal?: AbortSignal,
  ): Promise<string> {
    if (!dlsiteCache) {
      dlsiteScheduler.assertOnline();
      return scheduledDlsiteCoverDownloader(coverUrl, workDir, signal);
    }
    const normalizedUrl = normalizeDlsiteCoverUrl(coverUrl);
    const key = `cover:${createHash("sha256").update(normalizedUrl).digest("hex")}`;
    let request = dlsiteCoverFlights.get(key);
    if (!request) {
      request = (async () => {
        const cached = dlsiteCache.getCover(normalizedUrl);
        if (cached) {
          options.dlsiteSchedulerDependencies?.logger?.({
            event: "dlsite_cache_hit",
            resource: "cover",
            key: normalizedUrl,
          });
          return { body: cached.body, normalizedUrl };
        }
        options.dlsiteSchedulerDependencies?.logger?.({
          event: "dlsite_cache_miss",
          resource: "cover",
          key: normalizedUrl,
        });
        dlsiteScheduler.assertOnline();
        const fetched = await scheduledDlsiteCoverFetcher(normalizedUrl, signal);
        const finalUrl = normalizeDlsiteCoverUrl(fetched.finalUrl);
        dlsiteCache.putCover(finalUrl, fetched.body, fetched.contentType);
        // リダイレクトがあっても、要求した正規化URLでも次回hitさせる。
        if (finalUrl !== normalizedUrl) {
          dlsiteCache.putCover(normalizedUrl, fetched.body, fetched.contentType);
        }
        return { body: fetched.body, normalizedUrl: finalUrl };
      })();
      dlsiteCoverFlights.set(key, request);
    }
    try {
      const image = await request;
      const extension = (
        new URL(image.normalizedUrl).pathname.split(".").pop() ?? "jpg"
      ).toLowerCase();
      const fileName = `dlsite_cover.${extension}`;
      writeFileSync(join(workDir, fileName), image.body);
      return fileName;
    } finally {
      if (dlsiteCoverFlights.get(key) === request) dlsiteCoverFlights.delete(key);
    }
  }

  /**
   * ダウンロード済みカバーの寸法を計測して DB 書き込み用の cover 列を作る。
   * 計測に失敗したら null を返し、呼び出し側は DLsite 適用自体を失敗として扱う。
   */
  async function measureDownloadedCover(
    workDir: string,
    coverImage: string,
  ): Promise<CoverColumns | null> {
    const resolved = resolveWithin(workDir, join(workDir, coverImage));
    if (!resolved) return null;
    const dimensions = await measureCoverDimensions(resolved);
    if (!dimensions) return null;
    return { image: coverImage, dimensions };
  }

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
      } catch {
        throw new NotConfiguredError(
          `指定されたルートフォルダーが存在しません: ${patch.rootFolder}`,
        );
      }
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
      for (const work of repo.listSummaries()) {
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
        console.warn(
          `サムネイルキャッシュGC: 削除${gcResult.deleted}件 / 保持${gcResult.kept}件 / カバー未解決でスキップ${gcResult.skippedWorks}件`,
        );
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

    async exportLibrary(): Promise<string> {
      return JSON.stringify({ version: 1, works: repo.listSummaries() }, null, 2);
    },

    // ── 分類軸・タグ prefix 定義・スマートフォルダー・プリセット ──
    async getAxisFacets(axis: string): Promise<AxisFacetItem[]> {
      return repo.getAxisFacets(axis);
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
      return buildTagPrefixCandidates(
        repo.listSummaries(),
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
    async evalSmartFolder(
      id: string,
      query: { page: number; limit: number; seed?: number },
    ): Promise<WorksPage | null> {
      const folder = repo.getSmartFolder(id);
      if (!folder) return null;
      // ADR-0008: SQLでルール一致の候補IDへ絞り込んでから（第1段）、その候補だけを
      // WorkSummary化して純粋関数の最終評価・ソート・ページングへ渡す（第2段）。
      const candidateIds = repo.resolveSmartFolderCandidateIds(folder.rules);
      const works = repo.listSummaries(candidateIds === null ? undefined : [...candidateIds]);
      const page = evalSmartFolder(folder, works, query);
      return page.seed === undefined
        ? { items: page.items.map(toWorkListItem), total: page.total }
        : { items: page.items.map(toWorkListItem), total: page.total, seed: page.seed };
    },

    // ── 物理ファイルシステム ───────────────────────────────────
    async browseFs(path?: string): Promise<FsListing | null> {
      const root = requireRoot();
      return browseFs(root, repo.listSummaries(), path);
    },

    // ── メディア・DLsite ──────────────────────────────────────
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

    async dlsiteFetch(workId: string, force = false): Promise<DlsiteFetchResult> {
      const work = await repo.getWork(workId);
      if (!work)
        return { ok: false, kind: "not_found", message: `作品が見つかりません: ${workId}` };
      const rjCode = work.dlsite.rjCode ?? detectRjCode([basename(work.physicalPath), work.title]);
      if (!rjCode) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      return fetchCachedDlsite(rjCode, force);
    },

    async dlsiteApply(workId: string, body: DlsiteApplyBody): Promise<boolean> {
      const work = await repo.getWork(workId);
      if (!work) return false;

      const patch: { title?: string; tags?: string[]; cover?: CoverColumns; urls?: Work["urls"] } =
        {};
      if (body.applyTitle && body.info.title) patch.title = body.info.title;
      const applyTags = normalizeTags(body.applyTags);
      if (applyTags.length > 0) patch.tags = normalizeTags([...work.tags, ...applyTags]);
      if (body.info.url && !work.urls.some((entry) => entry.url.includes("dlsite.com"))) {
        patch.urls = [...work.urls, { label: "DLsite", url: body.info.url }];
      }
      let coverImage: string | undefined;
      if (body.applyCover && body.info.coverUrl) {
        coverImage = await cachedCover(body.info.coverUrl, work.physicalPath);
        // カバー計測に失敗したら適用自体を失敗として返す（寸法欠損のまま確定させない）。
        const cover = await measureDownloadedCover(work.physicalPath, coverImage);
        if (!cover) return false;
        patch.cover = cover;
      }

      return db.transaction(() => {
        const updated = repo.patchWork(workId, patch);
        if (!updated) return false;
        const dlsite = {
          rjCode: body.info.rjCode,
          status: "applied" as const,
          lastAttemptAt: new Date().toISOString(),
          error: null,
          errorKind: null,
          appliedTags: normalizeTags([...work.dlsite.appliedTags, ...applyTags]),
        };
        repo.setDlsiteState(workId, dlsite);
        patchMetaFile(updated.metaPath, {
          title: patch.title,
          tags: patch.tags,
          coverImage,
          urls: patch.urls,
          dlsite,
        });
        return true;
      });
    },

    async updateDlsiteState(workId: string, patch: DlsiteStatePatch): Promise<Work | null> {
      const work = await repo.getWork(workId);
      if (!work) return null;
      const dlsite = applyDlsiteStatePatch(work.dlsite, patch);
      db.transaction(() => {
        repo.setDlsiteState(workId, dlsite);
        const metaPath = repo.getWorkMetaPath(workId);
        if (!metaPath) throw new Error(`作品のメタパスが見つかりません: ${workId}`);
        patchMetaFile(metaPath, { dlsite });
      });
      return repo.getWork(workId);
    },

    async runDlsiteBulk(
      mode: DlsiteBulkMode,
      workIds: string[] | undefined,
      options?: {
        signal?: AbortSignal;
        onProgress?: (event: Extract<DlsiteBulkProgressEvent, { type: "progress" }>) => void;
      },
    ): Promise<DlsiteBulkResult> {
      const signal = options?.signal;
      const isAborted = (): boolean => signal?.aborted === true;
      const result: DlsiteBulkResult = { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
      try {
        // 対象抽出は listSummaries で完結させる（全件 getWork の N+1 を解消。TASK-57）。
        // 以降の個別処理で完全な Work が必要な場合だけ、その作品の getWork を呼ぶ
        const summaries = repo.listSummaries();
        const requested = (() => {
          if (!workIds) return summaries;
          const idSet = new Set(workIds);
          return summaries.filter((summary) => idSet.has(summary.id));
        })();
        // 1. work単位で適用対象を選ぶ。statusは「適用が必要か」だけを表す。
        //    skippedとapplied（適用済み）は常に除外。
        //    HTTP再取得可否（ネットワークへ出るか）はここでは決めず、常にキャッシュTTLへ委ねる。
        const targets = requested.filter((work) => {
          if (!work.dlsite.rjCode || work.dlsite.status === "skipped") return false;
          return work.dlsite.status !== "applied";
        });
        result.skipped = requested.length - targets.length;

        // 2. RJコードを重複排除して取得する。同一作品を跨いで同じRJコードが複数あっても
        //    HTTP・キャッシュ判定は1回で済ませる。
        const uniqueRjCodes = [...new Set(targets.map((work) => work.dlsite.rjCode!))];
        const attempts = new Map<string, DlsiteFetchAttempt>();
        for (const rjCode of uniqueRjCodes) {
          if (isAborted()) return result;
          try {
            attempts.set(rjCode, await fetchCachedDlsiteAttempt(rjCode, false, signal));
          } catch (error) {
            if (error instanceof DlsiteOfflineError) throw error;
            if (error instanceof DOMException && error.name === "AbortError") return result;
            attempts.set(rjCode, {
              result: {
                ok: false,
                kind: "error",
                message: error instanceof Error ? error.message : "DLsite取得に失敗しました",
              },
              httpAttempted: false,
            });
          }
        }

        for (let index = 0; index < targets.length; index++) {
          if (isAborted()) return result;
          const work = targets[index]!;
          const attempt = attempts.get(work.dlsite.rjCode!)!;
          const fetched = attempt.result;
          // 実HTTPを試みた時だけlastAttemptAtを進める。cache hitは「HTTPをいつ試みたか」を書き換えない。
          const attemptedAt = attempt.httpAttempted
            ? new Date().toISOString()
            : work.dlsite.lastAttemptAt;
          try {
            if (!fetched.ok) {
              if (fetched.kind === "offline") {
                result.failed += 1;
                options?.onProgress?.({
                  type: "progress",
                  processed: index + 1,
                  total: targets.length,
                  workId: work.id,
                });
                continue;
              }
              const newStatus =
                fetched.kind === "not_found" ? ("not_found" as const) : ("error" as const);
              const newErrorKind =
                fetched.kind === "not_found" ||
                fetched.kind === "parse_error" ||
                fetched.kind === "error"
                  ? fetched.kind
                  : null;
              const noOp =
                !attempt.httpAttempted &&
                work.dlsite.status === newStatus &&
                work.dlsite.error === fetched.message &&
                work.dlsite.errorKind === newErrorKind;
              if (!noOp) {
                const dlsite = {
                  ...work.dlsite,
                  status: newStatus,
                  lastAttemptAt: attemptedAt,
                  error: fetched.message,
                  errorKind: newErrorKind,
                };
                db.transaction(() => {
                  repo.setDlsiteState(work.id, dlsite);
                  const metaPath = repo.getWorkMetaPath(work.id);
                  if (metaPath) patchMetaFile(metaPath, { dlsite });
                });
              }
              result.failed += 1;
              if (fetched.kind === "parse_error") result.parseErrors += 1;
            } else {
              const allInfoTags = mergeDlsiteTags([], fetched.info);
              const applyTags =
                mode === "new"
                  ? allInfoTags
                  : allInfoTags.filter((tag) => !work.dlsite.appliedTags.includes(tag));
              const nextTags = normalizeTags([...work.tags, ...applyTags]);
              const nextTitle =
                mode === "new" || isDefaultTitle(work.title, work.physicalPath, work.dlsite.rjCode)
                  ? fetched.info.title
                  : undefined;
              const nextUrls = !work.urls.some((entry) => entry.url.includes("dlsite.com"))
                ? [...work.urls, { label: "DLsite", url: fetched.info.url }]
                : undefined;
              const coverNeeded = !work.cover && !!fetched.info.coverUrl;
              const nextAppliedTags = normalizeTags([...work.dlsite.appliedTags, ...allInfoTags]);
              const noOp =
                !attempt.httpAttempted &&
                !coverNeeded &&
                nextUrls === undefined &&
                (nextTitle === undefined || nextTitle === work.title) &&
                arraysEqual(nextTags, work.tags) &&
                arraysEqual(nextAppliedTags, work.dlsite.appliedTags) &&
                work.dlsite.status === "applied" &&
                work.dlsite.rjCode === fetched.info.rjCode &&
                work.dlsite.error === null &&
                work.dlsite.errorKind === null;
              if (!noOp) {
                const patch: {
                  title?: string;
                  tags?: string[];
                  cover?: CoverColumns;
                  urls?: Work["urls"];
                } = { tags: nextTags };
                if (nextTitle !== undefined) patch.title = nextTitle;
                if (nextUrls !== undefined) patch.urls = nextUrls;
                let coverImage: string | undefined;
                if (coverNeeded) {
                  coverImage = await cachedCover(fetched.info.coverUrl!, work.physicalPath, signal);
                  // カバー計測失敗はこの作品の適用失敗として扱う（error状態へ落として次作品へ続行）。
                  const cover = await measureDownloadedCover(work.physicalPath, coverImage);
                  if (!cover) throw new Error(`カバー寸法を計測できません: ${coverImage}`);
                  patch.cover = cover;
                }
                const dlsite = {
                  rjCode: fetched.info.rjCode,
                  status: "applied" as const,
                  lastAttemptAt: attemptedAt,
                  error: null,
                  errorKind: null,
                  appliedTags: nextAppliedTags,
                };
                db.transaction(() => {
                  const updated = repo.patchWork(work.id, patch);
                  if (!updated)
                    throw new Error(`一括取得中に作品が見つからなくなりました: ${work.id}`);
                  repo.setDlsiteState(work.id, dlsite);
                  patchMetaFile(updated.metaPath, {
                    title: patch.title,
                    tags: patch.tags,
                    coverImage,
                    urls: patch.urls,
                    dlsite,
                  });
                });
              }
              result.fetched += 1;
            }
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return result;
            if (error instanceof DlsiteOfflineError) {
              result.failed += 1;
              options?.onProgress?.({
                type: "progress",
                processed: index + 1,
                total: targets.length,
                workId: work.id,
              });
              continue;
            }
            const dlsite = {
              ...work.dlsite,
              status: "error" as const,
              lastAttemptAt: attemptedAt,
              error: error instanceof Error ? error.message : "DLsite情報の適用に失敗しました",
              errorKind: "error" as const,
            };
            // 失敗状態の永続化自体が失敗しても（メタ書き込み不能等）ジョブは中断しない。
            // failed への加算と進捗通知は必ず行い、次の作品へ続行する
            try {
              db.transaction(() => {
                repo.setDlsiteState(work.id, dlsite);
                const metaPath = repo.getWorkMetaPath(work.id);
                if (metaPath) patchMetaFile(metaPath, { dlsite });
              });
            } catch (persistError) {
              console.error("DLsite失敗状態の保存に失敗しました", {
                workId: work.id,
                persistError,
              });
            }
            result.failed += 1;
          }
          options?.onProgress?.({
            type: "progress",
            processed: index + 1,
            total: targets.length,
            workId: work.id,
          });
        }
        return result;
      } catch (error) {
        if (isAborted() || (error instanceof DOMException && error.name === "AbortError")) {
          return result;
        }
        throw error;
      }
    },
    close(): void {
      dlsiteCache?.close();
      db.close();
    },
  };
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
