import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useAtomValue } from "jotai";
import type { AxisId } from "../model/types";
import { tagPrefixesAtom } from "../model/atoms";
import type { WorkSummary } from "@mimimilli/shared";
import CoverImg from "../../../entities/work/ui/CoverImg";
import { getCircleName } from "../../../entities/work/model";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import { clampTileSize, selectCoverThumbnailWidth } from "../model/gridSizing";
import { countGridColumns, getNextGridIndex, type GridArrowKey } from "../model/gridNavigation";
import { buildEmptyWorksMessage } from "../model/emptyWorks";
import { isFacetAxis, isSmartAxis } from "../model/axisDefinitions";
import CollectionStatus from "./CollectionStatus";
import DrillHeader from "./DrillHeader";

interface WorkGridProps {
  axis: AxisId;
  drillValue: string | null;
  works: WorkSummary[];
  selectedWorkId: string | null;
  searchQuery: string;
  tileSize: number;
  isLoading: boolean;
  isError: boolean;
  onTileSizeChange: (size: number) => void;
  onWorkSelect: (id: string) => void;
  onWorkPlay: (work: WorkSummary) => void;
  onDrillBack: () => void;
  onClearSearch: () => void;
  inspector: ReactNode | null;
  onInspectorClose: () => void;
}

const GRID_ARROW_KEYS = new Set<GridArrowKey>(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export default function WorkGrid({
  axis,
  drillValue,
  works,
  selectedWorkId,
  searchQuery,
  tileSize,
  isLoading,
  isError,
  onTileSizeChange,
  onWorkSelect,
  onWorkPlay,
  onDrillBack,
  onClearSearch,
  inspector,
  onInspectorClose,
}: WorkGridProps) {
  const tagPrefixes = useAtomValue(tagPrefixesAtom);
  const safeTileSize = clampTileSize(tileSize);
  const requestWidth = selectCoverThumbnailWidth(safeTileSize, window.devicePixelRatio);
  const isDrilled = drillValue !== null;
  const paneRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isInspectorOpen = inspector !== null;

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      onTileSizeChange(clampTileSize(safeTileSize - event.deltaY * 0.1));
    };

    pane.addEventListener("wheel", handleWheel, { passive: false });
    return () => pane.removeEventListener("wheel", handleWheel);
  }, [onTileSizeChange, safeTileSize]);

  useEffect(() => {
    if (!isInspectorOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;

      const target = event.target instanceof Element ? event.target : null;
      if (
        document.querySelector("dialog[open]") ||
        target?.closest('dialog, [role="dialog"]') ||
        target?.closest('input, textarea, select, [contenteditable="true"], [aria-expanded="true"]')
      ) {
        return;
      }

      onInspectorClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isInspectorOpen, onInspectorClose]);

  useEffect(() => {
    if (!isInspectorOpen) return;
    const scroll = scrollRef.current;
    if (!scroll) return;

    const handleGridBackgroundClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".mll-grid-tile")) return;
      onInspectorClose();
    };

    scroll.addEventListener("click", handleGridBackgroundClick);
    return () => scroll.removeEventListener("click", handleGridBackgroundClick);
  }, [isInspectorOpen, onInspectorClose]);

  const moveTileFocus = (currentIndex: number, key: GridArrowKey) => {
    const grid = gridRef.current;
    if (!grid) return;

    const tiles = Array.from(grid.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    const columnCount = countGridColumns(tiles.map((tile) => tile.offsetTop));
    const nextIndex = getNextGridIndex(currentIndex, key, columnCount, tiles.length);
    if (nextIndex === currentIndex) return;

    const nextTile = tiles[nextIndex];
    nextTile.focus({ preventScroll: true });
    nextTile.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <section
      ref={paneRef}
      className={`mll-grid-pane ${isInspectorOpen ? "is-inspector-open" : ""}`}
      aria-label="作品グリッド"
    >
      {isDrilled ? (
        <DrillHeader
          axisLabel={axis}
          value={drillValue}
          count={works.length}
          onBack={onDrillBack}
        />
      ) : (
        <div className="mle-col__hd">
          <span>{isSmartAxis(axis) ? "スマートフォルダー" : "作品"}</span>
          <span className="count">{works.length} 件</span>
        </div>
      )}
      <div ref={scrollRef} className="mll-grid-scroll">
        {isLoading ? (
          <CollectionStatus variant="grid" kind="loading" />
        ) : isError ? (
          <CollectionStatus variant="grid" kind="error" />
        ) : works.length === 0 ? (
          <CollectionStatus
            variant="grid"
            kind="empty"
            message={buildEmptyWorksMessage(
              searchQuery,
              isDrilled && isFacetAxis(axis) ? axis : null,
              drillValue,
              tagPrefixes,
            )}
            action={
              searchQuery ? (
                <Button variant="ghost" icon={I.x} onClick={onClearSearch}>
                  検索をクリア
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div
            ref={gridRef}
            className="mll-grid"
            style={{ "--tile-size": `${safeTileSize}px` } as CSSProperties}
          >
            {works.map((work, index) => (
              <button
                key={work.id}
                type="button"
                className={`mll-grid-tile ${work.id === selectedWorkId ? "is-on" : ""}`}
                aria-label={`${work.title}を選択`}
                aria-pressed={work.id === selectedWorkId}
                onClick={() => onWorkSelect(work.id)}
                onDoubleClick={() => onWorkPlay(work)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onWorkPlay(work);
                    return;
                  }
                  if (!GRID_ARROW_KEYS.has(event.key as GridArrowKey)) return;
                  event.preventDefault();
                  moveTileFocus(index, event.key as GridArrowKey);
                }}
              >
                <span className="mll-grid-tile__cover">
                  <CoverImg
                    id={work.id}
                    title={work.title}
                    hasCover={Boolean(work.coverImage)}
                    fit="fill"
                    radius={6}
                    requestWidth={requestWidth}
                    loading="lazy"
                  />
                </span>
                <span className="mll-grid-tile__title">{work.title}</span>
                <span className="mll-grid-tile__circle">
                  {getCircleName(work) ?? "サークル不明"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {inspector}
    </section>
  );
}
