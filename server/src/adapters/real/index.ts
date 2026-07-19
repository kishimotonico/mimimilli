// real アダプタ: SQLite（キャッシュ）+ 実ファイルシステム + `.meta.json`（Source of Truth）。
// 作品検索・件数・ページングはcatalog接続からuser DBをATTACH JOINしてSQLで実行する。
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { DEFAULT_TAG_PREFIXES, normalizeTags } from "@mimimilli/shared";
import type {
  AxisFacetItem,
  DlsiteApplyBody,
  DlsiteBulkMode,
  DlsiteBulkProgressEvent,
  DlsiteBulkResult,
  DlsiteFetchResult,
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
  WorkSummary,
} from "@mimimilli/shared";
import {
  NotConfiguredError,
  type DataAdapter,
  type MediaKind,
  type MediaLocation,
} from "../../adapter.ts";
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
import { gcThumbnailCache, getOrCreateThumbnail, type WorkCoverEntry } from "./thumbnailCache.ts";
import { WorkRepo } from "./workRepo.ts";

const KEY_ROOT_FOLDER = "root_folder";
const KEY_LAST_SCAN_TIME = "last_scan_time";
const KEY_TAG_PREFIXES_SEEDED = "tag_prefixes_seeded";
export interface RealAdapterOptions {
  database: DbLocation;
  /** カバーサムネイルのキャッシュ置き場。ファイルDBの通常起動ではデータルート配下を渡す。 */
  thumbnailCacheDir?: string;
  /** manifestとバックアップを保存するデータルート。 */
  dataRoot?: string;
  /** 一括取得のリクエスト間隔。実運用は1秒、テストのみ短縮可 */
  dlsiteRequestIntervalMs?: number;
  /** テスト用の取得関数差し替え。省略時は実DLsite取得 */
  dlsiteFetcher?: (rjCode: string) => Promise<DlsiteFetchResult>;
  /** テスト用のカバーダウンロード関数差し替え */
  dlsiteCoverDownloader?: (coverUrl: string, workDir: string) => Promise<string>;
}

export interface RealAdapter extends DataAdapter {
  close(): void;
}

