// real アダプタ: SQLite（キャッシュ）+ 実ファイルシステム + `.meta.json`（Source of Truth）。
// 作品検索・件数・ページングはcatalog接続からuser DBをATTACH JOINしてSQLで実行する。
import { existsSync, realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { DEFAULT_TAG_PREFIXES, normalizeTags, toWorkListItem } from "@mimimilli/shared";
import type {
  AxisFacetItem,
  DlsiteApplyBody,
  DlsiteBulkMode,
  DlsiteBulkProgressEvent,
  DlsiteBulkResult,
  DlsiteFetchResult,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  DlsiteStatePatch,
  FileEntry,
  FsListing,
  ResumeBody,
  ScanProgressEvent,
  ScanResult,
  SearchPreset,
  SearchPresetCreate,
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
import { migrateResumeV1, openDb, type Db, type DbLocation } from "./db.ts";
import { detectRjCode, downloadCover, fetchDlsiteInfo, mergeDlsiteTags } from "./dlsite.ts";
import { browseFs } from "./fsBrowse.ts";
import { buildFileTree } from "./fileTree.ts";
import { patchMetaFile } from "./meta.ts";
import { mimeOf, resolveWithin } from "./paths.ts";
import { Scanner } from "./scanner.ts";
import {
  gcThumbnailCache,
  measureCoverDimensions,
  ThumbnailCache,
  type CoverDimensions,
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
  /** 一括取得のリクエスト間隔。実運用は1秒、テストのみ短縮可 */
  dlsiteRequestIntervalMs?: number;
  /** テスト用の取得関数差し替え。省略時は実DLsite取得 */
  dlsiteFetcher?: (rjCode: string) => Promise<DlsiteFetchResult>;
  /** テスト用のカバーダウンロード関数差し替え */
  dlsiteCoverDownloader?: (coverUrl: string, workDir: string) => Promise<string>;
  /** カバー寸法の計測関数（テスト用差し替え）。省略時は Sharp 実装 */
  coverMeasurer?: (sourceAbsolutePath: string) => Promise<CoverDimensions | null>;
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
  const repo = new WorkRepo(db);
  const thumbnailCacheDir = options.thumbnailCacheDir ?? join(tmpdir(), "mimikago-memory-cache");
  const thumbnailCache = new ThumbnailCache(options.thumbnailCache);
  const dataRoot =
    options.dataRoot ??
    (options.database.kind === "files"
      ? dirname(dirname(options.database.catalogPath))
      : join(tmpdir(), "mimikago-memory-data"));
  const coverMeasurer = options.coverMeasurer ?? measureCoverDimensions;
  const scanner = new Scanner(db, repo, dataRoot, { measureCover: coverMeasurer });
  const dlsiteRequestIntervalMs = options.dlsiteRequestIntervalMs ?? 1000;
  const dlsiteFetcher = options.dlsiteFetcher ?? fetchDlsiteInfo;
  const dlsiteCoverDownloader = options.dlsiteCoverDownloader ?? downloadCover;

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
    const dimensions = await coverMeasurer(resolved);
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

    async scan(
      scanOptions?: ScanOptions | ((event: ScanProgressEvent) => void),
    ): Promise<ScanResult> {
      const root = requireRoot();
      const normalized =
        typeof scanOptions === "function" ? { onProgress: scanOptions } : (scanOptions ?? {});
      if (options.database?.kind === "files") {
        return runFileScanInWorker(
          {
            ...options.database,
            catalogPath: resolve(options.database.catalogPath),
            userPath: resolve(options.database.userPath),
            legacyPath: options.database.legacyPath
              ? resolve(options.database.legacyPath)
              : undefined,
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
      // v1 resumeはcatalogのPlaylist/Track関係が揃ってから変換する。
      // 未解決行はpendingに残るため、次回スキャン後にも同じ処理で再試行される。
      migrateResumeV1(db.sqlite, checkAbort);
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
      kind: "rj-missing" | "fetch-failed",
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
        patchMetaFile(findMetaPath(updated), { title: patch.title, tags: patch.tags });
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

    async listPresets(): Promise<SearchPreset[]> {
      return repo.listPresets();
    },
    async createPreset(input: SearchPresetCreate): Promise<SearchPreset> {
      return repo.createPreset(input);
    },
    async deletePreset(id: number): Promise<boolean> {
      return repo.deletePreset(id);
    },

    // ── 物理ファイルシステム ───────────────────────────────────
    async browseFs(path?: string): Promise<FsListing | null> {
      const root = requireRoot();
      return browseFs(root, repo.listSummaries(), path);
    },

    // ── メディア・DLsite ──────────────────────────────────────
    async locateMedia(
      kind: MediaKind,
      workId: string,
      relPath?: string,
      width?: number,
    ): Promise<MediaLocation | null> {
      if (kind === "cover") {
        const descriptor = await describeCover(workId, width);
        return descriptor?.materialize() ?? null;
      }
      const work = await repo.getWork(workId);
      if (!work) return null;

      const rel = relPath;
      if (!rel) return null;

      const resolved = resolveWithin(work.physicalPath, join(work.physicalPath, rel));
      if (!resolved) return null;

      return { type: "file", absolutePath: resolved, mime: mimeOf(resolved) };
    },

    async describeCover(workId: string, width?: number): Promise<CoverDescriptor | null> {
      return describeCover(workId, width);
    },

    async dlsiteFetch(workId: string): Promise<DlsiteFetchResult> {
      const work = await repo.getWork(workId);
      if (!work)
        return { ok: false, kind: "not_found", message: `作品が見つかりません: ${workId}` };
      const rjCode = work.dlsite.rjCode ?? detectRjCode([basename(work.physicalPath), work.title]);
      if (!rjCode) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      return dlsiteFetcher(rjCode);
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
        coverImage = await downloadCover(body.info.coverUrl, work.physicalPath);
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
          appliedTags: normalizeTags([...work.dlsite.appliedTags, ...applyTags]),
        };
        repo.setDlsiteState(workId, dlsite);
        patchMetaFile(findMetaPath(updated), {
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
      const dlsite = {
        ...work.dlsite,
        ...(patch.rjCode !== undefined ? { rjCode: patch.rjCode } : {}),
        ...(patch.skipped !== undefined
          ? { status: patch.skipped ? ("skipped" as const) : ("none" as const), error: null }
          : {}),
      };
      db.transaction(() => {
        repo.setDlsiteState(workId, dlsite);
        patchMetaFile(findMetaPath(work), { dlsite });
      });
      return repo.getWork(workId);
    },

    async runDlsiteBulk(
      mode: DlsiteBulkMode,
      workIds: string[] | undefined,
      onProgress?: (event: Extract<DlsiteBulkProgressEvent, { type: "progress" }>) => void,
    ): Promise<DlsiteBulkResult> {
      // 対象抽出は listSummaries で完結させる（全件 getWork の N+1 を解消。TASK-57）。
      // 以降の個別処理で完全な Work が必要な場合だけ、その作品の getWork を呼ぶ
      const summaries = repo.listSummaries();
      const requested = (() => {
        if (!workIds) return summaries;
        const idSet = new Set(workIds);
        return summaries.filter((summary) => idSet.has(summary.id));
      })();
      const targets = requested.filter(
        (work) =>
          work.dlsite.rjCode && (work.dlsite.status === "none" || work.dlsite.status === "error"),
      );
      const result: DlsiteBulkResult = {
        fetched: 0,
        failed: 0,
        skipped: requested.length - targets.length,
      };

      for (let index = 0; index < targets.length; index++) {
        const work = targets[index]!;
        if (index > 0 && dlsiteRequestIntervalMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, dlsiteRequestIntervalMs));
        }
        const attemptedAt = new Date().toISOString();
        try {
          const fetched = await dlsiteFetcher(work.dlsite.rjCode!);
          if (!fetched.ok) {
            const dlsite = {
              ...work.dlsite,
              status: fetched.kind === "not_found" ? ("not_found" as const) : ("error" as const),
              lastAttemptAt: attemptedAt,
              error: fetched.message,
            };
            db.transaction(() => {
              repo.setDlsiteState(work.id, dlsite);
              const metaLocation = repo.getWorkMetaLocation(work.id);
              if (metaLocation) patchMetaFile(findMetaPath(metaLocation), { dlsite });
            });
            result.failed += 1;
          } else {
            const allInfoTags = mergeDlsiteTags([], fetched.info);
            const applyTags =
              mode === "new"
                ? allInfoTags
                : allInfoTags.filter((tag) => !work.dlsite.appliedTags.includes(tag));
            const patch: {
              title?: string;
              tags?: string[];
              cover?: CoverColumns;
              urls?: Work["urls"];
            } = {
              tags: normalizeTags([...work.tags, ...applyTags]),
            };
            if (
              mode === "new" ||
              isDefaultTitle(work.title, work.physicalPath, work.dlsite.rjCode)
            ) {
              patch.title = fetched.info.title;
            }
            if (!work.urls.some((entry) => entry.url.includes("dlsite.com"))) {
              patch.urls = [...work.urls, { label: "DLsite", url: fetched.info.url }];
            }
            let coverImage: string | undefined;
            if (!work.cover && fetched.info.coverUrl) {
              coverImage = await dlsiteCoverDownloader(fetched.info.coverUrl, work.physicalPath);
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
              appliedTags: normalizeTags([...work.dlsite.appliedTags, ...allInfoTags]),
            };
            db.transaction(() => {
              const updated = repo.patchWork(work.id, patch);
              if (!updated) throw new Error(`一括取得中に作品が見つからなくなりました: ${work.id}`);
              repo.setDlsiteState(work.id, dlsite);
              patchMetaFile(findMetaPath(updated), {
                title: patch.title,
                tags: patch.tags,
                coverImage,
                urls: patch.urls,
                dlsite,
              });
            });
            result.fetched += 1;
          }
        } catch (error) {
          const dlsite = {
            ...work.dlsite,
            status: "error" as const,
            lastAttemptAt: attemptedAt,
            error: error instanceof Error ? error.message : "DLsite情報の適用に失敗しました",
          };
          // 失敗状態の永続化自体が失敗しても（メタ書き込み不能等）ジョブは中断しない。
          // failed への加算と進捗通知は必ず行い、次の作品へ続行する
          try {
            db.transaction(() => {
              repo.setDlsiteState(work.id, dlsite);
              const metaLocation = repo.getWorkMetaLocation(work.id);
              if (metaLocation) patchMetaFile(findMetaPath(metaLocation), { dlsite });
            });
          } catch (persistError) {
            console.error("DLsite失敗状態の保存に失敗しました", {
              workId: work.id,
              persistError,
            });
          }
          result.failed += 1;
        }
        onProgress?.({
          type: "progress",
          processed: index + 1,
          total: targets.length,
          workId: work.id,
        });
      }
      return result;
    },
    close(): void {
      db.close();
    },
  };
}

/** 作品のメタファイルパスを返す（フォルダー形式 / 単一ファイル形式の両対応） */
function findMetaPath(work: {
  physicalPath: string;
  playlists: Array<{ tracks: Array<{ file: string }> }>;
}): string {
  const folderMeta = join(work.physicalPath, ".meta.json");
  if (existsSync(folderMeta)) return folderMeta;
  // 単一ファイル形式: トラックの basename に対応する <basename>.meta.json を探す
  const firstTrack = work.playlists[0]?.tracks[0]?.file;
  if (firstTrack) {
    const base = firstTrack.replace(/\.[^.]+$/, "");
    const singleMeta = join(work.physicalPath, `${base}.meta.json`);
    if (existsSync(singleMeta)) return singleMeta;
  }
  return folderMeta;
}
