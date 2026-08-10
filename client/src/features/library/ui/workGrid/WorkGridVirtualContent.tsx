import type { CSSProperties } from "react";
import type { WorkListItem } from "@mimimilli/shared";
import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import type { JustifiedLayout } from "../../model/justifiedLayout";
import type { GridArrowKey } from "../../model/gridNavigation";
import WorkGridRow from "../WorkGridRow";
import type { JustifiedRowGroup } from "./justifiedRows";

interface RowTileProps {
  selectedWorkId: string | null;
  playingWorkId: string | null;
  isPlaybackActive: boolean;
  safeTileSize: number;
  onWorkSelect: (id: string) => void;
  onWorkPlay: (work: WorkListItem) => void;
  onTileArrowKey: (flatIndex: number, key: GridArrowKey) => void;
}

interface WorkGridVirtualContentProps {
  isJustified: boolean;
  justifiedLayout: JustifiedLayout | null;
  justifiedRows: JustifiedRowGroup[];
  columnCount: number;
  works: WorkListItem[];
  virtualItems: VirtualItem[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  wrapperStyle: CSSProperties;
  getItemStyle: (virtualRow: VirtualItem) => CSSProperties;
  setGridContainer: (el: HTMLDivElement | null) => void;
  rowTileProps: RowTileProps;
}

function renderVirtualRow(
  rowIndex: number,
  props: Pick<
    WorkGridVirtualContentProps,
    "isJustified" | "justifiedLayout" | "justifiedRows" | "columnCount" | "works" | "rowTileProps"
  >,
) {
  const { isJustified, justifiedLayout, justifiedRows, columnCount, works, rowTileProps } = props;

  if (isJustified && justifiedLayout) {
    const row = justifiedRows[rowIndex];
    if (!row) return null;
    return (
      <WorkGridRow
        mode="justified"
        rowHeight={row.height}
        entries={row.entries}
        {...rowTileProps}
      />
    );
  }

  const start = rowIndex * columnCount;
  return (
    <WorkGridRow
      mode="square"
      columnCount={columnCount}
      works={works.slice(start, start + columnCount)}
      startIndex={start}
      {...rowTileProps}
    />
  );
}

export default function WorkGridVirtualContent({
  isJustified,
  justifiedLayout,
  justifiedRows,
  columnCount,
  works,
  virtualItems,
  virtualizer,
  wrapperStyle,
  getItemStyle,
  setGridContainer,
  rowTileProps,
}: WorkGridVirtualContentProps) {
  return (
    <div
      ref={setGridContainer}
      className={`mll-grid ${isJustified ? "mll-grid--justified" : ""}`}
      style={wrapperStyle as CSSProperties}
    >
      {virtualItems.map((virtualRow) => (
        <div
          key={virtualRow.key}
          data-index={virtualRow.index}
          ref={virtualizer.measureElement}
          style={getItemStyle(virtualRow) as CSSProperties}
        >
          {renderVirtualRow(virtualRow.index, {
            isJustified,
            justifiedLayout,
            justifiedRows,
            columnCount,
            works,
            rowTileProps,
          })}
        </div>
      ))}
    </div>
  );
}
