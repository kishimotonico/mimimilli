import type { CSSProperties } from "react";
import type { WorkListItem } from "@mimimilli/shared";
import type { GridArrowKey } from "../model/gridNavigation";
import WorkTile from "./WorkTile";

export interface JustifiedRowEntry {
  work: WorkListItem;
  width: number;
  flatIndex: number;
}

interface WorkGridRowTileProps {
  selectedWorkId: string | null;
  playingWorkId: string | null;
  isPlaybackActive: boolean;
  safeTileSize: number;
  /** roving tabindexの現在位置（一覧全体でTabストップ1個にする、TASK-428.12） */
  rovingIndex: number;
  onWorkSelect: (id: string) => void;
  onWorkPlay: (work: WorkListItem) => void;
  onTileArrowKey: (flatIndex: number, key: GridArrowKey) => void;
}

type WorkGridRowProps = WorkGridRowTileProps &
  (
    | {
        mode: "justified";
        rowHeight: number;
        entries: JustifiedRowEntry[];
      }
    | {
        mode: "square";
        columnCount: number;
        works: WorkListItem[];
        startIndex: number;
      }
  );

export default function WorkGridRow(props: WorkGridRowProps) {
  const {
    selectedWorkId,
    playingWorkId,
    isPlaybackActive,
    safeTileSize,
    rovingIndex,
    onWorkSelect,
    onWorkPlay,
    onTileArrowKey,
  } = props;

  const tileProps = {
    isPlaybackActive,
    safeTileSize,
    onSelect: onWorkSelect,
    onPlay: onWorkPlay,
    onArrowKey: onTileArrowKey,
  };

  if (props.mode === "justified") {
    return (
      <div className="mll-grid-row">
        {props.entries.map((entry) => (
          <WorkTile
            key={entry.work.id}
            work={entry.work}
            flatIndex={entry.flatIndex}
            tabIndex={entry.flatIndex === rovingIndex ? 0 : -1}
            tileWidth={entry.width}
            coverHeight={props.rowHeight}
            isSelected={entry.work.id === selectedWorkId}
            isPlaying={entry.work.id === playingWorkId}
            {...tileProps}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="mll-grid-row mll-grid-row--square"
      style={
        {
          display: "grid",
          gridTemplateColumns: `repeat(${props.columnCount}, 1fr)`,
          gap: `var(--grid-col-gap)`,
        } as CSSProperties
      }
    >
      {props.works.map((work, i) => {
        const flatIndex = props.startIndex + i;
        return (
          <WorkTile
            key={work.id}
            work={work}
            flatIndex={flatIndex}
            tabIndex={flatIndex === rovingIndex ? 0 : -1}
            isSelected={work.id === selectedWorkId}
            isPlaying={work.id === playingWorkId}
            {...tileProps}
          />
        );
      })}
    </div>
  );
}
