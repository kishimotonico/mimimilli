/**
 * 後方互換バレル — Phase 1 で型を各 feature / entity へ分散させた。
 * 既存の import（src/components, src/hooks, src/test など）はここを向いたままでよく、
 * 各ファイルが Phase 2-4 で feature 配下へ移動する際に import を追従させる。
 *
 * 新規コードはここではなく以下を直接 import すること:
 *   entities/work/model     — Work, WorkSummary, Track, Playlist, UrlEntry, FileEntry, DlsiteWorkInfo, parseTag, ParsedTag
 *   features/library/model/types — SortId, SORT_OPTIONS, ViewMode, GridSize, GRID_SIZES, GRID_SIZE_KEYS,
 *                                  LibraryViewAxisId, AxisId, AXIS_TAG_PREFIX, AxisFacetItem, SmartFolder, SearchPreset
 *   features/scan/model     — ScanResult
 *   features/settings/model — Settings
 */

export type {
  UrlEntry,
  Track,
  Playlist,
  Work,
  WorkSummary,
  FileEntry,
  DlsiteWorkInfo,
  ParsedTag,
} from "./entities/work/model";
export { parseTag } from "./entities/work/model";

export type { ScanResult } from "./features/scan/model";

export type {
  SortId,
  ViewMode,
  GridSize,
  LibraryViewAxisId,
  AxisId,
  AxisFacetItem,
  SmartFolderRule,
  SmartFolder,
  SearchPreset,
} from "./features/library/model/types";
export {
  SORT_OPTIONS,
  GRID_SIZES,
  GRID_SIZE_KEYS,
  AXIS_TAG_PREFIX,
} from "./features/library/model/types";

export type { Settings } from "./features/settings/model";
