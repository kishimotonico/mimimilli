import { useCallback, type ReactNode } from "react";
import { useAtomValue } from "jotai";
import type { WorkListItem } from "@mimimilli/shared";
import type { AxisId } from "../../../entities/library/types";
import { buildEmptyWorksHint, buildEmptyWorksMessage } from "../model/emptyWorks";
import WorkRow from "./WorkRow";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import LoadMore from "./LoadMore";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import { dockedBarActiveAtom } from "../../../entities/player/model/atoms";
import { useVirtualList } from "../../../shared/ui/useVirtualList";

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
  isPending?: boolean;
  hasNextPage?: boolean;
  worksTotal?: number;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onWorkSelect: (id: string) => void;
  onClearSearch: () => void;
  /** 結果面ヘッダー直下に置くバナー（スマートフォルダー軸のルール表示・編集導線、
   *  エラービュー軸の一括削除導線など。プレビュー側ではなく結果面ヘッダー直下に置く） */
  resultsBanner?: ReactNode;
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
  isPending = false,
  hasNextPage = false,
  worksTotal,
  isFetchingNextPage = false,
  onLoadMore,
  onWorkSelect,
  onClearSearch,
  resultsBanner,
}: WorkListPaneProps) {
  const dockedBarActive = useAtomValue(dockedBarActiveAtom);
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

  const renderWorkRow = useCallback(
    (index: number) => {
      const work = works[index];
      if (!work) return null;
      return (
        <WorkRow
          work={work}
          isSelected={work.id === selectedWorkId}
          isPlaying={work.id === playingWorkId}
          isPlaybackActive={isPlaybackActive}
          onSelect={() => onWorkSelect(work.id)}
        />
      );
    },
    [works, selectedWorkId, playingWorkId, isPlaybackActive, onWorkSelect],
  );

  return (
    <div className={`mle-col is-results ${isPending ? "is-pending" : ""}`}>
      {resultsBanner}
      <div ref={scrollRef} className="mle-col__list">
        {works.length === 0 ? (
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
