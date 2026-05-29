// library feature のドメイン型。
// Work / WorkSummary など work entity の型は entities/work/model から import する。

// ── ソート ───────────────────────────────────────────────────

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

// ── 表示モード ───────────────────────────────────────────────

export type ViewMode = "grid" | "table";

export type GridSize = "S" | "M" | "L" | "XL";

export const GRID_SIZES: Record<GridSize, number> = {
  S: 120,
  M: 160,
  L: 200,
  XL: 260,
};

export const GRID_SIZE_KEYS: GridSize[] = ["S", "M", "L", "XL"];

// ── 軸・ファセット ────────────────────────────────────────────

export type LibraryViewAxisId =
  | "all" | "recent" | "added" | "fav" | "unplayed" | "missing"
  | "circle" | "cv" | "series" | "cat" | "tag" | "year";

export type AxisId = LibraryViewAxisId | `smart-${string}`;

/** 軸 ID → タグプレフィックスのマッピング（作品フィルタリング用） */
export const AXIS_TAG_PREFIX: Partial<Record<LibraryViewAxisId, string>> = {
  circle: "サークル",
  cv:     "cv",
  series: "シリーズ",
  cat:    "カテゴリ",
};

export interface AxisFacetItem {
  value: string;
  count: number;
}

// ── スマートフォルダー ────────────────────────────────────────

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

// ── 検索プリセット ────────────────────────────────────────────

export interface SearchPreset {
  id: number;
  name: string;
  query: string;
  tagFilters: string[];
  sortId: string;
}