export function createRealAdapter(options: RealAdapterOptions): RealAdapter {
  const db: Db = openDb(options.database);
  const repo = new WorkRepo(db);
  const thumbnailCacheDir = options.thumbnailCacheDir ?? join(tmpdir(), "mimikago-memory-cache");
  const dataRoot =
    options.dataRoot ??
    (options.database.kind === "files"
      ? dirname(dirname(options.database.catalogPath))
      : join(tmpdir(), "mimikago-memory-data"));
  const scanner = new Scanner(db.catalog, repo, dataRoot);
  const dlsiteRequestIntervalMs = options.dlsiteRequestIntervalMs ?? 1000;
  const dlsiteFetcher = options.dlsiteFetcher ?? fetchDlsiteInfo;
  const dlsiteCoverDownloader = options.dlsiteCoverDownloader ?? downloadCover;

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

    async scan(onProgress?: (event: ScanProgressEvent) => void): Promise<ScanResult> {
      const root = requireRoot();
      const result = await scanner.scan(root, onProgress);
      // v1 resumeはcatalogのPlaylist/Track関係が揃ってから変換する。
      // 未解決行はpendingに残るため、次回スキャン後にも同じ処理で再試行される。
      migrateResumeV1(db.sqlite);
      repo.setScanState(KEY_LAST_SCAN_TIME, new Date().toISOString());

      // 全作品を走査した直後の自然なタイミングでサムネイルキャッシュをGCする（TASK-26）
      const coverEntries: WorkCoverEntry[] = [];
      for (const work of repo.listSummaries()) {
        if (!work.coverImage) continue;
        const resolved = resolveWithin(work.physicalPath, join(work.physicalPath, work.coverImage));
        if (!resolved) continue;
        coverEntries.push({ workId: work.id, coverAbsolutePath: resolved });
      }
      const gcResult = await gcThumbnailCache(thumbnailCacheDir, coverEntries);
      if (gcResult.deleted > 0 || gcResult.skippedWorks > 0) {
        console.warn(
          `サムネイルキャッシュGC: 削除${gcResult.deleted}件 / 保持${gcResult.kept}件 / カバー未解決でスキップ${gcResult.skippedWorks}件`,
        );
      }

      return result;
    },

    // ── 作品 ──────────────────────────────────────────────────
    async queryWorks(params: WorksQuery): Promise<WorksPage> {
      return repo.queryWorks(params);
    },

    async getWork(id: string): Promise<Work | null> {
      return repo.getWork(id);
    },

    async patchWork(id: string, patch: WorkPatch): Promise<Work | null> {
      if (patch.title === undefined && patch.tags === undefined) {
        return repo.patchWork(id, patch);
      }
      // user書き込みはcatalogトランザクションの外で先に確定させる。
      if (patch.bookmarked !== undefined) {
        const updated = repo.patchWork(id, { bookmarked: patch.bookmarked });
        if (!updated) return null;
      }
      return db.transaction(() => {
        const updated = repo.patchWork(id, {
          title: patch.title,
          tags: patch.tags,
        });
        if (!updated) return null;
        patchMetaFile(findMetaPath(updated), { title: patch.title, tags: patch.tags });
        return updated;
      });
    },

    async saveResume(id: string, body: ResumeBody): Promise<boolean> {
      return repo.saveResume(id, body);
    },

    async touchLastPlayed(id: string): Promise<boolean> {
      return repo.touchLastPlayed(id);
    },

    async listWorkFiles(id: string): Promise<FileEntry | null> {
      const work = repo.getWork(id);
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
    async evalSmartFolder(id: string): Promise<WorkSummary[] | null> {
      const folder = repo.getSmartFolder(id);
      if (!folder) return null;
      return evalSmartFolder(folder, repo.listSummaries());
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
      const work = repo.getWork(workId);
      if (!work) return null;

      const rel = kind === "cover" ? work.coverImage : relPath;
      if (!rel) return null;

      const resolved = resolveWithin(work.physicalPath, join(work.physicalPath, rel));
      if (!resolved) return null;

      if (kind === "cover" && width !== undefined) {
        const thumbnail = await getOrCreateThumbnail(thumbnailCacheDir, workId, width, resolved);
        return { type: "file", absolutePath: thumbnail.absolutePath, mime: thumbnail.mime };
      }

      return { type: "file", absolutePath: resolved, mime: mimeOf(resolved) };
    },

    async dlsiteFetch(workId: string): Promise<DlsiteFetchResult> {
      const work = repo.getWork(workId);
      if (!work)
        return { ok: false, kind: "not_found", message: `作品が見つかりません: ${workId}` };
      const rjCode = work.dlsite.rjCode ?? detectRjCode([basename(work.physicalPath), work.title]);
      if (!rjCode) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      return dlsiteFetcher(rjCode);
    },

    async dlsiteApply(workId: string, body: DlsiteApplyBody): Promise<boolean> {
      const work = repo.getWork(workId);
      if (!work) return false;

      const patch: { title?: string; tags?: string[]; coverImage?: string; urls?: Work["urls"] } =
        {};
      if (body.applyTitle && body.info.title) patch.title = body.info.title;
      const applyTags = normalizeTags(body.applyTags);
      if (applyTags.length > 0) patch.tags = normalizeTags([...work.tags, ...applyTags]);
      if (body.info.url && !work.urls.some((entry) => entry.url.includes("dlsite.com"))) {
        patch.urls = [...work.urls, { label: "DLsite", url: body.info.url }];
      }
      if (body.applyCover && body.info.coverUrl) {
        patch.coverImage = await downloadCover(body.info.coverUrl, work.physicalPath);
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
          coverImage: patch.coverImage,
          urls: patch.urls,
          dlsite,
        });
        return true;
      });
    },

    async updateDlsiteState(workId: string, patch: DlsiteStatePatch): Promise<Work | null> {
      const work = repo.getWork(workId);
      if (!work) return null;
      const dlsite = {
        ...work.dlsite,
        ...(patch.rjCode !== undefined ? { rjCode: patch.rjCode } : {}),
        ...(patch.skipped !== undefined
          ? { status: patch.skipped ? ("skipped" as const) : ("none" as const), error: null }
          : {}),
      };
      return db.transaction(() => {
        repo.setDlsiteState(workId, dlsite);
        patchMetaFile(findMetaPath(work), { dlsite });
        return repo.getWork(workId);
      });
    },

    async runDlsiteBulk(
      mode: DlsiteBulkMode,
      workIds: string[] | undefined,
      onProgress?: (event: Extract<DlsiteBulkProgressEvent, { type: "progress" }>) => void,
    ): Promise<DlsiteBulkResult> {
      const requested = workIds
        ? workIds.map((id) => repo.getWork(id)).filter((work): work is Work => work !== null)
        : repo.listSummaries().map((summary) => repo.getWork(summary.id)!);
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
              patchMetaFile(findMetaPath(work), { dlsite });
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
              coverImage?: string;
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
            if (!work.coverImage && fetched.info.coverUrl) {
              patch.coverImage = await dlsiteCoverDownloader(
                fetched.info.coverUrl,
                work.physicalPath,
              );
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
              patchMetaFile(findMetaPath(updated), { ...patch, dlsite });
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
              patchMetaFile(findMetaPath(work), { dlsite });
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
function findMetaPath(work: Work): string {
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
