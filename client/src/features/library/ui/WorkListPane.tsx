import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { WorkListItem } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { isSmartAxis } from "../model/axisDefinitions";
import { buildEmptyWorksHint, buildEmptyWorksMessage } from "../model/emptyWorks";
import { shouldLoadMore } from "../model/virtualScroll";
import WorkRow from "./WorkRow";
import CollectionStatus from "./CollectionStatus";
import LoadMore from "./LoadMore";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";

// 作品一覧のリスト表示（list/grid のうち list）。ADR-0012 §3 によりレイアウトを固定し、
// 常に結果面全幅で表示する（旧 ContentColumn の300px固定・中間カラム役割は廃止）。

/** WorkRow の概算高さ（padding 上下 10px + カバー 32px） */
const WORK_ROW_ESTIMATE_SIZE = 42;
/** .mle-col__list の padding（has-docked-bar 時は padding-bottom が広がる） */
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
  /** スマートフォルダー軸のときだけ渡すルール表示・編集導線（プレビュー側ではなく
   *  結果面ヘッダー直下に置く） */
  smartFolderBanner?: ReactNode;
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
  smartFolderBanner,
}: WorkListPaneProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [paddingEnd, setPaddingEnd] = useState(LIST_PADDING_END_BASE);

  useEffect(() => {
    const app = listRef.current?.closest(".mle-app");
    if (!app) return;
    const update = () => {
      setPaddingEnd(
        app.classList.contains("has-docked-bar")
          ? LIST_PADDING_END_BASE + LIST_DOCKED_BAR_EXTRA
          : LIST_PADDING_END_BASE,
      );
    };
    const observer = new MutationObserver(update);
    observer.observe(app, { attributes: true, attributeFilter: ["class"] });
    update();
    return () => observer.disconnect();
  }, []);

  const measureElement = useCallback(() => WORK_ROW_ESTIMATE_SIZE, []);

  const virtualizer = useVirtualizer({
    count: works.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => WORK_ROW_ESTIMATE_SIZE,
    overscan: 5,
    gap: 1,
    paddingStart: LIST_PADDING_START,
    paddingEnd,
    measureElement,
  });

  const prevWorksQueryKeyRef = useRef(worksQueryKey);
  useEffect(() => {
    if (prevWorksQueryKeyRef.current === worksQueryKey) return;
    prevWorksQueryKeyRef.current = worksQueryKey;
    virtualizer.scrollToIndex(0);
  }, [virtualizer, worksQueryKey]);

  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !onLoadMore) return;
    if (shouldLoadMore(virtualItems, works.length, virtualizer.options.overscan)) {
      onLoadMore();
    }
  }, [virtualItems, hasNextPage, isFetchingNextPage, onLoadMore, works.length, virtualizer]);

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
      <div className="mle-col__hd">
        <span>{isSmartAxis(axis) ? "スマートフォルダー" : "作品"}</span>
        {worksTotal != null && <span className="count">{worksTotal} 件</span>}
      </div>
      {smartFolderBanner}
      <div ref={listRef} className="mle-col__list">
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
          <div
            style={{
              position: "relative",
              width: "100%",
              height: virtualizer.getTotalSize(),
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
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
