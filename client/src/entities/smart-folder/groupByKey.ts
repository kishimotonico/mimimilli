import { groupByKey as sharedGroupByKey, parseGroupByKey, type GroupBy } from "@mimimilli/shared";

/** グループ分けを一意に表す文字列。クエリキーと選択肢の値に使う。グループ分け無しは空文字 */
export type GroupByKey = string;

export function groupByKey(groupBy: GroupBy | null): GroupByKey {
  return groupBy === null ? "" : sharedGroupByKey(groupBy);
}

export function groupByFromKey(key: GroupByKey): GroupBy | null {
  return key === "" ? null : parseGroupByKey(key);
}
