export interface UrlEntry {
  label: string;
  url: string;
}

export interface Track {
  title: string;
  file: string;
  start?: number;
  end?: number;
}

export interface Playlist {
  name: string;
  tracks: Track[];
}

export interface Work {
  id: string;
  title: string;
  coverImage: string | null;
  defaultPlaylist: string | null;
  createdAt: string | null;
  status: string;
  physicalPath: string;
  totalDurationSec: number;
  addedAt: string;
  errorMessage: string | null;
  urls: UrlEntry[];
  tags: string[];
  playlists: Playlist[];
  bookmarked: boolean;
  lastPlayedAt: string | null;
  resumePosition: number;
  resumeTrackIndex: number;
}

export interface WorkSummary {
  id: string;
  title: string;
  coverImage: string | null;
  status: string;
  physicalPath: string;
  totalDurationSec: number;
  addedAt: string;
  errorMessage: string | null;
  urls: UrlEntry[];
  tags: string[];
  trackCount: number;
  bookmarked: boolean;
  lastPlayedAt: string | null;
}

export interface ScanResult {
  registered: number;
  newlyGenerated: number;
  errors: number;
  missing: number;
  newWorkIds: string[];
}

export interface SearchPreset {
  id: number;
  name: string;
  query: string;
  tagFilters: string[];
  sortId: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  fileType: string;
  children: FileEntry[];
}

export interface DlsiteWorkInfo {
  rjCode: string;
  title: string;
  circle: string | null;
  cvs: string[];
  genreTags: string[];
  coverUrl: string | null;
  url: string;
}

export type SortId =
  | "added-desc"
  | "added-asc"
  | "title-asc"
  | "title-desc"
  | "duration-desc"
  | "duration-asc"
  | "last-played"
  | "random"
  | "id-asc";

// ── Library mode types ────────────────────────────────────────

export interface AxisFacetItem {
  value: string;
  count: number;
}

export interface SmartFolderRule {
  conjunction: "WHERE" | "AND" | "AND NOT";
  field: string;
  operator: string;
  values: string[];
}

export interface SmartFolder {
  id: string;
  name: string;
  rules: SmartFolderRule[];
  sort: string;
  createdAt: string;
}

export type LibraryViewAxisId =
  | "all" | "recent" | "added" | "fav" | "unplayed" | "missing"
  | "circle" | "cv" | "series" | "cat" | "tag" | "year";

export type AxisId = LibraryViewAxisId | `smart-${string}`;

/** Parse a tag string ("cv/水瀬なずな" or "サークル/夜想曲" or flat "バイノーラル") */
export interface ParsedTag {
  kind: "annotated" | "flat";
  prefix: string;
  value: string;
  raw: string;
}

export function parseTag(tag: string): ParsedTag {
  const idx = tag.indexOf("/");
  if (idx > 0) {
    return { kind: "annotated", prefix: tag.slice(0, idx).toLowerCase(), value: tag.slice(idx + 1), raw: tag };
  }
  return { kind: "flat", prefix: "", value: tag, raw: tag };
}

/** Map axis id → tag prefix used for filtering */
export const AXIS_TAG_PREFIX: Partial<Record<LibraryViewAxisId, string>> = {
  circle: "サークル",
  cv:     "cv",
  series: "シリーズ",
  cat:    "カテゴリ",
};

export type ViewMode = "grid" | "table";

export type GridSize = "S" | "M" | "L" | "XL";

export const GRID_SIZES: Record<GridSize, number> = {
  S: 120,
  M: 160,
  L: 200,
  XL: 260,
};

export const GRID_SIZE_KEYS: GridSize[] = ["S", "M", "L", "XL"];

export const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: "added-desc", label: "追加日（新しい順）" },
  { id: "added-asc", label: "追加日（古い順）" },
  { id: "title-asc", label: "タイトル（A→Z）" },
  { id: "title-desc", label: "タイトル（Z→A）" },
  { id: "duration-desc", label: "再生時間（長い順）" },
  { id: "duration-asc", label: "再生時間（短い順）" },
  { id: "last-played", label: "最近再生した順" },
  { id: "random", label: "ランダム" },
  { id: "id-asc", label: "ID順" },
];
