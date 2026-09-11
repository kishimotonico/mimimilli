import { useCallback, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import type { AxisId } from "../../../entities/library/types";
import { libraryGridLayoutModeAtom, libraryTileSizeAtom } from "../model/atoms";
import type { WorkListItem } from "@mimimilli/shared";
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
import { useGridKeyboardNav } from "./useGridKeyboardNav";
import { useRovingIndex } from "./useRovingIndex";
import { firstFlatIndexOfRow, rowIndexOfFlatIndex } from "../../../shared/lib/gridNavigation";
import WorkGridVirtualContent from "./workGrid/WorkGridVirtualContent";

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
  /** 画面下張り付きの再生バーが表示中か（末尾余白の確保に使う） */
  dockedBarActive?: boolean;
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
  /** スマートフォルダー軸か。0件時に専用の空状態（条件を編集・絞り込みをすべてクリア）を
   *  出す */
  isSmartFolder?: boolean;
  onEditSmartFolderRules?: () => void;
  onClearAllFilters?: () => void;
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
  dockedBarActive = false,
  isPending = false,
  hasNextPage = false,
  worksTotal,
  isFetchingNextPage = false,
  onLoadMore,
  onWorkSelect,
  onWorkPlay,
  onClearSearch,
  onDeselect,
  isSmartFolder = false,
  onEditSmartFolderRules,
  onClearAllFilters,
}: WorkGridProps) {
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
  const moveTileFocus = useGridKeyboardNav({
    gridEl,
    isJustified,
    justifiedLayout,
    columnCount,
    items: works,
    onFocusItem: (work) => onWorkSelect(work.id),
    virtualizer,
  });

  // roving tabindexの現在位置。選択中の作品があればその位置、無ければ先頭（0）を
  // 対象にする（一覧全体でTabストップ1個）。対象が仮想化の描画範囲外
  // （深リンク復元・フィルター変更後の選択維持等）のときは、現在描画されている
  // 先頭行の先頭タイルへフォールバックしつつ対象行までスクロールする
  // （useRovingIndex、WorkListPaneと共通のロジック）。
  const selectedIndex = works.length === 0 ? -1 : works.findIndex((w) => w.id === selectedWorkId);
  const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const rovingIndex = useRovingIndex({
    itemCount: works.length,
    targetIndex,
    virtualItems,
    virtualizer,
    // 対象のタイルが（ジャスティファイドで）まだ存在しないときは行0へフォールバック
    // する。useRovingIndexはこの行が現在の描画範囲内かどうかで対象を判定するため。
    toRowIndex: (flatIndex) =>
      rowIndexOfFlatIndex(flatIndex, isJustified, justifiedLayout?.tiles ?? null, columnCount) ?? 0,
    firstFlatIndexOfRow: (rowIndex) =>
      firstFlatIndexOfRow(rowIndex, isJustified, justifiedLayout?.tiles ?? null, columnCount),
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
