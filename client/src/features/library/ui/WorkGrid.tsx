import { useCallback, useRef, useState, type ReactNode } from "react";
import { useAtom, useAtomValue } from "jotai";
import type { AxisId } from "../../../entities/library/types";
import { libraryGridLayoutModeAtom, libraryTileSizeAtom } from "../model/atoms";
import type { WorkListItem } from "@mimimilli/shared";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import { GRID_COLUMN_GAP, GRID_ROW_GAP, clampTileSize } from "../../../shared/lib/gridSizing";
import { buildEmptyWorksHint, buildEmptyWorksMessage } from "../model/emptyWorks";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import LoadMore from "./LoadMore";
import { dockedBarActiveAtom } from "../../../entities/player/model/atoms";
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
import { useWorkGridDismiss } from "./workGrid/useWorkGridDismiss";
import { useWorkGridKeyboardNav } from "./workGrid/useWorkGridKeyboardNav";
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
  /** スマートフォルダー軸のときだけ渡すルール表示・編集導線（結果面ヘッダー直下に置く。
   *  ADR-0012 §3 のレイアウト固定により、プレビュー側ではなく結果面自体が持つ） */
  smartFolderBanner?: ReactNode;
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
  isPending = false,
  hasNextPage = false,
  worksTotal,
  isFetchingNextPage = false,
  onLoadMore,
  onWorkSelect,
  onWorkPlay,
  onClearSearch,
  onDeselect,
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
  useWorkGridDismiss(isWorkSelected, onDeselect, scrollRef);
  const moveTileFocus = useWorkGridKeyboardNav({
    gridEl,
    isJustified,
    justifiedLayout,
    columnCount,
    works,
    onWorkSelect,
    virtualizer,
  });

  const rowTileProps = {
    selectedWorkId,
    playingWorkId,
    isPlaybackActive,
    safeTileSize: gridTileSize,
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
      {smartFolderBanner}
      <div className="mll-grid-body">
        <div ref={scrollRef} className="mll-grid-scroll">
          {works.length === 0 ? (
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
