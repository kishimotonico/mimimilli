// library feature のドメイン型。
// API 契約に属する型（SortId, AxisFacetItem, SmartFolder, SearchPreset）は
// @mimimilli/shared を正典として re-export する。
// Work / WorkSummary など work entity の型は entities/work/model から import する。

export type { SortId, AxisFacetItem, SmartFolder, SearchPreset } from "@mimimilli/shared";
import type { SortId } from "@mimimilli/shared";

// ── ソート ───────────────────────────────────────────────────

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

export type ViewMode = "list" | "grid";

// ── 軸 ───────────────────────────────────────────────────────

export type LibraryViewAxisId =
  | "all"
  | "recent"
  | "added"
  | "fav"
  | "unplayed"
  | "missing"
  | "circle"
  | "cv"
  | "series"
  | "cat"
  | "tag"
  | "year";

export type AxisId = LibraryViewAxisId | `smart-${string}`;
