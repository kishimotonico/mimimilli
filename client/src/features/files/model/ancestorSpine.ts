/** 折り畳み帯（背表紙）1枚として表示する祖先。index は addressPath 上の実インデックス
 *  （goToSegment にそのまま渡せる）。isNearest は現在地に最も近い1枚（パルス対象）。 */
export interface AncestorSpineSegment {
  kind: "segment";
  index: number;
  name: string;
  isNearest: boolean;
}

/** 表示上限を超えた中間祖先をまとめて畳んだ1枚。クリックで一覧メニューを開く。 */
export interface AncestorSpineEllipsis {
  kind: "ellipsis";
  collapsed: { index: number; name: string }[];
}

export type AncestorSpineSlot = AncestorSpineSegment | AncestorSpineEllipsis;

const MAX_VISIBLE_SPINES = 3;

/** addressPath（[root, ...relPath]、末尾が現在地）から、背表紙に並べる
 *  root〜現在地の親までのセグメントを取り出す。 */
export function buildAncestorSegments(addressPath: string[]): string[] {
  return addressPath.slice(0, -1);
}

/** 表示上限（3枚程度）を超える場合、先頭と直近を残し中間を1枚の省略スロットへ畳む。 */
export function buildAncestorSpineSlots(segments: string[]): AncestorSpineSlot[] {
  if (segments.length === 0) return [];
  if (segments.length <= MAX_VISIBLE_SPINES) {
    return segments.map((name, index) => ({
      kind: "segment",
      index,
      name,
      isNearest: index === segments.length - 1,
    }));
  }
  // ここに来る時点で segments.length > MAX_VISIBLE_SPINES（3）が保証されているため、
  // 先頭・直近の要素は必ず存在する。
  const lastIndex = segments.length - 1;
  const collapsed = segments.slice(1, -1).map((name, i) => ({ index: i + 1, name }));
  return [
    { kind: "segment", index: 0, name: segments[0]!, isNearest: false },
    { kind: "ellipsis", collapsed },
    { kind: "segment", index: lastIndex, name: segments[lastIndex]!, isNearest: true },
  ];
}
