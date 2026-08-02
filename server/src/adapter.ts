// データアダプタ境界（ADR-0002）。
// ルーター・ドメインロジックは1系統だけ持ち、データの出どころをこのインターフェースで差し替える:
//   - fixture アダプタ: インメモリ fixtures（開発・ビジュアルテスト用）
//   - real アダプタ:    SQLite + 実ファイルシステム（移行プラン ステップ3で実装）
import { createHash } from "node:crypto";
import type {
  AxisFacetItem,
  DlsiteApplyBody,
  DlsiteNotificationKind,
  DlsiteNotificationPage,
  DlsiteNotificationQuery,
  DlsiteNotificationSummary,
  DlsiteFetchResult,
  DlsiteBulkMode,
  DlsiteBulkProgressEvent,
  DlsiteBulkResult,
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
  WorkCreateBody,
  WorkPatch,
  WorkRegisterPreview,
  WorksPage,
  WorksQuery,
} from "@mimimilli/shared";

export interface ScanOptions {
  /** true のとき fingerprint に関係なく全作品を再処理する（TASK-95） */
  full?: boolean;
  signal?: AbortSignal;
  onProgress?: (event: ScanProgressEvent) => void;
  /** Worker 内の同期処理にも到達する取消トークン。adapter 内部だけで設定する。 */
  abortToken?: Int32Array;
  /** Worker結合テストでfinalize直前に同期停止する内部フック。 */
  beforeFinalize?: () => void;
}

/** 前提条件（ルートフォルダー未設定等）を満たしていない操作。HTTP では 409 conflict */
export class NotConfiguredError extends Error {}

/** Workは存在するが、resumeのPlaylist/Track所属またはoffsetが不正。 */
export class InvalidResumeError extends Error {}

/** メディア実体の所在。ルートがストリーミング（Range 対応）を担当する。
 *  - "file": 実ファイル参照（real アダプタ）。ルートが node:fs でストリーミングする
 *  - "synthetic": メモリ上で合成するコンテンツ（fixture アダプタ）。
 *    全体をメモリに保持せず、`read(start, end)` で要求された byte range 分だけ生成する */
export type MediaLocation =
  | { type: "file"; absolutePath: string; mime: string; size?: number }
  | {
      type: "synthetic";
      mime: string;
      size: number;
      read: (start: number, end: number) => Uint8Array;
    };

export type MediaKind = "audio" | "file";

/**
 * カバーの条件付きGETを、実体の生成・読み込みより先に判定するための情報。
 * materialize は304を返さない場合だけ呼ばれる。
 */
export interface CoverDescriptor {
  etag: string;
  /** 元ファイルの更新時刻。HTTP-dateへの秒丸めはルートでだけ行う。 */
  lastModifiedMs: number;
  materialize(): Promise<MediaLocation>;
}

/** カバーrepresentationのvalidator。mtimeはHTTP-dateの精度へ丸める。 */
export function createCoverValidators(
  workId: string,
  width: number | undefined,
  source: { size: number; mtimeMs: number },
): Pick<CoverDescriptor, "etag" | "lastModifiedMs"> {
  const representation = width === undefined ? "original" : String(width);
  const canonical = `mimimilli-cover-v1\0${workId}\0${representation}\0${source.size}\0${source.mtimeMs}`;
  const digest = createHash("sha256").update(canonical).digest("base64url");
  return {
    etag: `W/"mimimilli-cover-v1-${digest}"`,
    lastModifiedMs: source.mtimeMs,
  };
}

export interface DataAdapter {
  // 設定・スキャン
  getSettings(): Promise<Settings>;
  updateSettings(patch: SettingsUpdate): Promise<Settings>;
  /** signal はジョブ取消用。 */
  scan(options?: ScanOptions): Promise<ScanResult>;

