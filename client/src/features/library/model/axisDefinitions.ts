// 軸（AxisId）のメタデータを一元管理する。
// ラベル・ファセット軸/ビュー軸の判定は、以前は atoms.ts / ContentColumn.tsx / DrillHeader.tsx /
// axisLandingPresentation.ts に別々の Record として重複定義されていた。ここに集約し、各所から参照する。

import type { AxisId } from "./types";

export type AxisKind = "view" | "facet" | "tag" | "smart";

interface AxisDefinition {
  label: string;
  kind: AxisKind;
}

// 軸レールの単純ビュー（GET /works の view パラメータに対応）
const VIEW_AXIS_IDS = ["all", "recent", "added", "fav", "unplayed", "missing"] as const;
// ファセット集計の対象となる分類軸（GET /axes/:axis に対応。tag は別 UI のため含めない）
const FACET_AXIS_IDS = ["circle", "cv", "series", "cat", "year"] as const;

const AXIS_DEFINITIONS: Record<string, AxisDefinition> = {
  all: { label: "すべての作品", kind: "view" },
  recent: { label: "最近再生", kind: "view" },
  added: { label: "最近追加", kind: "view" },
  fav: { label: "お気に入り", kind: "view" },
  unplayed: { label: "未再生", kind: "view" },
  missing: { label: "ファイル欠損", kind: "view" },
  circle: { label: "サークル", kind: "facet" },
  cv: { label: "CV", kind: "facet" },
  series: { label: "シリーズ", kind: "facet" },
  cat: { label: "カテゴリ", kind: "facet" },
  year: { label: "追加日", kind: "facet" },
  tag: { label: "タグ", kind: "tag" },
};

export const VIEW_AXES = new Set<string>(VIEW_AXIS_IDS);
export const FACET_AXES = new Set<string>(FACET_AXIS_IDS);

export function isViewAxis(axis: AxisId): boolean {
  return VIEW_AXES.has(axis as string);
}

export function isFacetAxis(axis: AxisId): boolean {
  return FACET_AXES.has(axis as string);
}

export function isSmartAxis(axis: AxisId): boolean {
  return (axis as string).startsWith("smart-");
}

/** スマートフォルダー軸の ID から `smart-` プレフィックスを外す */
export function getSmartFolderId(axis: AxisId): string {
  return (axis as string).slice("smart-".length);
}

/** 軸の表示ラベル。未知の軸はスマートフォルダーとして扱うか、ID をそのまま返す */
export function getAxisLabel(axis: AxisId): string {
  if (isSmartAxis(axis)) return "スマートフォルダー";
  return AXIS_DEFINITIONS[axis as string]?.label ?? (axis as string);
}
