// 入れ子タグ（スラッシュ複数のタグ）の階層表現（ADR-0012 §5）。名前順のときだけ
// インデント＋葉ラベルの木構造として並べ、それ以外の並びではフルパスの平坦表示にする。
// 各階層の順は、サーバーが並べた順に子が最初に現れた順（client では並べ直さない）。中間ノードは実際にタグとして存在する（groupValueItems に value として
// 現れる）場合だけ選択可能な値行になり、それ以外は選択不可の見出し行になる
// （完全一致セマンティクス ADR-0005 §6 と衝突する「配下を含む絞り込み」は作らない）。

import type { GroupValueItem } from "@mimimilli/shared";

export interface GroupValueHeadingRow {
  kind: "heading";
  depth: number;
  /** 見出しまでのフルパス（子ノードの構築キーにのみ使う） */
  path: string;
  label: string;
}

export interface GroupValueValueRow {
  kind: "value";
  depth: number;
  path: string;
  label: string;
  item: GroupValueItem;
}

export type GroupValueHierarchyRow = GroupValueHeadingRow | GroupValueValueRow;

interface TreeNode {
  label: string;
  path: string;
  item: GroupValueItem | null;
  children: Map<string, TreeNode>;
}

function getOrCreateChild(parent: TreeNode, segment: string, path: string): TreeNode {
  const existing = parent.children.get(segment);
  if (existing) return existing;
  const created: TreeNode = { label: segment, path, item: null, children: new Map() };
  parent.children.set(segment, created);
  return created;
}

/** 名前順用の階層構造を構築する。各階層の子は、items の順で最初に現れた順に並べる。 */
export function buildGroupValueHierarchy(items: GroupValueItem[]): GroupValueHierarchyRow[] {
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

  const rows: GroupValueHierarchyRow[] = [];

  const visit = (node: TreeNode, depth: number) => {
    for (const child of node.children.values()) {
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
export function flattenGroupValueRows(items: GroupValueItem[]): GroupValueHierarchyRow[] {
  return items.map((item) => ({
    kind: "value",
    depth: 0,
    path: item.value,
    label: item.value,
    item,
  }));
}