  // 作品
  queryWorks(params: WorksQuery): Promise<WorksPage>;
  getWorkRegisterPreview(path: string): Promise<WorkRegisterPreview | null>;
  createWork(body: WorkCreateBody): Promise<Work | null>;
  /** 作品を DB とメタファイルから削除する。物理ファイルは触らない。存在しなければ false */
  deleteWork(id: string): Promise<boolean>;
  getDlsiteNotificationSummary(): Promise<DlsiteNotificationSummary>;
  queryDlsiteNotifications(
    kind: DlsiteNotificationKind,
    query: Required<DlsiteNotificationQuery>,
  ): Promise<DlsiteNotificationPage>;
  getWork(id: string): Promise<Work | null>;
  /** 更新後の Work を返す。存在しなければ null */
  patchWork(id: string, patch: WorkPatch): Promise<Work | null>;
  saveResume(id: string, body: ResumeBody): Promise<boolean>;
  touchLastPlayed(id: string): Promise<boolean>;
  listWorkFiles(id: string): Promise<FileEntry | null>;
  listTags(): Promise<string[]>;
  exportLibrary(): Promise<string>;

  // 分類軸・タグ prefix 定義・スマートフォルダー
  /** axis は "tag" / "year" / 任意の prefix 文字列（正規形・小文字）（ADR-0005） */
  getAxisFacets(axis: string): Promise<AxisFacetItem[]>;
  listTagPrefixes(): Promise<TagPrefix[]>;
  /** 既存の prefix と重複する場合は null（ルートが 409 を返す） */
  createTagPrefix(input: TagPrefixCreate): Promise<TagPrefix | null>;
  updateTagPrefix(prefix: string, patch: TagPrefixUpdate): Promise<TagPrefix | null>;
  deleteTagPrefix(prefix: string): Promise<boolean>;
  listTagPrefixCandidates(): Promise<TagPrefixCandidate[]>;
  listSmartFolders(): Promise<SmartFolder[]>;
  createSmartFolder(input: SmartFolderCreate): Promise<SmartFolder>;
  updateSmartFolder(id: string, input: SmartFolderUpdate): Promise<SmartFolder | null>;
  deleteSmartFolder(id: string): Promise<boolean>;
  evalSmartFolder(
    id: string,
    query: { page: number; limit: number; seed?: number },
  ): Promise<WorksPage | null>;

  // 物理ファイルシステム（Filesモード）
  /** path 省略時はルートフォルダー。ルート配下でない・存在しない場合は null */
  browseFs(path?: string): Promise<FsListing | null>;

  // メディア・DLsite
  /** スキャンルート配下の絶対物理パスから音声を解決する。ルート外・非音声・不存在は null */
  locateFsAudio(absolutePath: string): Promise<MediaLocation | null>;
  /** 実体が無い（fixture 等）場合は null → ルートが 404 を返す。カバーは describeCover を使う。 */
  locateMedia(kind: MediaKind, workId: string, relPath?: string): Promise<MediaLocation | null>;
  /** カバー専用の軽量な事前確認。音声・通常ファイルの契約は locateMedia のまま維持する。 */
  describeCover(workId: string, width?: number): Promise<CoverDescriptor | null>;
  /** force=true はキャッシュを無視して明示的に再取得する。 */
  dlsiteFetch(
    workId: string,
    force?: boolean,
    options?: { signal?: AbortSignal },
  ): Promise<DlsiteFetchResult>;
  /** 作品未登録時のプレビュー用。RJ/VJコードを直接指定して取得する。 */
  dlsiteFetchByCode(
    rjCode: string,
    force?: boolean,
    options?: { signal?: AbortSignal },
  ): Promise<DlsiteFetchResult>;
  dlsiteApply(
    workId: string,
    body: DlsiteApplyBody,
    options?: { signal?: AbortSignal },
  ): Promise<boolean>;
  updateDlsiteState(workId: string, patch: DlsiteStatePatch): Promise<Work | null>;
  runDlsiteBulk(
    mode: DlsiteBulkMode,
    workIds: string[] | undefined,
    options?: {
      signal?: AbortSignal;
      onProgress?: (event: Extract<DlsiteBulkProgressEvent, { type: "progress" }>) => void;
    },
  ): Promise<DlsiteBulkResult>;
}
