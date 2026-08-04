// fixture アダプタ: インメモリの seed データを使う DataAdapter 実装。
// 開発・ビジュアルテスト用（ADR-0002）。core/ の pure 関数を使って全メソッドを実装する。
import { posix } from "node:path";
import {
  applyDlsiteStatePatch,
  DEFAULT_TAG_PREFIXES,
  emptyDlsiteState,
  evaluateParseErrorAlert,
  isDlsiteFetchFailed,
  isDlsiteParseFailed,
  isDlsiteUnlinked,
  isRjCodeMissing,
  normalizeTags,
  toWorkListItem,
  toTrackDurationFieldsFromSec,
  coverFieldsFromColumns,
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
  ResolvedPlaylist,
  ResolvedTrack,
  Work,
  WorkCreateBody,
  WorkPatch,
  WorkRegisterPreview,
  WorksPage,
  WorksQuery,
  WorkSummary,
} from "@mimimilli/shared";
import {
  createCoverValidators,
  InvalidResumeError,
  type AxisFacetsFilter,
  type CoverDescriptor,
  type DataAdapter,
  type MediaKind,
  type MediaLocation,
  type SmartFolderEvalQuery,
} from "../../adapter.ts";
import type { ScanOptions } from "../../adapter.ts";
import { buildAxisFacets } from "../../core/axisFacets.ts";
import { buildTagPrefixCandidates } from "../../core/tagPrefixCandidates.ts";
import { evalSmartFolder } from "../../core/smartFolder.ts";
import { compareJapaneseSortKeys, compareUtf8Bytes } from "../../core/japaneseSortKey.ts";
import { applyWorksQuery, type WorkSummaryPage } from "../../core/worksQuery.ts";
import {
  buildFsRoot,
  buildWorkFileTree,
  fixtureCoverColumnsForWork,
  fixtureCoverFromColumns,
  SEED_PLAYLIST_SPECS,
  SEED_TRACK_NAMES,
  type FixtureCoverColumns,
  type FsNode,
} from "./data.ts";
import {
  DEFAULT_TRACK_DURATION_SEC,
  synthesizeCoverSvg,
  synthesizeFilePlaceholderSvg,
  synthesizeFilePlaceholderText,
  synthesizeSilentWav,
} from "./media.ts";
import { createFixtureScenario } from "./scenarios.ts";
import { isPathWithin } from "../real/paths.ts";
import { WorkRegisterError } from "../real/workRegister.ts";

/** 作品1件ぶんの安定したplaylist/track ID（呼び出しをまたいで同一IDを保つ） */
interface PlaybackIds {
  playlists: Array<{ id: string; trackIds: string[] }>;
}

interface FixtureState {
  rootFolder: string | null;
  lastScanTime: string | null;
  works: WorkSummary[];
  /** 編集用カバー列（表示用 cover と独立。unmeasured を表現する） */
  coverColumns: Map<string, FixtureCoverColumns>;
  tagPrefixes: TagPrefix[];
  smartFolders: SmartFolder[];
  nextSmartFolderId: number;
  /** 作品ごとのレジューム位置 */
  resumes: Map<string, ResumeBody>;
  playbackIds: Map<string, PlaybackIds>;
  /** scan() が newWorkIds として返す、未取り込みの新規作品ID（シナリオ "new-work" 用） */
  scanNewWorkIds: string[];
}

function toListPage(page: WorkSummaryPage): WorksPage {
  return page.seed === undefined
    ? { items: page.items.map(toWorkListItem), total: page.total, stats: page.stats }
    : {
        items: page.items.map(toWorkListItem),
        total: page.total,
        stats: page.stats,
        seed: page.seed,
      };
}

export interface FixtureAdapterOptions {
  /** データシナリオ（省略時 "default"）。不明なIDはエラー */
  scenario?: string;
  /** 契約テスト用に差し替える作品一覧。省略時はscenarioのseedを使う。 */
  works?: WorkSummary[];
}

