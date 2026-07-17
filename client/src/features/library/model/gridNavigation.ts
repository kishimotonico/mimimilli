import type { JustifiedTile } from "./justifiedLayout";

export type GridArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

export function countGridColumns(rowOffsets: readonly number[]): number {
  if (rowOffsets.length === 0) return 0;

  const firstRowOffset = rowOffsets[0];
  const nextRowIndex = rowOffsets.findIndex((offset) => offset !== firstRowOffset);
  return nextRowIndex === -1 ? rowOffsets.length : nextRowIndex;
}

export function getNextGridIndex(
  currentIndex: number,
  key: GridArrowKey,
  columnCount: number,
  itemCount: number,
): number {
  if (itemCount <= 0 || columnCount <= 0) return currentIndex;

  const delta =
    key === "ArrowLeft"
      ? -1
      : key === "ArrowRight"
        ? 1
        : key === "ArrowUp"
          ? -columnCount
          : columnCount;

  const nextIndex = currentIndex + delta;
  return nextIndex < 0 || nextIndex >= itemCount ? currentIndex : nextIndex;
}

// ジャスティファイドグリッド用のキーボードナビ（TASK-45）。
// 行ごとのアイテム数が不揃いなため、getNextGridIndex の「固定列数ぶんインデックスを
// ずらす」方式は使えない。代わりに justifiedLayout.ts が計算した各タイルの行内
// 中心x座標（centerX）を使い、上下移動では「隣接する行の中で横位置が最も近い
// タイル」を選ぶ（DOM計測不要・純粋関数）。左右移動は表示順（=入力順）で±1。
export function getNextJustifiedIndex(
  tiles: readonly Pick<JustifiedTile, "rowIndex" | "centerX">[],
  currentIndex: number,
  key: GridArrowKey,
): number {
  const current = tiles[currentIndex];
  if (!current) return currentIndex;

  if (key === "ArrowLeft") return Math.max(0, currentIndex - 1);
  if (key === "ArrowRight") return Math.min(tiles.length - 1, currentIndex + 1);

  const targetRow = key === "ArrowUp" ? current.rowIndex - 1 : current.rowIndex + 1;
  let bestIndex = -1;
  let bestDistance = Infinity;
  tiles.forEach((tile, index) => {
    if (tile.rowIndex !== targetRow) return;
    const distance = Math.abs(tile.centerX - current.centerX);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex === -1 ? currentIndex : bestIndex;
}
