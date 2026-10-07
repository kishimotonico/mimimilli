import { useCallback, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { libraryGridLayoutModeAtom, libraryTileSizeAtom } from "../model/atoms";
import {
  playerIsPlayingOrLoadingAtom,
  playingWorkIdAtom,
} from "../../../entities/player/model/atoms";
import type { WorkResultsProps } from "./workResultsProps";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import { GRID_COLUMN_GAP, GRID_ROW_GAP, clampTileSize } from "../../../shared/lib/gridSizing";
import { buildEmptyWorksHint, buildEmptyWorksMessage } from "../model/emptyWorks";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import SmartFolderEmptyAction, {
  SMART_FOLDER_EMPTY_HINT,
  SMART_FOLDER_EMPTY_MESSAGE,
} from "./SmartFolderEmptyAction";
import LoadMore from "./LoadMore";
import { useVirtualGrid } from "../../../shared/ui/useVirtualGrid";
import {
  GRID_DOCKED_BAR_EXTRA,
  GRID_PADDING_END_BASE,
  GRID_PADDING_START,
} from "./workGrid/constants";
import {
  useWorkGridJustifiedOptions,
  useWorkGridJustifiedRows,
} from "./workGrid/useWorkGridJustifiedLayout";
import { useWorkGridWheelZoom } from "./workGrid/useWorkGridWheelZoom";
import { useWorkResultsDismiss } from "./useWorkResultsDismiss";
import { useListKeyboardNav } from "../../../shared/ui/useListKeyboardNav";
import { useRovingIndex } from "./useRovingIndex";
import { useRevealSelectedWork } from "./useRevealSelectedWork";
import { firstFlatIndexOfRow, rowIndexOfFlatIndex } from "../../../shared/lib/gridNavigation";
import WorkGridVirtualContent from "./workGrid/WorkGridVirtualContent";

export default function WorkGrid({
  nav,
  works,
  worksQueryKey,
  isPending = false,
  dockedBarActive = false,
  onWorkPlay,
  pagination: { hasNextPage = false, worksTotal, isFetchingNextPage = false, onLoadMore },
  emptyState: { searchQuery, isSmartFolder = false, onClearSearch, onEditSmartFolderRules },
}: WorkResultsProps) {
  const axis = nav.activeAxis;
  const selectedWorkId = nav.selectedWorkId;
  const hasSelectedTags = nav.selectedTags.length > 0;
  const onWorkSelect = nav.selectWork;
  const onClearAllFilters = nav.clearTags;
  const onDeselect = useCallback(
    () => nav.selectWork(null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav は毎レンダー新規オブジェクトのため参照する値だけに依存を絞る
    [nav.selectWork],
  );
  const playingWorkId = useAtomValue(playingWorkIdAtom) ?? null;
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);
  const [tileSize, setTileSize] = useAtom(libraryTileSizeAtom);
  const gridLayoutMode = useAtomValue(libraryGridLayoutModeAtom);
  const safeTileSize = clampTileSize(tileSize);
  const paneRef = useRef<HTMLElement>(null);
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const isWorkSelected = selectedWorkId !== null;
  const paddingEnd = dockedBarActive
    ? GRID_PADDING_END_BASE + GRID_DOCKED_BAR_EXTRA
    : GRID_PADDING_END_BASE;
  const isJustified = gridLayoutMode === "justified";

  const justifiedOptions = useWorkGridJustifiedOptions({ works, isJustified, safeTileSize });

  const {
    scrollRef,
    setGridEl: setGridElFromHook,
    containerWidth,
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

  const { justifiedLayout, justifiedRows } = useWorkGridJustifiedRows({
    works,
    isJustified,
    justifiedVirtualLayout,
  });

  const setGridContainer = useCallback(
    (el: HTMLDivElement | null) => {
      setGridElFromHook(el);
      setGridEl(el);
    },
    [setGridElFromHook],
  );

  useWorkGridWheelZoom(paneRef, safeTileSize, setTileSize);
  useWorkResultsDismiss(isWorkSelected, onDeselect, scrollRef, ".mll-grid-tile");
  const moveTileFocus = useListKeyboardNav({
    containerEl: gridEl,
    justifiedTiles: isJustified ? (justifiedLayout?.tiles ?? null) : null,
    columnCount,
    items: works,
    onFocusItem: (work) => onWorkSelect(work.id),
    virtualizer,
  });

  // roving tabindexの現在位置。選択中の作品があればその位置、無ければ描画中の先頭行の
  // 先頭タイル（一覧全体でTabストップ1個、WorkListPaneと共通のロジック）。
  // ジャスティファイドでタイルが未計算の間は行が解決できず、先頭行へフォールバックする。
  const justifiedTiles = justifiedLayout?.tiles ?? null;
  const toRowIndex = (flatIndex: number) =>
    rowIndexOfFlatIndex(flatIndex, isJustified, justifiedTiles, columnCount);
  const selectedIndex = works.findIndex((w) => w.id === selectedWorkId);
  const rovingIndex = useRovingIndex({
    itemCount: works.length,
    targetIndex: selectedIndex >= 0 ? selectedIndex : null,
    virtualItems,
    toRowIndex,
    firstFlatIndexOfRow: (rowIndex) =>
      firstFlatIndexOfRow(rowIndex, isJustified, justifiedTiles, columnCount),
  });
  useRevealSelectedWork({
    selectedWorkId,
    resetKey: worksQueryKey,
    selectedIndex,
    selectedRowIndex: selectedIndex >= 0 ? toRowIndex(selectedIndex) : undefined,
    isLayoutReady: containerWidth > 0,
    virtualizer,
  });

  const rowTileProps = {
    selectedWorkId,
    playingWorkId,
    isPlaybackActive,
    safeTileSize: gridTileSize,
    rovingIndex,
    onWorkSelect,
    onWorkPlay,
    onTileArrowKey: moveTileFocus,
  };

  return (
    <section
      ref={paneRef}
      className={`mll-grid-pane ${isPending ? "is-pending" : ""}`}
      aria-label="作品グリッド"
    >
      <div className="mll-grid-body">
        <div ref={scrollRef} className="mll-grid-scroll">
          {works.length === 0 ? (
            isSmartFolder ? (
              <CollectionStatus
                variant="grid"
                kind="empty"
                message={SMART_FOLDER_EMPTY_MESSAGE}
                hint={SMART_FOLDER_EMPTY_HINT}
                action={
                  <SmartFolderEmptyAction
                    hasSelectedTags={hasSelectedTags}
                    onEditRules={() => onEditSmartFolderRules?.()}
                    onClearFilters={() => onClearAllFilters?.()}
                  />
                }
              />
            ) : (
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
            )
          ) : (
            <WorkGridVirtualContent
              isJustified={isJustified}
              justifiedLayout={justifiedLayout}
              justifiedRows={justifiedRows}
              columnCount={columnCount}
              works={works}
              virtualItems={virtualItems}
              virtualizer={virtualizer}
              wrapperStyle={wrapperStyle}
              getItemStyle={getItemStyle}
              setGridContainer={setGridContainer}
              rowTileProps={rowTileProps}
            />
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
