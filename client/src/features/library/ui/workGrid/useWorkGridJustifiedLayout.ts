import { useCallback, useMemo } from "react";
import type { WorkListItem } from "@mimimilli/shared";
import { GRID_COLUMN_GAP, GRID_TILE_CHROME_HEIGHT } from "../../model/gridSizing";
import { computeJustifiedLayout, type JustifiedLayout } from "../../model/justifiedLayout";
import type { VirtualGridJustifiedLayout } from "../../../../shared/ui/useVirtualGrid";
import { groupJustifiedRows, isJustifiedLayoutRevision } from "./justifiedRows";

interface UseWorkGridJustifiedOptionsInput {
  works: WorkListItem[];
  isJustified: boolean;
  safeTileSize: number;
}

export function useWorkGridJustifiedOptions({
  works,
  isJustified,
  safeTileSize,
}: UseWorkGridJustifiedOptionsInput) {
  const getJustifiedLayout = useCallback(
    (containerWidth: number) => {
      if (!isJustified || containerWidth <= 0 || works.length === 0) return null;
      const layout = computeJustifiedLayout(
        works.map((work) => ({
          id: work.id,
          aspectRatio: work.cover ? work.cover.dimensions.width / work.cover.dimensions.height : 1,
        })),
        {
          containerWidth,
          targetRowHeight: safeTileSize,
          gap: GRID_COLUMN_GAP,
        },
      );
      const rowCount = layout.rowHeights.length;
      return {
        rowCount,
        estimateRowSize: (index: number) =>
          (layout.rowHeights[index] ?? 0) + GRID_TILE_CHROME_HEIGHT,
        measureElement: (element: HTMLDivElement) =>
          (layout.rowHeights[Number(element.getAttribute("data-index"))] ?? 0) +
          GRID_TILE_CHROME_HEIGHT,
        layoutRevision: layout,
      };
    },
    [isJustified, works, safeTileSize],
  );

  return useMemo(
    () => (isJustified ? { getLayout: getJustifiedLayout } : undefined),
    [isJustified, getJustifiedLayout],
  );
}

interface UseWorkGridJustifiedRowsInput {
  works: WorkListItem[];
  isJustified: boolean;
  justifiedVirtualLayout: VirtualGridJustifiedLayout | null;
}

export function useWorkGridJustifiedRows({
  works,
  isJustified,
  justifiedVirtualLayout,
}: UseWorkGridJustifiedRowsInput) {
  const justifiedLayout: JustifiedLayout | null =
    isJustified &&
    justifiedVirtualLayout &&
    isJustifiedLayoutRevision(justifiedVirtualLayout.layoutRevision)
      ? justifiedVirtualLayout.layoutRevision
      : null;

  const justifiedRows = useMemo(
    () => (justifiedLayout ? groupJustifiedRows(works, justifiedLayout) : []),
    [justifiedLayout, works],
  );

  return { justifiedLayout, justifiedRows };
}
