import type { GroupBy } from "@mimimilli/shared";

/** グループ分けを一意に表す文字列。クエリキーと選択肢の値に使う。グループ分け無しは空文字 */
export type GroupByKey = string;

export function groupByKey(groupBy: GroupBy | null): GroupByKey {
  if (groupBy === null) return "";
  return groupBy.kind === "prefix" ? `prefix:${groupBy.prefix}` : groupBy.kind;
}

export function groupByFromKey(key: GroupByKey): GroupBy | null {
  if (key === "") return null;
  if (key === "tag") return { kind: "tag" };
  if (key === "addedYear") return { kind: "addedYear" };
  return { kind: "prefix", prefix: key.slice("prefix:".length) };
}
