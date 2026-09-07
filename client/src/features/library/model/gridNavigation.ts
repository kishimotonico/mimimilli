import type { JustifiedTile } from "./justifiedLayout";

export type GridArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

export function getNextGridIndex(
  currentIndex: number,
  key: GridArrowKey,
  columnCount: number,
  itemCount: number,
): number {
  if (itemCount <= 0 || columnCount <= 0) return currentIndex;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;

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

  if (key === "Home") return 0;
  if (key === "End") return tiles.length - 1;
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

// 仮想化された行インデックス（virtualizerが実際にDOMへ描画する単位）とフラットな
// タイル/行のインデックスを相互変換する。roving tabindexの対象（選択中の作品）が
// 現在の描画範囲内にあるかどうかを判定するために使う（TASK-428.12）。
// ジャスティファイドでflatIndexに対応するタイルが無い（範囲外）ときはundefinedを
// 返す。フォールバックするか無視するかは呼び出し側の文脈で異なるため、ここでは
// 判断しない（例: キーボード操作は無視、rovingIndexの解決は行0へフォールバック）。
export function rowIndexOfFlatIndex(
  flatIndex: number,
  isJustified: boolean,
  justifiedTiles: readonly Pick<JustifiedTile, "rowIndex">[] | null,
  columnCount: number,
): number | undefined {
  if (isJustified && justifiedTiles) return justifiedTiles[flatIndex]?.rowIndex;
  return Math.floor(flatIndex / Math.max(columnCount, 1));
}

export function firstFlatIndexOfRow(
  rowIndex: number,
  isJustified: boolean,
  justifiedTiles: readonly Pick<JustifiedTile, "rowIndex">[] | null,
  columnCount: number,
): number {
  if (isJustified && justifiedTiles) {
    const found = justifiedTiles.findIndex((tile) => tile.rowIndex === rowIndex);
    return found === -1 ? 0 : found;
  }
  return rowIndex * Math.max(columnCount, 1);
}
