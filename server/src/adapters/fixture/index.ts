// fixture アダプタ: インメモリの seed データを使う DataAdapter 実装。
// 開発・ビジュアルテスト用（ADR-0002）。core/ の pure 関数を使って全メソッドを実装する。
import type {
  AxisFacetItem,
  DlsiteApplyBody,
  DlsiteWorkInfo,
  FacetAxis,
  FileEntry,
  FsListing,
  ResumeBody,
  ScanResult,
  SearchPreset,
  SearchPresetCreate,
  Settings,
  SettingsUpdate,
  SmartFolder,
  SmartFolderCreate,
  SmartFolderUpdate,
  Track,
  Work,
  WorkPatch,
  WorksPage,
  WorksQuery,
  WorkSummary,
} from "@mimimilli/shared";
import type { DataAdapter, MediaKind, MediaLocation } from "../../adapter.ts";
import { buildAxisFacets } from "../../core/axisFacets.ts";
import { evalSmartFolder } from "../../core/smartFolder.ts";
import { applyWorksQuery } from "../../core/worksQuery.ts";
import { buildFsRoot, buildWorkFileTree, SEED_TRACK_NAMES, type FsNode } from "./data.ts";
import {
  resolveTrackDurationSec,
  synthesizeCoverSvg,
  synthesizeFilePlaceholderSvg,
  synthesizeFilePlaceholderText,
  synthesizeSilentWav,
} from "./media.ts";
import { createFixtureScenario } from "./scenarios.ts";

interface FixtureState {
  rootFolder: string | null;
  lastScanTime: string | null;
  works: WorkSummary[];
  smartFolders: SmartFolder[];
  presets: SearchPreset[];
  nextPresetId: number;
  nextSmartFolderId: number;
  /** 作品ごとのレジューム位置 */
  resumes: Map<string, ResumeBody>;
  /** scan() が newWorkIds として返す、未取り込みの新規作品ID（シナリオ "new-work" 用） */
  scanNewWorkIds: string[];
}

export interface FixtureAdapterOptions {
  /** データシナリオ（省略時 "default"）。不明なIDはエラー */
  scenario?: string;
}

