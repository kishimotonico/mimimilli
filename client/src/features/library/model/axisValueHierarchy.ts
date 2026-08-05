// 入れ子タグ（スラッシュ複数のタグ）の階層表現（ADR-0012 §5）。名前順ソートのときだけ
// インデント＋葉ラベルの木構造として並べ、件数・総時間ソートのときはフルパスの平坦表示に
// フォールバックする。中間ノードは実際にタグとして存在する（facetItems に value として
// 現れる）場合だけ選択可能な値行になり、それ以外は選択不可の見出し行になる
// （完全一致セマンティクス ADR-0005 §6 と衝突する「配下を含む絞り込み」は作らない）。

import type { AxisFacetItem } from "@mimimilli/shared";
import type { SortDirection } from "./axisValueSort";

export interface AxisValueHeadingRow {
  kind: "heading";
  depth: number;
  /** 見出しまでのフルパス（子ノードの構築キーにのみ使う） */
  path: string;
  label: string;
}

export interface AxisValueValueRow {
  kind: "value";
  depth: number;
  path: string;
  label: string;
  item: AxisFacetItem;
}

export type AxisValueHierarchyRow = AxisValueHeadingRow | AxisValueValueRow;

interface TreeNode {
  label: string;
  path: string;
  item: AxisFacetItem | null;
  children: Map<string, TreeNode>;
}

function getOrCreateChild(parent: TreeNode, segment: string, path: string): TreeNode {
  const existing = parent.children.get(segment);
  if (existing) return existing;
  const created: TreeNode = { label: segment, path, item: null, children: new Map() };
  parent.children.set(segment, created);
  return created;
}

/** 名前順ソート用の階層構造を構築する。items の順序には依存しない（各階層で並べ替える）。 */
export function buildAxisValueHierarchy(
  items: AxisFacetItem[],
  direction: SortDirection = "asc",
): AxisValueHierarchyRow[] {
  const root: TreeNode = { label: "", path: "", item: null, children: new Map() };

  for (const item of items) {
    const segments = item.value.split("/");
    let node = root;
    let path = "";
    for (const segment of segments) {
      path = path === "" ? segment : `${path}/${segment}`;
      node = getOrCreateChild(node, segment, path);
    }
    node.item = item;
  }

  const dir = direction === "asc" ? 1 : -1;
  const rows: AxisValueHierarchyRow[] = [];

  const visit = (node: TreeNode, depth: number) => {
    const children = [...node.children.values()].sort(
      (a, b) => a.label.localeCompare(b.label, "ja") * dir,
    );
    for (const child of children) {
      rows.push(
        child.item
          ? { kind: "value", depth, path: child.path, label: child.label, item: child.item }
          : { kind: "heading", depth, path: child.path, label: child.label },
      );
      visit(child, depth + 1);
    }
  };
  visit(root, 0);

  return rows;
}

/** 平坦表示（件数・総時間ソート、またはフォールバック）。全行 depth=0・kind="value"。 */
export function flattenAxisValueRows(items: AxisFacetItem[]): AxisValueHierarchyRow[] {
  return items.map((item) => ({
    kind: "value",
    depth: 0,
    path: item.value,
    label: item.value,
    item,
  }));
}
