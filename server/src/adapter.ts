// データアダプタ境界（ADR-0002）。
// ルーター・ドメインロジックは1系統だけ持ち、データの出どころをこのインターフェースで差し替える:
//   - fixture アダプタ: インメモリ fixtures（開発・ビジュアルテスト用）
//   - real アダプタ:    SQLite + 実ファイルシステム（移行プラン ステップ3で実装）
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
  Work,
  WorkPatch,
  WorksPage,
  WorksQuery,
  WorkSummary,
} from "@mimikago/shared";

/** メディア実体の所在。ルートがストリーミング（Range 対応）を担当する */
export interface MediaLocation {
  absolutePath: string;
  mime: string;
}

export type MediaKind = "cover" | "audio" | "file";

export interface DataAdapter {
  // 設定・スキャン
  getSettings(): Promise<Settings>;
  updateSettings(patch: SettingsUpdate): Promise<Settings>;
  scan(): Promise<ScanResult>;

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

  // 分類軸・スマートフォルダー・プリセット
  getAxisFacets(axis: FacetAxis): Promise<AxisFacetItem[]>;
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
  /** 実体が無い（fixture 等）場合は null → ルートが 404 を返す */
  locateMedia(kind: MediaKind, workId: string, relPath?: string): Promise<MediaLocation | null>;
  dlsiteFetch(workId: string): Promise<DlsiteWorkInfo | null>;
  dlsiteApply(workId: string, body: DlsiteApplyBody): Promise<boolean>;
}
