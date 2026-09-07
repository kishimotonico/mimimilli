import { useCallback } from "react";
import type { WorkListItem } from "@mimimilli/shared";
import type { AxisId } from "../../../entities/library/types";
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
import { useWorkListKeyboardNav } from "./useWorkListKeyboardNav";

// 作品一覧のリスト表示（list/grid のうち list）。ADR-0012 §3 によりレイアウトを固定し、
// 常に結果面全幅で表示する（旧 ContentColumn の300px固定・中間カラム役割は廃止）。

/** WorkRow の概算高さ（padding 上下 10px + カバー 32px） */
const WORK_ROW_ESTIMATE_SIZE = 42;
/** .mle-col__list の padding（has-docked-bar 時は virtualizer paddingEnd で末尾余白を確保） */
const LIST_PADDING_START = 4;
const LIST_PADDING_END_BASE = 4;
const LIST_DOCKED_BAR_EXTRA = 8;

interface WorkListPaneProps {
  axis: AxisId;
  works: WorkListItem[];
  worksQueryKey: string;
  selectedWorkId: string | null;
  searchQuery: string;
  hasSelectedTags: boolean;
  playingWorkId?: string;
  isPlaybackActive?: boolean;
  /** 画面下張り付きの再生バーが表示中か（末尾余白の確保に使う） */
  dockedBarActive?: boolean;
  isPending?: boolean;
  hasNextPage?: boolean;
  worksTotal?: number;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onWorkSelect: (id: string) => void;
  onWorkPlay: (work: WorkListItem) => void;
  onClearSearch: () => void;
  /** Esc・リスト背景クリック時の選択解除 */
  onDeselect: () => void;
  /** スマートフォルダー軸か。0件時に専用の空状態（条件を編集・絞り込みをすべてクリア）を
   *  出す（TASK-428.24 SF-05） */
  isSmartFolder?: boolean;
  onEditSmartFolderRules?: () => void;
  onClearAllFilters?: () => void;
}

export default function WorkListPane({
  axis,
  works,
  worksQueryKey,
  selectedWorkId,
  searchQuery,
  hasSelectedTags,
  playingWorkId,
  isPlaybackActive,
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
}: WorkListPaneProps) {
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
  const moveRowFocus = useWorkListKeyboardNav({
    listRef: scrollRef,
    works,
    onWorkSelect,
    virtualizer,
  });

  // roving tabindexの現在位置。選択中の作品があればその位置、無ければ先頭（0）を
  // Tabストップにする（一覧全体でTabストップ1個、TASK-428.12）。
  const rovingIndex = works.length === 0 ? -1 : Math.max(0, works.findIndex((w) => w.id === selectedWorkId));

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
    [works, rovingIndex, selectedWorkId, playingWorkId, isPlaybackActive, onWorkSelect, onWorkPlay, moveRowFocus],
  );

  return (
    <div className={`mle-col is-results ${isPending ? "is-pending" : ""}`}>
      <div ref={scrollRef} className="mle-col__list">
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
