import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useAtom, useAtomValue } from "jotai";
import type { AxisId } from "../model/types";
import { libraryGridLayoutModeAtom, libraryTileSizeAtom } from "../model/atoms";
import type { WorkListItem } from "@mimimilli/shared";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import {
  GRID_COLUMN_GAP,
  GRID_ROW_GAP,
  GRID_TILE_CHROME_HEIGHT,
  clampTileSize,
} from "../model/gridSizing";
import {
  getNextGridIndex,
  getNextJustifiedIndex,
  type GridArrowKey,
} from "../model/gridNavigation";
import { computeJustifiedLayout, type JustifiedLayout } from "../model/justifiedLayout";
import { buildEmptyWorksHint, buildEmptyWorksMessage } from "../model/emptyWorks";
import { isSmartAxis } from "../model/axisDefinitions";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import LoadMore from "./LoadMore";
import WorkGridRow from "./WorkGridRow";
import { dockedBarActiveAtom } from "../../player/model/atoms";
import { useVirtualGrid } from "../../../shared/ui/useVirtualGrid";

interface WorkGridProps {
  axis: AxisId;
  works: WorkListItem[];
  /** 検索・軸・ソート・タグ変更を検知してスクロール位置をリセットする key */
  worksQueryKey: string;
  selectedWorkId: string | null;
  searchQuery: string;
  hasSelectedTags: boolean;
  playingWorkId?: string | null;
  isPlaybackActive?: boolean;
  isLoading: boolean;
  isError: boolean;
  /** 遷移中は直前の一覧を薄く表示する。 */
  isPending?: boolean;
  /** 次ページがあるか（追加読み込みボタンの表示判定。TASK-73） */
  hasNextPage?: boolean;
  /** サーバー側の総件数（残件数の表示用） */
  worksTotal?: number;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onWorkSelect: (id: string) => void;
  onWorkPlay: (work: WorkListItem) => void;
  onClearSearch: () => void;
  /** Esc・グリッド背景クリック時の選択解除 */
  onDeselect: () => void;
  /** 作品一覧取得の再試行（isError 時） */
  onRetryWorks?: () => void;
  /** スマートフォルダー軸のときだけ渡すルール表示・編集導線（結果面ヘッダー直下に置く。
   *  ADR-0012 §3 のレイアウト固定により、プレビュー側ではなく結果面自体が持つ） */
  smartFolderBanner?: ReactNode;
}

interface JustifiedRowGroup {
  rowIndex: number;
  height: number;
  entries: { work: WorkListItem; width: number; flatIndex: number }[];
}

// justifiedLayout.tiles（入力 works と同順序・同長さ）を行ごとにグルーピングする（レンダリング用）。
function groupJustifiedRows(works: WorkListItem[], layout: JustifiedLayout): JustifiedRowGroup[] {
  const rows: JustifiedRowGroup[] = [];
  layout.tiles.forEach((tile, flatIndex) => {
    const work = works[flatIndex];
    if (!work) return;
    let row = rows[tile.rowIndex];
    if (!row) {
      row = { rowIndex: tile.rowIndex, height: layout.rowHeights[tile.rowIndex] ?? 0, entries: [] };
      rows[tile.rowIndex] = row;
    }
    row.entries.push({ work, width: tile.width, flatIndex });
  });
  return rows;
}

/** スクロールコンテナ (.mll-grid) の padding を virtualizer に反映する */
const GRID_PADDING_START = 16;
const GRID_PADDING_END_BASE = 16;
/** .mle-app.has-docked-bar の際の追加余白（TASK-59: スクロール終端が見切れないよう） */
const GRID_DOCKED_BAR_EXTRA = 28;

function isJustifiedLayoutRevision(value: unknown): value is JustifiedLayout {
  if (typeof value !== "object" || value === null) return false;
  return "tiles" in value && "rowHeights" in value;
}

