// グループ分け（GroupBy）のラベル・アイコン、スマートフォルダーのアイコン。
// ラベルは tag_prefixes の定義から引く（ADR-0005）。

import { resolveTagPrefix, type GroupBy, type TagPrefix } from "@mimimilli/shared";
import type { IconName } from "../../shared/ui/Icon";

export function getGroupByLabel(groupBy: GroupBy, tagPrefixes: TagPrefix[] = []): string {
  switch (groupBy.kind) {
    case "tag":
      return "タグ";
    case "addedYear":
      return "追加日";
    case "prefix":
      return resolveTagPrefix(groupBy.prefix, tagPrefixes).label;
  }
}

const PREFIX_ICONS: Record<string, IconName> = {
  cv: "user",
  サークル: "folder",
  シリーズ: "bookmark",
  カテゴリ: "list",
  genre: "list",
};

export function getGroupByIcon(groupBy: GroupBy): IconName {
  switch (groupBy.kind) {
    case "tag":
      return "filter";
    case "addedYear":
      return "refresh";
    case "prefix":
      return PREFIX_ICONS[groupBy.prefix] ?? "folder";
  }
}

const SMART_FOLDER_ICONS: Record<string, IconName> = {
  all: "grid",
  random: "shuffle",
  recent: "clock",
  added: "add",
  fav: "star",
  error: "err",
  "by-cv": "user",
  "by-circle": "house",
  "by-series": "series",
  "by-category": "steps",
  "by-tag": "tag",
  "by-year": "calendar",
};

export function getSmartFolderIcon(id: string): IconName {
  return SMART_FOLDER_ICONS[id] ?? "funnel";
}

export interface GroupByRow {
  groupBy: GroupBy;
  name: string;
  icon: IconName;
}

/** 「＋絞り込み」のグループ分け選択の行 = prefix 定義（定義順）＋ 組み込みの tag / addedYear（ADR-0005） */
export function buildGroupByRows(tagPrefixes: TagPrefix[]): GroupByRow[] {
  const prefixRows = tagPrefixes.map((p): GroupByRow => {
    const groupBy: GroupBy = { kind: "prefix", prefix: p.prefix };
    return { groupBy, name: p.label, icon: getGroupByIcon(groupBy) };
  });
  return [
    ...prefixRows,
    { groupBy: { kind: "tag" }, name: "タグ", icon: getGroupByIcon({ kind: "tag" }) },
    { groupBy: { kind: "addedYear" }, name: "追加日", icon: getGroupByIcon({ kind: "addedYear" }) },
  ];
}
