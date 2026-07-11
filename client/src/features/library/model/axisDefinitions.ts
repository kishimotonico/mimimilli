// 軸（AxisId）のメタデータと判定を一元管理する。
// ADR-0005 により分類軸は固定 enum ではなく「登録済み prefix そのもの」になった。
// 判定はIDの形で決まる: ビュー集合 / "tag" / "smart-*" 以外はすべてファセット軸
// （組み込みの "year" と任意の prefix 軸）。ラベル・軸レールへの表示は
// サーバーの prefix 定義（GET /tag-prefixes）から引く。

import type { TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "./types";

// 軸レールの単純ビュー（GET /works の view パラメータに対応）
const VIEW_AXIS_IDS = ["all", "recent", "added", "fav", "unplayed", "missing"] as const;

const VIEW_AXIS_LABELS: Record<string, string> = {
  all: "すべての作品",
  recent: "最近再生",
  added: "最近追加",
  fav: "お気に入り",
  unplayed: "未再生",
  missing: "ファイル欠損",
};

// prefix 定義に紐づかない組み込み軸のラベル
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

/** ファセット軸 = ビュー・タグ軸・スマート軸以外のすべて（year と任意の prefix 軸） */
export function isFacetAxis(axis: AxisId): boolean {
  return !isViewAxis(axis) && axis !== "tag" && !isSmartAxis(axis);
}

/** スマートフォルダー軸の ID から `smart-` プレフィックスを外す */
export function getSmartFolderId(axis: AxisId): string {
  return axis.slice("smart-".length);
}

/** 軸の表示ラベル。prefix 軸は定義の label、未登録 prefix は ID をそのまま返す */
export function getAxisLabel(axis: AxisId, tagPrefixes: TagPrefix[] = []): string {
  if (isSmartAxis(axis)) return "スマートフォルダー";
  const builtin = VIEW_AXIS_LABELS[axis] ?? BUILTIN_AXIS_LABELS[axis];
  if (builtin) return builtin;
  return tagPrefixes.find((p) => p.prefix === axis)?.label ?? axis;
}
