import { memo } from "react";
import type { WorkListItem } from "@mimimilli/shared";
import CoverImg from "../../../entities/work/ui/CoverImg";
import { cn } from "../../../shared/lib/cn";
import { selectCoverThumbnailWidth } from "../model/gridSizing";
import type { GridArrowKey } from "../model/gridNavigation";

const GRID_ARROW_KEYS = new Set<GridArrowKey>(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export interface WorkTileProps {
  work: WorkListItem;
  flatIndex: number;
  tileWidth?: number;
  coverHeight?: number;
  isSelected: boolean;
  isPlaying: boolean;
  isPlaybackActive: boolean;
  safeTileSize: number;
  onSelect: (id: string) => void;
  onPlay: (work: WorkListItem) => void;
  onArrowKey: (flatIndex: number, key: GridArrowKey) => void;
}

function WorkTile({
  work,
  flatIndex,
  tileWidth,
  coverHeight,
  isSelected,
  isPlaying,
  isPlaybackActive,
  safeTileSize,
  onSelect,
  onPlay,
  onArrowKey,
}: WorkTileProps) {
  const requestWidth = selectCoverThumbnailWidth(
    tileWidth ?? safeTileSize,
    window.devicePixelRatio,
  );

  return (
    <button
      type="button"
      className={`mll-grid-tile ${isSelected ? "is-on" : ""}`}
      data-flat-index={flatIndex}
      aria-label={`${work.title}を選択、Enterで再生`}
      aria-pressed={isSelected}
      style={tileWidth !== undefined ? { width: tileWidth } : undefined}
      onClick={() => onSelect(work.id)}
      onDoubleClick={() => onPlay(work)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onPlay(work);
          return;
        }
        if (!GRID_ARROW_KEYS.has(event.key as GridArrowKey)) return;
        event.preventDefault();
        onArrowKey(flatIndex, event.key as GridArrowKey);
      }}
    >
      <span
        className="mll-grid-tile__cover"
        style={coverHeight !== undefined ? { height: coverHeight } : undefined}
      >
        <CoverImg
          id={work.id}
          title={work.title}
          cover={work.cover}
          fit="fill"
          radius={6}
          requestWidth={requestWidth}
          loading="lazy"
        />
        {isPlaying && (
          <span
            className="mll-grid-tile__now inline-flex items-center gap-[1px]"
            aria-label={isPlaybackActive ? "再生中" : "一時停止中"}
            title={isPlaybackActive ? "再生中" : "一時停止中"}
          >
            {[6, 10, 8].map((height, i) => (
              <span
                key={height}
                aria-hidden="true"
                className={cn(
                  "block w-[2px] origin-bottom rounded-[1px] bg-current motion-reduce:animate-none",
                  isPlaybackActive && "motion-safe:animate-[mll-eq-bar_840ms_ease-in-out_infinite]",
                )}
                style={{ height, animationDelay: `${i * 120}ms` }}
              />
            ))}
          </span>
        )}
      </span>
      <span className="mll-grid-tile__title">{work.title}</span>
      <span className="mll-grid-tile__circle">{work.circleName ?? "サークル不明"}</span>
    </button>
  );
}

export default memo(WorkTile);
