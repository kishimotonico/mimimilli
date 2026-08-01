// タグ軸（axis === "tag"）の一覧を prefix ごとにグルーピングする（ADR-0005 追記）。
// buildAxisFacets が flat・annotated 双方を返すようになったため、表示側で
// prefix グループ見出し（TagPrefix の label/color）を付けて整理する。
import type { AxisFacetItem, TagPrefix, TagPrefixColorKey } from "@mimimilli/shared";
import { parseTag } from "@mimimilli/shared";

export interface TagAxisGroup {
  /** グループキー。フラットタグ（prefix なし）は "" */
  key: string;
  label: string;
  color: TagPrefixColorKey | null;
  items: AxisFacetItem[];
}

const FLAT_GROUP_LABEL = "タグ";

/** facetItems（tag 軸）を prefix でグルーピングする。
 *  順序: フラットタグ → 登録済み prefix（定義順）→ 未登録 prefix（出現順）。
 *  各グループ内の順序は facetItems の並び（count 降順）を保つ */
export function groupTagFacetItems(
  facetItems: AxisFacetItem[],
  tagPrefixes: TagPrefix[],
): TagAxisGroup[] {
  const byKey = new Map<string, AxisFacetItem[]>();
  for (const item of facetItems) {
    const parsed = parseTag(item.value);
    const key = parsed.kind === "flat" ? "" : parsed.prefix;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(item);
    else byKey.set(key, [item]);
  }

  const groups: TagAxisGroup[] = [];

  const flatItems = byKey.get("");
  byKey.delete("");
  if (flatItems && flatItems.length > 0) {
    groups.push({ key: "", label: FLAT_GROUP_LABEL, color: null, items: flatItems });
  }

  for (const prefix of tagPrefixes) {
    const items = byKey.get(prefix.prefix);
    if (!items || items.length === 0) continue;
    byKey.delete(prefix.prefix);
    groups.push({ key: prefix.prefix, label: prefix.label, color: prefix.color, items });
  }

  // 未登録 prefix（設定に無いがデータには存在する）はラベルを prefix そのままにして末尾へ
  for (const [key, items] of byKey) {
    groups.push({ key, label: key, color: null, items });
  }

  return groups;
}
