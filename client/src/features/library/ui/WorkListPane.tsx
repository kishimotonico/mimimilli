import { useCallback, useState } from "react";
import { useAtomValue } from "jotai";
import {
  playerIsPlayingOrLoadingAtom,
  playingWorkIdAtom,
} from "../../../entities/player/model/atoms";
import type { WorkResultsProps } from "./workResultsProps";
import { buildEmptyWorksHint, buildEmptyWorksMessage } from "../model/emptyWorks";
import WorkRow from "./WorkRow";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import SmartFolderEmptyAction, {
  SMART_FOLDER_EMPTY_HINT,
  SMART_FOLDER_EMPTY_MESSAGE,
} from "./SmartFolderEmptyAction";
import LoadMore from "./LoadMore";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import { useVirtualList } from "../../../shared/ui/useVirtualList";
import { useWorkResultsDismiss } from "./useWorkResultsDismiss";
import { useListKeyboardNav } from "../../../shared/ui/useListKeyboardNav";
import { useRovingIndex } from "./useRovingIndex";

// 作品一覧のリスト表示（list/grid のうち list）。ADR-0012 §3 によりレイアウトを固定し、
// 常に結果面全幅で表示する（旧 ContentColumn の300px固定・中間カラム役割は廃止）。

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
    resetKey: worksQueryKey,
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

  // roving tabindexの現在位置。選択中の作品があればその位置、無ければ先頭（0）を
  // 対象にする（一覧全体でTabストップ1個）。対象が仮想化の描画範囲外
  // （深リンク復元・フィルター変更後の選択維持等）のときは、現在描画されている
  // 先頭行へフォールバックしつつ対象行までスクロールする
  // （useRovingIndex、WorkGridと共通のロジック）。
  const selectedIndex = works.length === 0 ? -1 : works.findIndex((w) => w.id === selectedWorkId);
  const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const rovingIndex = useRovingIndex({
    itemCount: works.length,
    targetIndex,
    virtualItems,
    virtualizer,
    // リストは1件=virtualizerの1行なので恒等変換でよい
    toRowIndex: (index) => index,
    firstFlatIndexOfRow: (index) => index,
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
          onPlay={() => onWorkPlay(work)}
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
      onWorkPlay,
      moveRowFocus,
    ],
  );

  return (
    <div className={`mle-col is-results ${isPending ? "is-pending" : ""}`}>
      <div ref={setListContainer} className="mle-col__list">
        {works.length === 0 ? (
          isSmartFolder ? (
            <CollectionStatus
              variant="list"
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
              variant="list"
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
