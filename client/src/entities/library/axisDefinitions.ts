// 軸（AxisId）のメタデータと判定を一元管理する。
// ADR-0005 により分類軸は固定 enum ではなく「登録済み prefix そのもの」になった。
// 判定はIDの形で決まる: ビュー集合 / "tag" / "smart-*" 以外はすべてファセット軸
// （組み込みの "year" と任意の prefix 軸）。ラベル・軸レールへの表示は
// サーバーの prefix 定義（GET /tag-prefixes）から引く。

import type { TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "./types";
import type { IconName } from "../../shared/ui/Icon";

// 軸レールの単純ビュー（GET /works の view パラメータに対応）
const VIEW_AXIS_IDS = ["all", "recent", "added", "fav", "error"] as const;

const VIEW_AXIS_LABELS: Record<string, string> = {
  all: "すべての作品",
  recent: "最近再生",
  added: "最近追加",
  fav: "お気に入り",
  error: "エラー",
};

const BUILTIN_AXIS_LABELS: Record<string, string> = {
  tag: "タグ",
  year: "追加日",
};

export const VIEW_AXES = new Set<string>(VIEW_AXIS_IDS);

export function isViewAxis(axis: AxisId): boolean {
  return VIEW_AXES.has(axis);
}

export function isSmartAxis(axis: AxisId): boolean {
  return axis.startsWith("smart-");
}

export function isFacetAxis(axis: AxisId): boolean {
  return !isViewAxis(axis) && axis !== "tag" && !isSmartAxis(axis);
}

export function getSmartFolderId(axis: AxisId): string {
  return axis.slice("smart-".length);
}

export function getAxisLabel(axis: AxisId, tagPrefixes: TagPrefix[] = []): string {
  if (isSmartAxis(axis)) return "スマートフォルダー";
  const builtin = VIEW_AXIS_LABELS[axis] ?? BUILTIN_AXIS_LABELS[axis];
  if (builtin) return builtin;
  return tagPrefixes.find((p) => p.prefix === axis)?.label ?? axis;
}

const PREFIX_ICONS: Record<string, IconName> = {
  cv: "user",
  サークル: "folder",
  シリーズ: "bookmark",
  カテゴリ: "list",
  genre: "list",
};

const BUILTIN_AXIS_ICONS: Record<string, IconName> = {
  tag: "filter",
  year: "refresh",
  all: "gridS",
  recent: "refresh",
  added: "add",
  fav: "star",
  error: "err",
};

export function getAxisIcon(axis: AxisId): IconName {
  if (isSmartAxis(axis)) return "gridS";
  return BUILTIN_AXIS_ICONS[axis] ?? PREFIX_ICONS[axis] ?? "folder";
}

export interface FacetAxisRow {
  id: AxisId;
  name: string;
  icon: IconName;
}

export interface ViewAxisRow {
  id: AxisId;
  name: string;
  icon: IconName;
}

/** ビュー軸の行。軸レール（AxisColumn）のビューグループが使う。 */
export function buildViewAxisRows(): ViewAxisRow[] {
  return VIEW_AXIS_IDS.map((id) => ({
    id,
    name: VIEW_AXIS_LABELS[id] ?? id,
    icon: getAxisIcon(id),
  }));
}

/** 分類軸の行 = 軸表示ONの prefix 定義（定義順）＋ 組み込みの tag / year（ADR-0005）。
 *  軸レール（AxisColumn）と「＋絞り込み」の軸選択ステージ（FilterChipAddButton）
 *  が共有する。 */
export function buildFacetAxisRows(tagPrefixes: TagPrefix[]): FacetAxisRow[] {
  const prefixRows = tagPrefixes
    .filter((p) => p.showAsAxis)
    .map((p) => ({ id: p.prefix, name: p.label, icon: getAxisIcon(p.prefix) }));
  return [
    ...prefixRows,
    { id: "tag", name: "タグ", icon: getAxisIcon("tag") },
    { id: "year", name: "追加日", icon: getAxisIcon("year") },
  ];
}
