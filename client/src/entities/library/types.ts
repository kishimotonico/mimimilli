export type { SortId, AxisFacetItem, SmartFolder } from "@mimimilli/shared";
import type { SortId } from "@mimimilli/shared";

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

export type ViewMode = "list" | "grid";

export type GridLayoutMode = "square" | "justified";

export type AxisId = string;
