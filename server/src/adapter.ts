// データアダプタ境界（ADR-0002）。
// ルーター・ドメインロジックは1系統だけ持ち、データの出どころをこのインターフェースで差し替える:
//   - fixture アダプタ: インメモリ fixtures（開発・ビジュアルテスト用）
//   - real アダプタ:    SQLite + 実ファイルシステム（移行プラン ステップ3で実装）
import type {
  AxisFacetItem,
  DlsiteApplyBody,
  DlsiteWorkInfo,
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

/** 前提条件（ルートフォルダー未設定等）を満たしていない操作。HTTP では 409 conflict */
export class NotConfiguredError extends Error {}

/** メディア実体の所在。ルートがストリーミング（Range 対応）を担当する。
 *  - "file": 実ファイル参照（real アダプタ）。ルートが node:fs でストリーミングする
 *  - "synthetic": メモリ上で合成するコンテンツ（fixture アダプタ）。
 *    全体をメモリに保持せず、`read(start, end)` で要求された byte range 分だけ生成する */
export type MediaLocation =
  | { type: "file"; absolutePath: string; mime: string }
  | {
      type: "synthetic";
      mime: string;
      size: number;
      read: (start: number, end: number) => Uint8Array;
    };

export type MediaKind = "cover" | "audio" | "file";

export interface DataAdapter {
  // 設定・スキャン
  getSettings(): Promise<Settings>;
  updateSettings(patch: SettingsUpdate): Promise<Settings>;
  /** onProgress は任意。呼ぶたびに進捗イベントを通知する（TASK-20、GET /scan/events の配信元） */
  scan(onProgress?: (event: ScanProgressEvent) => void): Promise<ScanResult>;

  // 作品
  queryWorks(params: WorksQuery): Promise<WorksPage>;
  getWork(id: string): Promise<Work | null>;
  /** 更新後の Work を返す。存在しなければ null */
  patchWork(id: string, patch: WorkPatch): Promise<Work | null>;
  saveResume(id: string, body: ResumeBody): Promise<boolean>;
  touchLastPlayed(id: string): Promise<boolean>;
  listWorkFiles(id: string): Promise<FileEntry | null>;
  listTags(): Promise<string[]>;
  exportLibrary(): Promise<string>;

  // 分類軸・タグ prefix 定義・スマートフォルダー・プリセット
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
  evalSmartFolder(id: string): Promise<WorkSummary[] | null>;
  listPresets(): Promise<SearchPreset[]>;
  createPreset(input: SearchPresetCreate): Promise<SearchPreset>;
  deletePreset(id: number): Promise<boolean>;

  // 物理ファイルシステム（Filesモード）
  /** path 省略時はルートフォルダー。ルート配下でない・存在しない場合は null */
  browseFs(path?: string): Promise<FsListing | null>;

  // メディア・DLsite
  /** 実体が無い（fixture 等）場合は null → ルートが 404 を返す。
   *  width は kind === "cover" のときのみ意味を持つ（サムネイル幅、既に許可値へ正規化済み）。
   *  fixture 等ラスタライズ元を持たないアダプタは無視してよい */
  locateMedia(
    kind: MediaKind,
    workId: string,
    relPath?: string,
    width?: number,
  ): Promise<MediaLocation | null>;
  dlsiteFetch(workId: string): Promise<DlsiteWorkInfo | null>;
  dlsiteApply(workId: string, body: DlsiteApplyBody): Promise<boolean>;
}