export default function WorkGrid({
  axis,
  works,
  worksQueryKey,
  selectedWorkId,
  searchQuery,
  hasSelectedTags,
  playingWorkId = null,
  isPlaybackActive = false,
  isLoading,
  isError,
  isPending = false,
  hasNextPage = false,
  worksTotal,
  isFetchingNextPage = false,
  onLoadMore,
  onWorkSelect,
  onWorkPlay,
  onClearSearch,
  onDeselect,
  onRetryWorks,
  smartFolderBanner,
}: WorkGridProps) {
  const [tileSize, setTileSize] = useAtom(libraryTileSizeAtom);
  const gridLayoutMode = useAtomValue(libraryGridLayoutModeAtom);
  const safeTileSize = clampTileSize(tileSize);
  const paneRef = useRef<HTMLElement>(null);
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const isWorkSelected = selectedWorkId !== null;
  const dockedBarActive = useAtomValue(dockedBarActiveAtom);
  const paddingEnd = dockedBarActive
    ? GRID_PADDING_END_BASE + GRID_DOCKED_BAR_EXTRA
    : GRID_PADDING_END_BASE;
  const isJustified = gridLayoutMode === "justified";

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

  const justifiedOptions = useMemo(
    () => (isJustified ? { getLayout: getJustifiedLayout } : undefined),
    [isJustified, getJustifiedLayout],
  );

  const {
    scrollRef,
    setGridEl: setGridElFromHook,
    columnCount,
    safeTileSize: gridTileSize,
    justifiedLayout: justifiedVirtualLayout,
    virtualizer,
    virtualItems,
    wrapperStyle,
    getItemStyle,
  } = useVirtualGrid({
    itemCount: works.length,
    tileSize: safeTileSize,
    resetKey: worksQueryKey,
    gap: { row: GRID_ROW_GAP, column: GRID_COLUMN_GAP },
    padding: { start: GRID_PADDING_START, end: paddingEnd },
    justified: justifiedOptions,
    infiniteScroll:
      hasNextPage && onLoadMore
        ? {
            hasNextPage,
            isFetchingNextPage,
            onLoadMore,
          }
        : undefined,
  });

  const justifiedLayout =
    isJustified &&
    justifiedVirtualLayout &&
    isJustifiedLayoutRevision(justifiedVirtualLayout.layoutRevision)
      ? justifiedVirtualLayout.layoutRevision
      : null;

  const justifiedRows = useMemo(
    () => (justifiedLayout ? groupJustifiedRows(works, justifiedLayout) : []),
    [justifiedLayout, works],
  );

  const setGridContainer = useCallback(
    (el: HTMLDivElement | null) => {
      setGridElFromHook(el);
      setGridEl(el);
    },
    [setGridElFromHook],
  );

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setTileSize(clampTileSize(safeTileSize - event.deltaY * 0.1));
    };

    pane.addEventListener("wheel", handleWheel, { passive: false });
    return () => pane.removeEventListener("wheel", handleWheel);
  }, [setTileSize, safeTileSize]);

  useEffect(() => {
    if (!isWorkSelected) return;

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

      onDeselect();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isWorkSelected, onDeselect]);

  useEffect(() => {
    if (!isWorkSelected) return;
    const scroll = scrollRef.current;
    if (!scroll) return;

    const handleGridBackgroundClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".mll-grid-tile")) return;
      onDeselect();
    };

    scroll.addEventListener("click", handleGridBackgroundClick);
    return () => scroll.removeEventListener("click", handleGridBackgroundClick);
  }, [isWorkSelected, onDeselect, scrollRef]);

  const moveTileFocus = useCallback(
    (currentIndex: number, key: GridArrowKey) => {
      if (!gridEl) return;

      const nextIndex =
        isJustified && justifiedLayout
          ? getNextJustifiedIndex(justifiedLayout.tiles, currentIndex, key)
          : getNextGridIndex(currentIndex, key, columnCount, works.length);
      if (nextIndex === currentIndex) return;

      const rowIndex =
        isJustified && justifiedLayout
          ? justifiedLayout.tiles[nextIndex]?.rowIndex
          : Math.floor(nextIndex / columnCount);
      if (rowIndex === undefined || rowIndex < 0) return;

      const nextWork = works[nextIndex];
      if (nextWork) onWorkSelect(nextWork.id);

      virtualizer.scrollToIndex(rowIndex, { align: "auto" });

      let attempts = 0;
      const tryFocus = () => {
        if (attempts++ > 20) return;
        const tile = gridEl.querySelector<HTMLElement>(`[data-flat-index="${nextIndex}"]`);
        if (tile) {
          tile.focus({ preventScroll: true });
          tile.scrollIntoView({ block: "nearest", inline: "nearest" });
        } else {
          requestAnimationFrame(tryFocus);
        }
      };
      requestAnimationFrame(tryFocus);
    },
    [gridEl, isJustified, justifiedLayout, columnCount, works, onWorkSelect, virtualizer],
  );

  const rowTileProps = {
    selectedWorkId,
    playingWorkId,
    isPlaybackActive,
    safeTileSize: gridTileSize,
    onWorkSelect,
    onWorkPlay,
    onTileArrowKey: moveTileFocus,
  };

  const renderVirtualRow = (rowIndex: number) => {
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
  };

  return (
    <section
      ref={paneRef}
      className={`mll-grid-pane ${isPending ? "is-pending" : ""}`}
      aria-label="作品グリッド"
    >
      <div className="mle-col__hd">
        <span>{isSmartAxis(axis) ? "スマートフォルダー" : "作品"}</span>
        {worksTotal != null && <span className="count">{worksTotal} 件</span>}
      </div>
      {smartFolderBanner}
      <div className="mll-grid-body">
        <div ref={scrollRef} className="mll-grid-scroll">
          {isLoading ? (
            <CollectionStatus variant="grid" kind="loading" />
          ) : isError ? (
            <CollectionStatus variant="grid" kind="error" onRetry={onRetryWorks} />
          ) : works.length === 0 ? (
            <CollectionStatus
              variant="grid"
              kind="empty"
              message={buildEmptyWorksMessage(searchQuery, hasSelectedTags)}
              hint={buildEmptyWorksHint(axis, Boolean(searchQuery) || hasSelectedTags)}
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
                  {renderVirtualRow(virtualRow.index)}
                </div>
              ))}
            </div>
          )}
          {hasNextPage && onLoadMore && (
            <LoadMore
              loadedCount={works.length}
              totalCount={worksTotal}
              isFetching={isFetchingNextPage}
              onLoadMore={onLoadMore}
            />
          )}
        </div>
      </div>
    </section>
  );
}
