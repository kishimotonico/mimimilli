// 軸（AxisId）のメタデータと判定を一元管理する。
// ADR-0005 により分類軸は固定 enum ではなく「登録済み prefix そのもの」になった。
// 判定はIDの形で決まる: ビュー集合 / "tag" / "smart-*" 以外はすべてファセット軸
// （組み込みの "year" と任意の prefix 軸）。ラベル・軸レールへの表示は
// サーバーの prefix 定義（GET /tag-prefixes）から引く。

import type { TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "./types";
import type { IconName } from "../../../shared/ui/Icon";

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
  home: "ホーム",
};

export const VIEW_AXES = new Set<string>(VIEW_AXIS_IDS);

export function isViewAxis(axis: AxisId): boolean {
  return VIEW_AXES.has(axis);
}

export function isSmartAxis(axis: AxisId): boolean {
  return axis.startsWith("smart-");
}

/** ホームビュー（ADR-0012 §4）。軸の選択状態やタグ絞り込みと無関係な発見ダッシュボード */
export function isHomeAxis(axis: AxisId): boolean {
  return axis === "home";
}

/** ファセット軸 = ビュー・タグ軸・ホーム・スマート軸以外のすべて（year と任意の prefix 軸） */
export function isFacetAxis(axis: AxisId): boolean {
  return !isViewAxis(axis) && axis !== "tag" && !isHomeAxis(axis) && !isSmartAxis(axis);
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

// 初期 seed の prefix に対する見慣れたアイコン。未知の prefix は folder に落ちる
// （アイコンは prefix 定義に持たせていない表示上の便宜）
const PREFIX_ICONS: Record<string, IconName> = {
  cv: "user",
  サークル: "folder",
  シリーズ: "bookmark",
  カテゴリ: "list",
  genre: "list",
};

const BUILTIN_AXIS_ICONS: Record<string, IconName> = {
  home: "home",
  tag: "filter",
  year: "refresh",
  all: "gridS",
  recent: "refresh",
  added: "add",
  fav: "star",
  unplayed: "audio",
  missing: "err",
};

/** 軸の代表アイコン。値一覧で代表カバーが0件の値のプレースホルダーにも使う（AxisValueList）。 */
export function getAxisIcon(axis: AxisId): IconName {
  if (isSmartAxis(axis)) return "gridS";
  return BUILTIN_AXIS_ICONS[axis] ?? PREFIX_ICONS[axis] ?? "folder";
}

export interface FacetAxisRow {
  id: AxisId;
  name: string;
  icon: IconName;
}

/** 分類軸の行 = 軸表示ONの prefix 定義（定義順）＋ 組み込みの tag / year（ADR-0005）。
 *  軸レール（AxisColumn）と「＋絞り込み」の軸選択ステージ（TASK-182、FilterChipAddButton）
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
