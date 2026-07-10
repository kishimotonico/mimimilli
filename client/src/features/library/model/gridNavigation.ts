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
