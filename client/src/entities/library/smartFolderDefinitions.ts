// グループ分け（GroupBy）のラベル・アイコン、スマートフォルダーのアイコン。
// ラベルは tag_prefixes の定義から引く（ADR-0005）。

import { resolveTagPrefix, type GroupBy, type TagPrefix } from "@mimimilli/shared";
import type { IconName } from "../../shared/ui/Icon";

export function getGroupByLabel(groupBy: GroupBy, tagPrefixes: TagPrefix[] = []): string {
  switch (groupBy.kind) {
    case "tag":
      return "タグ";
    case "addedYear":
      return "追加年";
    case "prefix":
      return resolveTagPrefix(groupBy.prefix, tagPrefixes).label;
  }
}

const PREFIX_ICONS: Record<string, IconName> = {
  cv: "user",
  サークル: "house",
  シリーズ: "series",
  カテゴリ: "steps",
};

/** グループ分けのアイコン。値一覧・サイドバーの行・「＋絞り込み」で共通 */
export function getGroupByIcon(groupBy: GroupBy): IconName {
  switch (groupBy.kind) {
    case "tag":
      return "tag";
    case "addedYear":
      return "calendar";
    case "prefix":
      return PREFIX_ICONS[groupBy.prefix] ?? "folder";
  }
}

const CONDITION_FOLDER_ICONS: Record<string, IconName> = {
  all: "grid",
  random: "shuffle",
  recent: "clock",
  added: "add",
  fav: "star",
  error: "err",
};

/** 既定の条件のフォルダーは ID から、グループ分けのあるフォルダーはそのグループ分けから引く */
export function getSmartFolderIcon(folder: { id: string; groupBy: GroupBy | null }): IconName {
  if (folder.groupBy !== null) return getGroupByIcon(folder.groupBy);
  return CONDITION_FOLDER_ICONS[folder.id] ?? "funnel";
}

export interface GroupByRow {
  groupBy: GroupBy;
  name: string;
}

/** 「＋絞り込み」のグループ分け選択の行 = prefix 定義（定義順）＋ 組み込みの tag / addedYear（ADR-0005） */
export function buildGroupByRows(tagPrefixes: TagPrefix[]): GroupByRow[] {
  const groupBys: GroupBy[] = [
    ...tagPrefixes.map((p): GroupBy => ({ kind: "prefix", prefix: p.prefix })),
    { kind: "tag" },
    { kind: "addedYear" },
  ];
  return groupBys.map((groupBy) => ({ groupBy, name: getGroupByLabel(groupBy, tagPrefixes) }));
}