function createInitialState(options: FixtureAdapterOptions): FixtureState {
  const now = new Date().toISOString();
  const scenario = createFixtureScenario(options.scenario, now);
  const maxSmartFolderNum = scenario.smartFolders.reduce((max, sf) => {
    const m = /^sf-(\d+)$/.exec(sf.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const works = options.works ?? scenario.works;
  const coverColumns = new Map<string, FixtureCoverColumns>();
  for (const work of works) {
    coverColumns.set(work.id, fixtureCoverColumnsForWork(work));
  }
  return {
    rootFolder: scenario.rootFolder,
    lastScanTime: scenario.lastScanTime,
    works,
    coverColumns,
    tagPrefixes: DEFAULT_TAG_PREFIXES.map((def) => ({ ...def })),
    smartFolders: scenario.smartFolders,
    nextSmartFolderId: maxSmartFolderNum + 1,
    resumes: new Map(),
    playbackIds: new Map(),
    scanNewWorkIds: scenario.scanNewWorkIds,
  };
}

/** totalDurationSec を trackCount で等分した決定的な durationSec（端数は最終トラックに寄せる） */
function splitDurationSec(totalDurationSec: number, trackCount: number, index: number): number {
  const base = Math.floor(totalDurationSec / trackCount);
  const remainder = totalDurationSec - base * trackCount;
  return index === trackCount - 1 ? base + remainder : base;
}

/** 作品の playlist/track 数に対応する安定したIDを割り当てる（初回のみ生成しキャッシュ） */
function ensurePlaybackIds(
  summary: WorkSummary,
  playbackIds: Map<string, PlaybackIds>,
): PlaybackIds {
  const cached = playbackIds.get(summary.id);
  if (cached) return cached;

  const specPlaylists = SEED_PLAYLIST_SPECS[summary.id];
  const trackCounts = specPlaylists
    ? specPlaylists.map((p) => p.tracks.length)
    : summary.trackCount > 0
      ? [summary.trackCount]
      : [];
  const ids: PlaybackIds = {
    playlists: trackCounts.map((count) => ({
      id: crypto.randomUUID(),
      trackIds: Array.from({ length: count }, () => crypto.randomUUID()),
    })),
  };
  playbackIds.set(summary.id, ids);
  return ids;
}

/** WorkSummary から完全形 Work を構築する。
 *  SEED_PLAYLIST_SPECS で明示指定された作品はそれをそのまま解決済みplaylistsにし、
 *  未指定の作品は trackCount からファイル全体トラック（durationSecはtotalDurationSecの等分）を自動生成する。 */
function coverColumnsOf(state: FixtureState, workId: string): FixtureCoverColumns {
  return state.coverColumns.get(workId) ?? { image: null, dimensions: null };
}

function buildFullWorkFromState(state: FixtureState, work: WorkSummary): Work {
  return buildFullWork(work, coverColumnsOf(state, work.id), state.resumes, state.playbackIds);
}

function buildFullWork(
  summary: WorkSummary,
  coverColumns: FixtureCoverColumns,
  resumes: Map<string, ResumeBody>,
  playbackIds: Map<string, PlaybackIds>,
): Work {
  const ids = ensurePlaybackIds(summary, playbackIds);
  const specPlaylists = SEED_PLAYLIST_SPECS[summary.id];
  const namedTracks = SEED_TRACK_NAMES[summary.id];

  const playlists: ResolvedPlaylist[] = specPlaylists
    ? specPlaylists.map((spec, playlistIndex) => ({
        id: ids.playlists[playlistIndex]!.id,
        name: spec.name,
        tracks: spec.tracks.map((track, trackIndex) => ({
          id: ids.playlists[playlistIndex]!.trackIds[trackIndex]!,
          title: track.title,
          file: track.file,
          start: track.start,
          end: track.end,
          ...toTrackDurationFieldsFromSec(track.durationSec),
        })),
      }))
    : ids.playlists.length > 0
      ? [
          {
            id: ids.playlists[0]!.id,
            name: "default",
            tracks: Array.from({ length: summary.trackCount }, (_, i) => {
              const durationSec =
                summary.totalDurationSec !== null && summary.totalDurationSec > 0
                  ? splitDurationSec(summary.totalDurationSec, summary.trackCount, i)
                  : null;
              return {
                id: ids.playlists[0]!.trackIds[i]!,
                title: namedTracks?.[i] ?? `Track ${i + 1}`,
                file: `track${String(i + 1).padStart(2, "0")}.mp3`,
                ...toTrackDurationFieldsFromSec(durationSec),
              };
            }),
          },
        ]
      : [];

  const { trackCount: _trackCount, ...rest } = summary;
  const resume = resumes.get(summary.id);
  const { cover, coverKind, coverImage } = coverFieldsFromColumns(
    coverColumns.image,
    coverColumns.dimensions?.width ?? null,
    coverColumns.dimensions?.height ?? null,
  );

  return {
    ...rest,
    cover,
    coverKind,
    coverImage,
    defaultPlaylistId: playlists[0]?.id ?? null,
    createdAt: summary.addedAt,
    playlists,
    resume: resume ?? null,
  };
}

/** 作品の全playlistから file が一致する最初のトラックを探す（audio locateMedia用） */
function findTrackByFile(work: Work, relPath: string): ResolvedTrack | undefined {
  for (const playlist of work.playlists) {
    const track = playlist.tracks.find((t) => t.file === relPath);
    if (track) return track;
  }
  return undefined;
}

/** 作品の FileEntry ツリー（ルートは作品フォルダー自体。path は相対パスで `""` がルート直下を示す） */
function buildWorkFileEntryTree(work: WorkSummary, coverColumns: FixtureCoverColumns): FileEntry {
  const children = buildWorkFileTree(work, coverColumns.image);

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

/** 疑似スキャン進捗の1ステップあたりの待機時間（ms） */
const FIXTURE_SCAN_STEP_MS = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeFsPath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** 作品配下のファイルツリーから相対パス（"特典/台本.pdf" 等）でノードを探す。
 *  存在しない・ディレクトリの場合は null */
function findWorkFile(
  work: WorkSummary,
  coverColumns: FixtureCoverColumns,
  relPath: string,
): FsNode | null {
  const segments = relPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  let nodes = buildWorkFileTree(work, coverColumns.image);
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
  const segments = target
    .slice(rootAbs.length + 1)
    .split("/")
    .filter(Boolean);
  let cur = root;
  for (const seg of segments) {
    const next = cur.children.find((c) => c.isDir && c.name === seg);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

/** ファイルまたはディレクトリを解決する（browseFs はディレクトリ専用） */
function resolveFsPath(root: FsNode, rootAbs: string, target: string): FsNode | null {
  if (target === rootAbs) return root;
  if (!target.startsWith(`${rootAbs}/`)) return null;
  const segments = target
    .slice(rootAbs.length + 1)
    .split("/")
    .filter(Boolean);
  let cur = root;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const next = cur.children.find((c) => c.name === seg);
    if (!next) return null;
    if (i === segments.length - 1) return next;
    if (!next.isDir) return null;
    cur = next;
  }
  return null;
}

function isAudioFileType(fileType: string): boolean {
  return ["mp3", "m4a", "aac", "wav", "ogg", "flac", "webm", "opus"].includes(
    fileType.toLowerCase(),
  );
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

    // fixture には実際に走査するファイルシステムが無いため、数ステップのタイマー進行で
    // 疑似的な進捗を流す（本物のスキャンと同じイベント契約を dev/デモ環境でも確認できるように）。
    async scan(options?: ScanOptions): Promise<ScanResult> {
      const emit = options?.onProgress ?? ((): void => {});
      const checkAbort = () => {
        if (options?.signal?.aborted)
          throw new DOMException("スキャンはキャンセルされました", "AbortError");
      };
      const pseudoSteps = 4;

      checkAbort();
      emit({ type: "progress", phase: "walking", processed: 0, total: 0 });
      await sleep(FIXTURE_SCAN_STEP_MS);
      checkAbort();
      emit({ type: "progress", phase: "registering", processed: 0, total: pseudoSteps });
      for (let i = 1; i <= pseudoSteps; i++) {
        await sleep(FIXTURE_SCAN_STEP_MS);
        checkAbort();
        emit({ type: "progress", phase: "registering", processed: i, total: pseudoSteps });
      }
      await sleep(FIXTURE_SCAN_STEP_MS);
      checkAbort();
      emit({ type: "progress", phase: "finalizing", processed: 1, total: 1 });

      state.lastScanTime = new Date().toISOString();
      return {
        registered: state.works.length,
        newlyGenerated: state.scanNewWorkIds.length,
        errors: state.works.filter((w) => w.status === "error").length,
        missing: state.works.filter((w) => w.status === "missing").length,
        newWorkIds: state.scanNewWorkIds,
        rjCodeMissingCount: state.works.filter((w) => isRjCodeMissing(w.dlsite)).length,
        // fixture には増分スキャンの fingerprint 比較が無く、常に全件を処理し直すため0固定
        skipped: 0,
        // fixture のカバーは合成SVGで計測失敗が起きないため0固定
        coverErrors: 0,
        unreadablePaths: [],
      };
    },

    // ── 作品 ────────────────────────────────────────────────
    async queryWorks(params: WorksQuery): Promise<WorksPage> {
      return toListPage(applyWorksQuery(state.works, params));
    },

    async getDlsiteNotificationSummary(): Promise<DlsiteNotificationSummary> {
      const parseErrorCount = state.works.filter((work) => isDlsiteParseFailed(work.dlsite)).length;
      const parseSuccessCount = state.works.filter(
        (work) => work.dlsite.status === "applied",
      ).length;
      return {
        rjCodeMissingCount: state.works.filter((work) => isRjCodeMissing(work.dlsite)).length,
        fetchFailedCount: state.works.filter((work) => isDlsiteFetchFailed(work.dlsite)).length,
        parseErrorCount,
        parseErrorAlert: evaluateParseErrorAlert(parseErrorCount, parseSuccessCount),
        unlinkedCount: state.works.filter((work) => isDlsiteUnlinked(work.dlsite)).length,
      };
    },

    async queryDlsiteNotifications(
      kind: DlsiteNotificationKind,
      query: Required<DlsiteNotificationQuery>,
    ): Promise<DlsiteNotificationPage> {
      const predicate = (() => {
        switch (kind) {
          case "rj-missing":
            return isRjCodeMissing;
          case "fetch-failed":
            return isDlsiteFetchFailed;
          case "parse-failed":
            return isDlsiteParseFailed;
        }
      })();
      const matches = state.works
        .filter((work) => predicate(work.dlsite))
        .sort((a, b) => compareJapaneseSortKeys(a.title, b.title) || compareUtf8Bytes(a.id, b.id));
      const start = (query.page - 1) * query.limit;
      return {
        items: matches.slice(start, start + query.limit).map((work) => ({
          id: work.id,
          title: work.title,
          status: work.dlsite.status,
          rjCode: kind === "parse-failed" ? work.dlsite.rjCode : null,
        })),
        total: matches.length,
      };
    },

    async getWork(id: string): Promise<Work | null> {
      const work = state.works.find((w) => w.id === id);
      return work ? buildFullWorkFromState(state, work) : null;
    },

    async getWorkRegisterPreview(path: string): Promise<WorkRegisterPreview | null> {
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const workDir = normalizeFsPath(path);
      if (!isPathWithin(rootAbs, workDir, posix)) return null;
      const folderName = workDir.split("/").filter(Boolean).pop() ?? workDir;
      const descendants = state.works.filter(
        (work) => work.physicalPath.startsWith(`${workDir}/`) && work.physicalPath !== workDir,
      );
      const rjMatch = folderName.match(/RJ\d{6,8}/i);
      return {
        suggestedTitle: folderName,
        tags: [],
        detectedRjCode: rjMatch ? rjMatch[0]!.toUpperCase() : null,
        descendantWorkCount: descendants.length,
        alreadyRegistered: state.works.some((work) => work.physicalPath === workDir),
        orphanedMeta: false,
      };
    },

    async createWork(body: WorkCreateBody): Promise<Work | null> {
      const preview = await this.getWorkRegisterPreview(body.path);
      if (!preview) return null;
      if (preview.alreadyRegistered) {
        throw new WorkRegisterError(
          "already_registered",
          "このフォルダーは既に作品として登録されています",
        );
      }
      if (preview.descendantWorkCount > 0 && !body.mergeDescendantWorks) {
        throw new WorkRegisterError(
          "descendants_require_merge",
          `配下に登録済み作品が${preview.descendantWorkCount}件あります`,
          preview.descendantWorkCount,
        );
      }
      const workDir = normalizeFsPath(body.path);
      state.works = state.works.filter(
        (work) => !(work.physicalPath.startsWith(`${workDir}/`) && work.physicalPath !== workDir),
      );
      const now = new Date().toISOString();
      const applyTags = body.dlsite ? normalizeTags(body.dlsite.applyTags) : [];
      const work: WorkSummary = {
        id: crypto.randomUUID(),
        title: body.title,
        cover: null,
        status: "ok",
        physicalPath: workDir,
        totalDurationSec: 0,
        trackCount: 0,
        addedAt: now,
        errorMessage: null,
        urls:
          body.dlsite?.info.url && body.dlsite.info.url.length > 0
            ? [{ label: "DLsite", url: body.dlsite.info.url }]
            : [],
        tags: body.tags,
        bookmarked: false,
        lastPlayedAt: null,
        dlsite: body.dlsite
          ? {
              rjCode: body.dlsite.info.rjCode,
              status: "applied",
              lastAttemptAt: now,
              error: null,
              errorKind: null,
              appliedTags: applyTags,
            }
          : preview.detectedRjCode
            ? { ...emptyDlsiteState(), rjCode: preview.detectedRjCode }
            : emptyDlsiteState(),
      };
      state.works.push(work);
      return buildFullWorkFromState(state, work);
    },

    async deleteWork(id: string): Promise<boolean> {
      const index = state.works.findIndex((w) => w.id === id);
      if (index === -1) return false;
      state.works.splice(index, 1);
      return true;
    },

    async patchWork(id: string, patch: WorkPatch): Promise<Work | null> {
      const work = state.works.find((w) => w.id === id);
      if (!work) return null;
      if (patch.title !== undefined) work.title = patch.title;
      if (patch.tags !== undefined) work.tags = normalizeTags(patch.tags);
      if (patch.bookmarked !== undefined) work.bookmarked = patch.bookmarked;
      return buildFullWorkFromState(state, work);
    },

    async saveResume(id: string, body: ResumeBody): Promise<boolean> {
      const work = state.works.find((w) => w.id === id);
      if (!work) return false;
      const fullWork = buildFullWorkFromState(state, work);
      const playlist = fullWork.playlists.find((candidate) => candidate.id === body.playlistId);
      const track = playlist?.tracks.find((candidate) => candidate.id === body.trackId);
      if (!track) {
        throw new InvalidResumeError("resumeのPlaylistまたはTrackが作品に属していません");
      }
      if (track.durationSec !== null && body.offsetSec > track.durationSec) {
        throw new InvalidResumeError("resumeのoffsetSecがトラック区間外です");
      }
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
      return work ? buildWorkFileEntryTree(work, coverColumnsOf(state, work.id)) : null;
    },

    async listTags(): Promise<string[]> {
      return [...new Set(state.works.flatMap((w) => w.tags))].sort();
    },

    async exportLibrary(): Promise<string> {
      return JSON.stringify({ version: 1, works: state.works }, null, 2);
    },

    // ── 分類軸・タグ prefix 定義・スマートフォルダー・プリセット ──
    async getAxisFacets(axis: string, filter?: AxisFacetsFilter): Promise<AxisFacetItem[]> {
      return buildAxisFacets(axis, state.works, filter);
    },

    async listTagPrefixes(): Promise<TagPrefix[]> {
      return state.tagPrefixes;
    },

    async createTagPrefix(input: TagPrefixCreate): Promise<TagPrefix | null> {
      if (state.tagPrefixes.some((p) => p.prefix === input.prefix)) return null;
      const created: TagPrefix = { ...input };
      state.tagPrefixes.push(created);
      return created;
    },

    async updateTagPrefix(prefix: string, patch: TagPrefixUpdate): Promise<TagPrefix | null> {
      const def = state.tagPrefixes.find((p) => p.prefix === prefix);
      if (!def) return null;
      if (patch.label !== undefined) def.label = patch.label;
      if (patch.color !== undefined) def.color = patch.color;
      if (patch.showAsAxis !== undefined) def.showAsAxis = patch.showAsAxis;
      if (patch.protected !== undefined) def.protected = patch.protected;
      return def;
    },

    async deleteTagPrefix(prefix: string): Promise<boolean> {
      const before = state.tagPrefixes.length;
      state.tagPrefixes = state.tagPrefixes.filter((p) => p.prefix !== prefix);
      return state.tagPrefixes.length < before;
    },

    async listTagPrefixCandidates(): Promise<TagPrefixCandidate[]> {
      return buildTagPrefixCandidates(
        state.works,
        state.tagPrefixes.map((p) => p.prefix),
      );
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

    async evalSmartFolder(id: string, query: SmartFolderEvalQuery): Promise<WorksPage | null> {
      const folder = state.smartFolders.find((f) => f.id === id);
      if (!folder) return null;
      return toListPage(evalSmartFolder(folder, state.works, query));
    },

    // ── 物理ファイルシステム（Filesモード） ────────────────────
    async browseFs(path?: string): Promise<FsListing | null> {
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const target = path ? normalizeFsPath(path) : rootAbs;

      const root = buildFsRoot(state.works, state.coverColumns);
      const dir = resolveFsNode(root, rootAbs, target);
      if (!dir) return null;

      const parent =
        target === rootAbs ? null : target.slice(0, target.lastIndexOf("/")) || rootAbs;

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
    async locateFsAudio(absolutePath: string): Promise<MediaLocation | null> {
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const target = normalizeFsPath(absolutePath);
      const root = buildFsRoot(state.works, state.coverColumns);
      const node = resolveFsPath(root, rootAbs, target);
      if (!node || node.isDir || !isAudioFileType(node.fileType)) return null;
      return synthesizeSilentWav(DEFAULT_TRACK_DURATION_SEC);
    },

    async locateMedia(
      kind: MediaKind,
      workId: string,
      relPath?: string,
    ): Promise<MediaLocation | null> {
      const work = state.works.find((w) => w.id === workId);
      if (!work) return null;

      if (!relPath) return null;

      if (kind === "audio") {
        const fullWork = buildFullWorkFromState(state, work);
        const track = findTrackByFile(fullWork, relPath);
        if (!track) return null;

        // 合成WAVには具体的な長さが必要なため、durationSec未知（null）時だけ既定値で代替する
        // （DTO自体はnullのまま返し、UIの「未知」表現には影響しない）。
        return synthesizeSilentWav(track.durationSec ?? DEFAULT_TRACK_DURATION_SEC);
      }

      // kind === "file": 作品配下に実在するパスのみ応答する
      const node = findWorkFile(work, coverColumnsOf(state, work.id), relPath);
      if (!node) return null;

      if (isImagePath(relPath)) return synthesizeFilePlaceholderSvg(relPath);
      return synthesizeFilePlaceholderText(relPath);
    },

    async describeCover(workId: string, width?: number): Promise<CoverDescriptor | null> {
      const work = state.works.find((entry) => entry.id === workId);
      if (!work?.cover) return null;
      const location = synthesizeCoverSvg(work);
      if (location.type !== "synthetic") {
        throw new Error("fixtureのカバー画像はsynthetic MediaLocationである必要があります");
      }
      const validators = createCoverValidators(work.id, width, { size: location.size, mtimeMs: 0 });
      return {
        ...validators,
        async materialize(): Promise<MediaLocation> {
          return location;
        },
      };
    },

    async dlsiteFetch(
      workId: string,
      _force?: boolean,
      _options?: { signal?: AbortSignal },
    ): Promise<DlsiteFetchResult> {
      const work = state.works.find((candidate) => candidate.id === workId);
      if (!work)
        return { ok: false, kind: "not_found", message: `作品が見つかりません: ${workId}` };
      const rjCode = work.dlsite.rjCode;
      if (!rjCode) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      return this.dlsiteFetchByCode(rjCode);
    },

    async dlsiteFetchByCode(
      rjCode: string,
      _force?: boolean,
      _options?: { signal?: AbortSignal },
    ): Promise<DlsiteFetchResult> {
      return {
        ok: true,
        info: {
          rjCode,
          title: `（fixture）${rjCode}`,
          circle: "fixtureサークル",
          cvs: ["fixture CV"],
          genreTags: ["テスト"],
          coverUrl: null,
          url: `https://www.dlsite.com/maniax/work/=/product_id/${rjCode}.html`,
        },
      };
    },

    async dlsiteApply(
      workId: string,
      body: DlsiteApplyBody,
      _options?: { signal?: AbortSignal },
    ): Promise<boolean> {
      const work = state.works.find((w) => w.id === workId);
      if (!work) return false;
      if (body.applyTitle) work.title = body.info.title;
      const applyTags = normalizeTags(body.applyTags);
      work.tags = normalizeTags([...work.tags, ...applyTags]);
      if (body.applyCover && body.info.coverUrl) {
        const dimensions = work.cover?.dimensions ?? { width: 900, height: 900 };
        const columns: FixtureCoverColumns = {
          image: body.info.coverUrl,
          dimensions,
        };
        state.coverColumns.set(workId, columns);
        work.cover = fixtureCoverFromColumns(columns);
      }
      work.dlsite = {
        rjCode: body.info.rjCode,
        status: "applied",
        lastAttemptAt: new Date().toISOString(),
        error: null,
        errorKind: null,
        appliedTags: normalizeTags([...work.dlsite.appliedTags, ...applyTags]),
      };
      return true;
    },

    async updateDlsiteState(workId: string, patch: DlsiteStatePatch): Promise<Work | null> {
      const work = state.works.find((candidate) => candidate.id === workId);
      if (!work) return null;
      work.dlsite = applyDlsiteStatePatch(work.dlsite, patch);
      return buildFullWorkFromState(state, work);
    },

    async runDlsiteBulk(
      mode: DlsiteBulkMode,
      workIds: string[] | undefined,
      options?: {
        signal?: AbortSignal;
        onProgress?: (event: Extract<DlsiteBulkProgressEvent, { type: "progress" }>) => void;
      },
    ): Promise<DlsiteBulkResult> {
      const requested = workIds
        ? state.works.filter((work) => workIds.includes(work.id))
        : state.works;
      const targets = requested.filter(
        (work) =>
          work.dlsite.rjCode && (work.dlsite.status === "none" || work.dlsite.status === "error"),
      );
      const result: DlsiteBulkResult = {
        fetched: 0,
        failed: 0,
        parseErrors: 0,
        skipped: requested.length - targets.length,
      };
      for (let index = 0; index < targets.length; index++) {
        if (options?.signal?.aborted) return result;
        const work = targets[index]!;
        const fetchedTags = normalizeTags([
          "サークル/fixtureサークル",
          "cv/fixture CV",
          "genre/テスト",
        ]);
        const applyTags =
          mode === "new"
            ? fetchedTags
            : fetchedTags.filter((tag) => !work.dlsite.appliedTags.includes(tag));
        if (mode === "new") work.title = `（fixture）${work.dlsite.rjCode}`;
        work.tags = normalizeTags([...work.tags, ...applyTags]);
        work.dlsite = {
          ...work.dlsite,
          status: "applied",
          lastAttemptAt: new Date().toISOString(),
          error: null,
          errorKind: null,
          appliedTags: normalizeTags([...work.dlsite.appliedTags, ...fetchedTags]),
        };
        result.fetched += 1;
        options?.onProgress?.({
          type: "progress",
          processed: index + 1,
          total: targets.length,
          workId: work.id,
        });
      }
      return result;
    },
  };
}
