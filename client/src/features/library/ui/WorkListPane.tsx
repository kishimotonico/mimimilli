import { useCallback, useState } from "react";
import { useAtomValue } from "jotai";
import {
  playerIsPlayingOrLoadingAtom,
  playingWorkIdAtom,
} from "../../../entities/player/model/atoms";
import type { WorkResultsProps } from "./workResultsProps";
import { usePlayWork } from "../../../entities/player/model/usePlayWork";
import WorkRow from "./WorkRow";
import WorksEmptyState from "./WorksEmptyState";
import LoadMore from "./LoadMore";
import { useVirtualList } from "../../../shared/ui/useVirtualList";
import { useWorkResultsDismiss } from "./useWorkResultsDismiss";
import { useFocusListAfterReturn } from "./useFocusListAfterReturn";
import { useListKeyboardNav } from "../../../shared/ui/useListKeyboardNav";
import { useRovingIndex } from "./useRovingIndex";
import { useRevealSelectedWork } from "./useRevealSelectedWork";

// 作品一覧のリスト表示（list/grid のうち list）。ADR-0012 §3 によりレイアウトを固定し、
// 常に結果面全幅で表示する。

/** WorkRow の概算高さ（padding 上下 10px + カバー 32px） */
const WORK_ROW_ESTIMATE_SIZE = 42;
/** .mle-col__list の padding（has-docked-bar 時は virtualizer paddingEnd で末尾余白を確保） */
const LIST_PADDING_START = 4;
const LIST_PADDING_END_BASE = 4;
const LIST_DOCKED_BAR_EXTRA = 8;

export default function WorkListPane({
  nav,
  works,
  worksQueryKey,
  isPending = false,
  dockedBarActive = false,
  pagination: { hasNextPage = false, worksTotal, isFetchingNextPage = false, onLoadMore },
  emptyState: { searchQuery, onClearSearch },
}: WorkResultsProps) {
  const selectedWorkId = nav.selectedWorkId;
  const onWorkSelect = nav.selectWork;
  const onDeselect = useCallback(() => onWorkSelect(null), [onWorkSelect]);
  const { playWork } = usePlayWork();
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);
  const isWorkSelected = selectedWorkId !== null;
  const paddingEnd = dockedBarActive
    ? LIST_PADDING_END_BASE + LIST_DOCKED_BAR_EXTRA
    : LIST_PADDING_END_BASE;

  const measureElement = useCallback(() => WORK_ROW_ESTIMATE_SIZE, []);

  const { scrollRef, virtualizer, virtualItems, wrapperStyle, getItemStyle } = useVirtualList({
    count: works.length,
    estimateSize: WORK_ROW_ESTIMATE_SIZE,
    gap: 1,
    padding: { start: LIST_PADDING_START, end: paddingEnd },
    overscan: 5,
    measureElement,
    infiniteScroll:
      hasNextPage && onLoadMore
        ? {
            hasNextPage,
            isFetchingNextPage,
            onLoadMore,
          }
        : undefined,
  });

  const listFocusable = useFocusListAfterReturn(works, isPending, virtualItems.length);
  useWorkResultsDismiss(isWorkSelected, onDeselect, scrollRef, ".mll-wrow");

  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const setListContainer = useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el;
      setListEl(el);
    },
    [scrollRef],
  );
  const moveRowFocus = useListKeyboardNav({
    containerEl: listEl,
    columnCount: 1,
    items: works,
    onFocusItem: (work) => onWorkSelect(work.id),
    virtualizer,
  });

  // roving tabindexの現在位置。選択中の作品があればその位置、無ければ描画中の先頭行
  // （一覧全体でTabストップ1個、WorkGridと共通のロジック）。
  const selectedIndex = works.findIndex((w) => w.id === selectedWorkId);
  const rovingIndex = useRovingIndex({
    itemCount: works.length,
    targetIndex: selectedIndex >= 0 ? selectedIndex : null,
    virtualItems,
    // リストは1件=virtualizerの1行なので恒等変換でよい
    toRowIndex: (index) => index,
    firstFlatIndexOfRow: (index) => index,
  });
  useRevealSelectedWork({
    selectedWorkId,
    resetKey: worksQueryKey,
    selectedIndex,
    selectedRowIndex: selectedIndex >= 0 ? selectedIndex : undefined,
    isLayoutReady: true,
    virtualizer,
  });

  const renderWorkRow = useCallback(
    (index: number) => {
      const work = works[index];
      if (!work) return null;
      return (
        <WorkRow
          work={work}
          flatIndex={index}
          tabIndex={index === rovingIndex ? 0 : -1}
          isSelected={work.id === selectedWorkId}
          isPlaying={work.id === playingWorkId}
          isPlaybackActive={isPlaybackActive}
          onSelect={() => onWorkSelect(work.id)}
          onPlay={() => void playWork(work, 0)}
          onArrowKey={moveRowFocus}
        />
      );
    },
    [
      works,
      rovingIndex,
      selectedWorkId,
      playingWorkId,
      isPlaybackActive,
      onWorkSelect,
      playWork,
      moveRowFocus,
    ],
  );

  return (
    <div className={`mle-col is-results ${isPending ? "is-pending" : ""}`}>
      <div
        ref={setListContainer}
        data-work-list
        tabIndex={works.length === 0 || listFocusable ? -1 : undefined}
        className="mle-col__list outline-none"
      >
        {works.length === 0 ? (
          <WorksEmptyState
            variant="list"
            nav={nav}
            searchQuery={searchQuery}
            onClearSearch={onClearSearch}
          />
        ) : (
          <div style={wrapperStyle}>
            {virtualItems.map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={getItemStyle(virtualRow)}
              >
                {renderWorkRow(virtualRow.index)}
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
  );
}