function createInitialState(options: FixtureAdapterOptions): FixtureState {
  const now = new Date().toISOString();
  const scenario = createFixtureScenario(options.scenario, now);
  const maxPresetId = scenario.presets.reduce((max, p) => Math.max(max, p.id), 0);
  const maxSmartFolderNum = scenario.smartFolders.reduce((max, sf) => {
    const m = /^sf-(\d+)$/.exec(sf.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return {
    rootFolder: scenario.rootFolder,
    lastScanTime: scenario.lastScanTime,
    works: scenario.works,
    smartFolders: scenario.smartFolders,
    presets: scenario.presets,
    nextPresetId: maxPresetId + 1,
    nextSmartFolderId: maxSmartFolderNum + 1,
    resumes: new Map(),
    scanNewWorkIds: scenario.scanNewWorkIds,
  };
}

/** WorkSummary から完全形 Work を構築する（trackCount からトラック一覧を生成） */
function buildFullWork(summary: WorkSummary, resumes: Map<string, ResumeBody>): Work {
  const namedTracks = SEED_TRACK_NAMES[summary.id];
  const tracks: Track[] = Array.from({ length: summary.trackCount }, (_, i) => ({
    title: namedTracks?.[i] ?? `Track ${i + 1}`,
    file: `track${String(i + 1).padStart(2, "0")}.mp3`,
  }));

  const { trackCount: _trackCount, ...rest } = summary;
  const resume = resumes.get(summary.id);

  return {
    ...rest,
    defaultPlaylist: tracks.length > 0 ? "default" : null,
    createdAt: summary.addedAt,
    playlists: tracks.length > 0 ? [{ name: "default", tracks }] : [],
    resumePosition: resume?.position ?? 0,
    resumeTrackIndex: resume?.trackIndex ?? 0,
  };
}

/** 作品の FileEntry ツリー（ルートは作品フォルダー自体。path は相対パスで `""` がルート直下を示す） */
function buildWorkFileEntryTree(work: WorkSummary): FileEntry {
  const children = buildWorkFileTree(work);

  function convert(nodes: FsNode[], basePath: string): FileEntry[] {
    return nodes.map((n): FileEntry => {
      const path = basePath ? `${basePath}/${n.name}` : n.name;
      return {
        name: n.name,
        path,
        isDir: n.isDir,
        size: n.size,
        fileType: n.fileType,
        children: n.isDir ? convert(n.children, path) : [],
      };
    });
  }

  return {
    name: work.id,
    path: "",
    isDir: true,
    size: 0,
    fileType: "dir",
    children: convert(children, ""),
  };
}

function normalizeFsPath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** 作品配下のファイルツリーから相対パス（"特典/台本.pdf" 等）でノードを探す。
 *  存在しない・ディレクトリの場合は null */
function findWorkFile(work: WorkSummary, relPath: string): FsNode | null {
  const segments = relPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let nodes = buildWorkFileTree(work);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const node = nodes.find((n) => n.name === seg);
    if (!node) return null;
    if (i === segments.length - 1) return node.isDir ? null : node;
    if (!node.isDir) return null;
    nodes = node.children;
  }
  return null;
}

/** 画像っぽい拡張子か */
function isImagePath(path: string): boolean {
  return /\.(jpe?g|png|gif|bmp|webp|avif|svg)$/i.test(path);
}

/** root 配下の絶対パスからノードを辿る。root 配下でない・存在しなければ null */
function resolveFsNode(root: FsNode, rootAbs: string, target: string): FsNode | null {
  if (target === rootAbs) return root;
  if (!target.startsWith(`${rootAbs}/`)) return null;
  const segments = target.slice(rootAbs.length + 1).split("/").filter(Boolean);
  let cur = root;
  for (const seg of segments) {
    const next = cur.children.find((c) => c.isDir && c.name === seg);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

export function createFixtureAdapter(options: FixtureAdapterOptions = {}): DataAdapter {
  const state = createInitialState(options);

  return {
    // ── 設定・スキャン ──────────────────────────────────────
    async getSettings(): Promise<Settings> {
      return { rootFolder: state.rootFolder, lastScanTime: state.lastScanTime };
    },

    async updateSettings(patch: SettingsUpdate): Promise<Settings> {
      state.rootFolder = patch.rootFolder;
      return { rootFolder: state.rootFolder, lastScanTime: state.lastScanTime };
    },

    async scan(): Promise<ScanResult> {
      state.lastScanTime = new Date().toISOString();
      return {
        registered: state.works.length,
        newlyGenerated: state.scanNewWorkIds.length,
        errors: state.works.filter((w) => w.status === "error").length,
        missing: state.works.filter((w) => w.status === "missing").length,
        newWorkIds: state.scanNewWorkIds,
      };
    },

    // ── 作品 ────────────────────────────────────────────────
    async queryWorks(params: WorksQuery): Promise<WorksPage> {
      return applyWorksQuery(state.works, params);
    },

    async getWork(id: string): Promise<Work | null> {
      const work = state.works.find((w) => w.id === id);
      return work ? buildFullWork(work, state.resumes) : null;
    },

    async patchWork(id: string, patch: WorkPatch): Promise<Work | null> {
      const work = state.works.find((w) => w.id === id);
      if (!work) return null;
      if (patch.title !== undefined) work.title = patch.title;
      if (patch.tags !== undefined) work.tags = [...patch.tags];
      if (patch.bookmarked !== undefined) work.bookmarked = patch.bookmarked;
      return buildFullWork(work, state.resumes);
    },

    async saveResume(id: string, body: ResumeBody): Promise<boolean> {
      const work = state.works.find((w) => w.id === id);
      if (!work) return false;
      state.resumes.set(id, body);
      return true;
    },

    async touchLastPlayed(id: string): Promise<boolean> {
      const work = state.works.find((w) => w.id === id);
      if (!work) return false;
      work.lastPlayedAt = new Date().toISOString();
      return true;
    },

    async listWorkFiles(id: string): Promise<FileEntry | null> {
      const work = state.works.find((w) => w.id === id);
      return work ? buildWorkFileEntryTree(work) : null;
    },

    async listTags(): Promise<string[]> {
      return [...new Set(state.works.flatMap((w) => w.tags))].sort();
    },

    async exportLibrary(): Promise<string> {
      return JSON.stringify({ version: 1, works: state.works }, null, 2);
    },

    // ── 分類軸・スマートフォルダー・プリセット ────────────────
    async getAxisFacets(axis: FacetAxis): Promise<AxisFacetItem[]> {
      return buildAxisFacets(axis, state.works);
    },

    async listSmartFolders(): Promise<SmartFolder[]> {
      return state.smartFolders;
    },

    async createSmartFolder(input: SmartFolderCreate): Promise<SmartFolder> {
      const smartFolder: SmartFolder = {
        id: `sf-${state.nextSmartFolderId++}`,
        name: input.name,
        rules: input.rules,
        sort: input.sort,
        createdAt: new Date().toISOString(),
      };
      state.smartFolders.push(smartFolder);
      return smartFolder;
    },

    async updateSmartFolder(id: string, input: SmartFolderUpdate): Promise<SmartFolder | null> {
      const folder = state.smartFolders.find((f) => f.id === id);
      if (!folder) return null;
      if (input.name !== undefined) folder.name = input.name;
      if (input.rules !== undefined) folder.rules = input.rules;
      if (input.sort !== undefined) folder.sort = input.sort;
      return folder;
    },

    async deleteSmartFolder(id: string): Promise<boolean> {
      const before = state.smartFolders.length;
      state.smartFolders = state.smartFolders.filter((f) => f.id !== id);
      return state.smartFolders.length < before;
    },

    async evalSmartFolder(id: string): Promise<WorkSummary[] | null> {
      const folder = state.smartFolders.find((f) => f.id === id);
      if (!folder) return null;
      return evalSmartFolder(folder, state.works);
    },

    async listPresets(): Promise<SearchPreset[]> {
      return state.presets;
    },

    async createPreset(input: SearchPresetCreate): Promise<SearchPreset> {
      const preset: SearchPreset = {
        id: state.nextPresetId++,
        name: input.name,
        query: input.query,
        tagFilters: input.tagFilters,
        sortId: input.sortId,
      };
      state.presets.push(preset);
      return preset;
    },

    async deletePreset(id: number): Promise<boolean> {
      const before = state.presets.length;
      state.presets = state.presets.filter((p) => p.id !== id);
      return state.presets.length < before;
    },

    // ── 物理ファイルシステム（Filesモード） ────────────────────
    async browseFs(path?: string): Promise<FsListing | null> {
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const target = path ? normalizeFsPath(path) : rootAbs;

      const root = buildFsRoot(state.works);
      const dir = resolveFsNode(root, rootAbs, target);
      if (!dir) return null;

      const parent = target === rootAbs ? null : target.slice(0, target.lastIndexOf("/")) || rootAbs;

      return {
        path: target,
        parent,
        workId: dir.workId,
        entries: dir.children.map((c) => ({
          name: c.name,
          path: `${target}/${c.name}`,
          isDir: c.isDir,
          size: c.size,
          fileType: c.fileType,
          childCount: c.isDir ? c.children.length : 0,
          workId: c.workId,
          workRelPath: c.workRelPath,
        })),
      };
    },

    // ── メディア・DLsite ────────────────────────────────────
    // fixture アダプタには実体ファイルが無いため、再生・シーク・カバー表示が
    // 成立するようメモリ上でコンテンツを合成する（synthetic MediaLocation）。
    async locateMedia(kind: MediaKind, workId: string, relPath?: string): Promise<MediaLocation | null> {
      const work = state.works.find((w) => w.id === workId);
      if (!work) return null;

      if (kind === "cover") {
        // real アダプタと同様、coverImage 未設定なら 404（クライアント側で placeholder 表示）
        if (!work.coverImage) return null;
        return synthesizeCoverSvg(work);
      }

      if (!relPath) return null;

      if (kind === "audio") {
        const namedTracks = SEED_TRACK_NAMES[work.id];
        const tracks = Array.from({ length: work.trackCount }, (_, i) => ({
          title: namedTracks?.[i] ?? `Track ${i + 1}`,
          file: `track${String(i + 1).padStart(2, "0")}.mp3`,
        }));
        const track = tracks.find((t) => t.file === relPath);
        if (!track) return null;

        const durationSec = resolveTrackDurationSec(track, work, tracks.length);
        return synthesizeSilentWav(durationSec);
      }

      // kind === "file": 作品配下に実在するパスのみ応答する
      const node = findWorkFile(work, relPath);
      if (!node) return null;

      if (isImagePath(relPath)) return synthesizeFilePlaceholderSvg(relPath);
      return synthesizeFilePlaceholderText(relPath);
    },

    async dlsiteFetch(workId: string): Promise<DlsiteWorkInfo | null> {
      return {
        rjCode: workId,
        title: `（fixture）${workId}`,
        circle: "fixtureサークル",
        cvs: ["fixture CV"],
        genreTags: ["テスト"],
        coverUrl: null,
        url: `https://www.dlsite.com/maniax/work/=/product_id/${workId}.html`,
      };
    },

    async dlsiteApply(workId: string, body: DlsiteApplyBody): Promise<boolean> {
      const work = state.works.find((w) => w.id === workId);
      if (!work) return false;
      if (body.applyTitle) work.title = body.info.title;
      if (body.applyTags) {
        const circleTag = body.info.circle ? [`サークル/${body.info.circle}`] : [];
        const cvTags = body.info.cvs.map((cv) => `cv/${cv}`);
        work.tags = [...new Set([...circleTag, ...cvTags, ...body.info.genreTags])];
      }
      if (body.applyCover && body.info.coverUrl) {
        work.coverImage = body.info.coverUrl;
      }
      return true;
    },
  };
}
