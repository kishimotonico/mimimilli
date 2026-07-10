// real アダプタ: SQLite（キャッシュ）+ 実ファイルシステム + `.meta.json`（Source of Truth）。
// 検索・絞り込み・ソートは数千作品規模を前提に、DB から全サマリーを読んで
// core/ の pure 関数で処理する（規模が増えたら SQL 化する余地をこの境界の内側に残す）。
import { existsSync, realpathSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type {
  AxisFacetItem,
  DlsiteApplyBody,
  DlsiteWorkInfo,
  FacetAxis,
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
import { buildAxisFacets } from "../../core/axisFacets.ts";
import { evalSmartFolder } from "../../core/smartFolder.ts";
import { applyWorksQuery } from "../../core/worksQuery.ts";
import { openDb, type Db } from "./db.ts";
import { detectRjCode, downloadCover, fetchDlsiteInfo, mergeDlsiteTags } from "./dlsite.ts";
import { browseFs } from "./fsBrowse.ts";
import { buildFileTree } from "./fileTree.ts";
import { patchMetaFile } from "./meta.ts";
import { mimeOf, resolveWithin } from "./paths.ts";
import { Scanner } from "./scanner.ts";
import { getOrCreateThumbnail } from "./thumbnailCache.ts";
import { WorkRepo } from "./workRepo.ts";

const KEY_ROOT_FOLDER = "root_folder";
const KEY_LAST_SCAN_TIME = "last_scan_time";
const DEFAULT_THUMBNAIL_CACHE_DIR = "data/cache/thumbnails";

export interface RealAdapterOptions {
  dbPath: string;
  /** カバーサムネイルのキャッシュ置き場（省略時 "data/cache/thumbnails"） */
  thumbnailCacheDir?: string;
}

export function createRealAdapter(options: RealAdapterOptions): DataAdapter {
  const db: Db = openDb(options.dbPath);
  const repo = new WorkRepo(db);
  const scanner = new Scanner(db, repo);
  const thumbnailCacheDir = options.thumbnailCacheDir ?? DEFAULT_THUMBNAIL_CACHE_DIR;

  function requireRoot(): string {
    const root = repo.getSetting(KEY_ROOT_FOLDER);
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
        rootFolder: repo.getSetting(KEY_ROOT_FOLDER),
        lastScanTime: repo.getSetting(KEY_LAST_SCAN_TIME),
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
      repo.setSetting(KEY_ROOT_FOLDER, absRoot);
      return this.getSettings();
    },

    async scan(onProgress?: (event: ScanProgressEvent) => void): Promise<ScanResult> {
      const root = requireRoot();
      const result = await scanner.scan(root, onProgress);
      repo.setSetting(KEY_LAST_SCAN_TIME, new Date().toISOString());
      return result;
    },

    // ── 作品 ──────────────────────────────────────────────────
    async queryWorks(params: WorksQuery): Promise<WorksPage> {
      return applyWorksQuery(repo.listSummaries(), params);
    },

    async getWork(id: string): Promise<Work | null> {
      return repo.getWork(id);
    },

    async patchWork(id: string, patch: WorkPatch): Promise<Work | null> {
      if (patch.title === undefined && patch.tags === undefined) {
        return repo.patchWork(id, patch);
      }
      return db.transaction(() => {
        const updated = repo.patchWork(id, patch);
        if (!updated) return null;
        patchMetaFile(findMetaPath(updated), { title: patch.title, tags: patch.tags });
        return updated;
      });
    },

    async saveResume(id: string, body: ResumeBody): Promise<boolean> {
      return repo.saveResume(id, body.position, body.trackIndex);
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

    // ── 分類軸・スマートフォルダー・プリセット ─────────────────
    async getAxisFacets(axis: FacetAxis): Promise<AxisFacetItem[]> {
      return buildAxisFacets(axis, repo.listSummaries());
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

    async dlsiteFetch(workId: string): Promise<DlsiteWorkInfo | null> {
      const work = repo.getWork(workId);
      if (!work) return null;
      const rjCode = detectRjCode([basename(work.physicalPath), work.title]);
      if (!rjCode) return null;
      return fetchDlsiteInfo(rjCode);
    },

    async dlsiteApply(workId: string, body: DlsiteApplyBody): Promise<boolean> {
      const work = repo.getWork(workId);
      if (!work) return false;

      const patch: { title?: string; tags?: string[]; coverImage?: string; urls?: Work["urls"] } =
        {};
      if (body.applyTitle && body.info.title) patch.title = body.info.title;
      if (body.applyTags) patch.tags = mergeDlsiteTags(work.tags, body.info);
      if (body.info.url && !work.urls.some((entry) => entry.url.includes("dlsite.com"))) {
        patch.urls = [...work.urls, { label: "DLsite", url: body.info.url }];
      }
      if (body.applyCover && body.info.coverUrl) {
        patch.coverImage = await downloadCover(body.info.coverUrl, work.physicalPath);
      }

      return db.transaction(() => {
        const updated = repo.patchWork(workId, patch);
        if (!updated) return false;
        patchMetaFile(findMetaPath(updated), {
          title: patch.title,
          tags: patch.tags,
          coverImage: patch.coverImage,
          urls: patch.urls,
        });
        return true;
      });
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
