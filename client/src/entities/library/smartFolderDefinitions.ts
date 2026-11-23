// グループ分け（GroupBy）のラベル・アイコン、スマートフォルダーのアイコン。
// ラベルは tag_prefixes の定義から引く（ADR-0005）。

import {
  isEmptyCondition,
  resolveTagPrefix,
  singlePredicateType,
  type GroupBy,
  type PredicateType,
  type SmartFolder,
  type TagPrefix,
} from "@mimimilli/shared";
import type { IconName } from "../../shared/ui/Icon";

export function getGroupByLabel(groupBy: GroupBy, tagPrefixes: readonly TagPrefix[] = []): string {
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

const PREDICATE_FOLDER_ICONS: Partial<Record<PredicateType, IconName>> = {
  bookmarked: "star",
  hasError: "err",
  played: "clock",
  added: "add",
};

type IconSubject = Pick<SmartFolder, "condition" | "sort" | "groupBy">;

/** グループ分けのあるフォルダーはそのグループ分けから、ないものは条件の形から引く。条件が空なら「すべて」と同じで、並びがランダムのときだけランダム */
export function getSmartFolderIcon(folder: IconSubject): IconName {
  if (folder.groupBy !== null) return getGroupByIcon(folder.groupBy);
  if (isEmptyCondition(folder.condition)) return folder.sort === "random" ? "shuffle" : "grid";
  const type = singlePredicateType(folder.condition);
  return (type && PREDICATE_FOLDER_ICONS[type]) ?? "funnel";
}

export interface GroupByRow {
  groupBy: GroupBy;
  name: string;
}

/** 「＋絞り込み」のグループ分け選択の行 = prefix 定義（定義順。今のグループ分けが定義に無ければそれも）＋ 組み込みの tag / addedYear（ADR-0005） */
export function buildGroupByRows(
  tagPrefixes: readonly TagPrefix[],
  current: GroupBy | null = null,
): GroupByRow[] {
  const prefixes = tagPrefixes.map((p) => p.prefix);
  if (current?.kind === "prefix" && !prefixes.includes(current.prefix)) {
    prefixes.push(current.prefix);
  }
  const groupBys: GroupBy[] = [
    ...prefixes.map((prefix): GroupBy => ({ kind: "prefix", prefix })),
    { kind: "tag" },
    { kind: "addedYear" },
  ];
  return groupBys.map((groupBy) => ({ groupBy, name: getGroupByLabel(groupBy, tagPrefixes) }));
}
