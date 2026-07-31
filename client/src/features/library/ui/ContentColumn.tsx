import React, { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { WorkListItem, AxisFacetItem, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { getAxisLabel, isFacetAxis, isSmartAxis } from "../model/axisDefinitions";
import { buildEmptyWorksMessage } from "../model/emptyWorks";
import { shouldLoadMore } from "../model/virtualScroll";
import WorkRow from "./WorkRow";
import DrillHeader from "./DrillHeader";
import CollectionStatus from "./CollectionStatus";
import LoadMore from "./LoadMore";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";

interface ContentColumnProps {
  axis: AxisId;
  drillValue: string | null;
  works: WorkListItem[];
  /** 検索・軸・ソート・タグ・ドリル変更を検知してスクロール位置をリセットする key */
  worksQueryKey: string;
  facetItems: AxisFacetItem[];
  tagPrefixes: TagPrefix[];
  selectedWorkId: string | null;
  selectedTags: string[];
  searchQuery: string;
  playingWorkId?: string;
  isPlaybackActive?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  /** 次ページがあるか（追加読み込みボタンの表示判定。TASK-73） */
  hasNextPage?: boolean;
  /** サーバー側の総件数（残件数の表示用） */
  worksTotal?: number;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onWorkSelect: (id: string) => void;
  onDrillSelect: (value: string) => void;
  onDrillBack: () => void;
  onTagToggle: (tag: string) => void;
  onClearSearch: () => void;
}

/** WorkRow の概算高さ（padding 上下 10px + カバー 32px） */
const WORK_ROW_ESTIMATE_SIZE = 42;
/** .mle-col__list の padding（has-docked-bar 時は padding-bottom が広がる） */
const LIST_PADDING_START = 4;
const LIST_PADDING_END_BASE = 4;
const LIST_DOCKED_BAR_EXTRA = 8;

function useResetListScrollOnQueryKeyChange(
  worksQueryKey: string,
  listRef: React.RefObject<HTMLDivElement | null>,
) {
  const prevWorksQueryKeyRef = useRef(worksQueryKey);
  useEffect(() => {
    if (prevWorksQueryKeyRef.current === worksQueryKey) return;
    prevWorksQueryKeyRef.current = worksQueryKey;
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [worksQueryKey, listRef]);
}

interface TagAxisContentProps {
  facetItems: AxisFacetItem[];
  selectedTags: string[];
  worksCount: number;
  worksQueryKey: string;
  isLoading?: boolean;
  isError?: boolean;
  onTagToggle: (tag: string) => void;
}

function TagAxisContent({
  facetItems,
  selectedTags,
  worksCount,
  worksQueryKey,
  isLoading,
  isError,
  onTagToggle,
}: TagAxisContentProps) {
  const listRef = useRef<HTMLDivElement>(null);
  useResetListScrollOnQueryKeyChange(worksQueryKey, listRef);
  return (
    <div className="mle-col is-content">
      <div className="mle-col__hd">
        <span>タグ</span>
        <span className="count">{facetItems.length} 件</span>
      </div>
      {selectedTags.length > 0 && (
        <div className="mll-tagband">
          <span className="mll-tagband__lbl">AND</span>
          {selectedTags.map((t, i) => (
            <React.Fragment key={t}>
              {i > 0 && <span className="mll-tagband__and">AND</span>}
              <span className="mll-tagband__chip">
                {t}
                <button
                  type="button"
                  className="x"
                  aria-label={`${t}を解除`}
                  onClick={() => onTagToggle(t)}
                >
                  <I.x size={9} />
                </button>
              </span>
            </React.Fragment>
          ))}
          <span className="mll-tagband__count">{worksCount} 件</span>
        </div>
      )}
      <div ref={listRef} className="mle-col__list">
        {isLoading ? (
          <CollectionStatus variant="list" kind="loading" />
        ) : isError ? (
          <CollectionStatus variant="list" kind="error" />
        ) : facetItems.length === 0 ? (
          <CollectionStatus variant="list" kind="empty" message="タグがありません" />
        ) : (
          facetItems.map((item) => (
            <button
              type="button"
              key={item.value}
              className={`mll-tagrow ${selectedTags.includes(item.value) ? "is-checked" : ""}`}
              aria-pressed={selectedTags.includes(item.value)}
              onClick={() => onTagToggle(item.value)}
            >
              <div className="check">
                {selectedTags.includes(item.value) && (
                  <I.x size={9} style={{ transform: "rotate(45deg)" }} />
                )}
              </div>
              <span className="nm">{item.value}</span>
              <span className="count">{item.count}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

interface FacetAxisContentProps {
  axis: AxisId;
  tagPrefixes: TagPrefix[];
  facetItems: AxisFacetItem[];
  worksQueryKey: string;
  isLoading?: boolean;
  isError?: boolean;
  onDrillSelect: (value: string) => void;
}

function FacetAxisContent({
  axis,
  tagPrefixes,
  facetItems,
  worksQueryKey,
  isLoading,
  isError,
  onDrillSelect,
}: FacetAxisContentProps) {
  const listRef = useRef<HTMLDivElement>(null);
  useResetListScrollOnQueryKeyChange(worksQueryKey, listRef);
  return (
    <div className="mle-col is-content">
      <div className="mle-col__hd">
        <span>{getAxisLabel(axis, tagPrefixes)}</span>
        <span className="count">{facetItems.length} 件</span>
      </div>
      <div ref={listRef} className="mle-col__list">
        {isLoading ? (
          <CollectionStatus variant="list" kind="loading" />
        ) : isError ? (
          <CollectionStatus variant="list" kind="error" />
        ) : facetItems.length === 0 ? (
          <CollectionStatus variant="list" kind="empty" message="項目がありません" />
        ) : (
          facetItems.map((item) => (
            <button
              type="button"
              key={item.value}
              className="mll-erow"
              onClick={() => onDrillSelect(item.value)}
            >
              <span className="ic">
                {axis === "cv" ? (
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "var(--paper-3)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {item.value.slice(0, 1)}
                  </span>
                ) : (
                  <I.folder size={13} />
                )}
              </span>
              <span className="nm">{item.value}</span>
              <span className="count">{item.count}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

interface WorksListContentProps {
  axis: AxisId;
  drillValue: string | null;
  works: WorkListItem[];
  facetItems: AxisFacetItem[];
  worksQueryKey: string;
  tagPrefixes: TagPrefix[];
  selectedWorkId: string | null;
  searchQuery: string;
  playingWorkId?: string;
  isPlaybackActive?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  hasNextPage?: boolean;
  worksTotal?: number;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onWorkSelect: (id: string) => void;
  onDrillBack: () => void;
  onClearSearch: () => void;
}

function WorksListContent({
  axis,
  drillValue,
  works,
  facetItems,
  worksQueryKey,
  tagPrefixes,
  selectedWorkId,
  searchQuery,
  playingWorkId,
  isPlaybackActive,
  isLoading,
  isError,
  hasNextPage = false,
  worksTotal,
  isFetchingNextPage = false,
  onLoadMore,
  onWorkSelect,
  onDrillBack,
  onClearSearch,
}: WorksListContentProps) {
  const showDrill = isFacetAxis(axis) && drillValue;
  const hd = drillValue
    ? `${works.length} 件`
    : facetItems.length > 0
      ? `${facetItems.length} 件`
      : `${works.length} 件`;

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
    <div className="mle-col is-content">
      {showDrill ? (
        <DrillHeader
          axisLabel={axis}
          value={drillValue!}
          count={works.length}
          tagPrefixes={tagPrefixes}
          onBack={onDrillBack}
        />
      ) : (
        <div className="mle-col__hd">
          <span>{isSmartAxis(axis) ? "スマートフォルダー" : "作品"}</span>
          <span className="count">{hd}</span>
        </div>
      )}
      <div ref={listRef} className="mle-col__list">
        {isLoading ? (
          <CollectionStatus variant="list" kind="loading" />
        ) : isError ? (
          <CollectionStatus variant="list" kind="error" />
        ) : works.length === 0 ? (
          <CollectionStatus
            variant="list"
            kind="empty"
            message={buildEmptyWorksMessage(
              searchQuery,
              showDrill ? axis : null,
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

export default function ContentColumn({
  axis,
  drillValue,
  works,
  worksQueryKey,
  facetItems,
  tagPrefixes,
  selectedWorkId,
  selectedTags,
  searchQuery,
  playingWorkId,
  isPlaybackActive,
  isLoading,
  isError,
  hasNextPage = false,
  worksTotal,
  isFetchingNextPage = false,
  onLoadMore,
  onWorkSelect,
  onDrillSelect,
  onDrillBack,
  onTagToggle,
  onClearSearch,
}: ContentColumnProps) {
  if (axis === "tag" && !drillValue) {
    return (
      <TagAxisContent
        facetItems={facetItems}
        selectedTags={selectedTags}
        worksCount={works.length}
        worksQueryKey={worksQueryKey}
        isLoading={isLoading}
        isError={isError}
        onTagToggle={onTagToggle}
      />
    );
  }

  if (isFacetAxis(axis) && !drillValue) {
    return (
      <FacetAxisContent
        axis={axis}
        tagPrefixes={tagPrefixes}
        facetItems={facetItems}
        worksQueryKey={worksQueryKey}
        isLoading={isLoading}
        isError={isError}
        onDrillSelect={onDrillSelect}
      />
    );
  }

  return (
    <WorksListContent
      axis={axis}
      drillValue={drillValue}
      works={works}
      facetItems={facetItems}
      worksQueryKey={worksQueryKey}
      tagPrefixes={tagPrefixes}
      selectedWorkId={selectedWorkId}
      searchQuery={searchQuery}
      playingWorkId={playingWorkId}
      isPlaybackActive={isPlaybackActive}
      isLoading={isLoading}
      isError={isError}
      hasNextPage={hasNextPage}
      worksTotal={worksTotal}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={onLoadMore}
      onWorkSelect={onWorkSelect}
      onDrillBack={onDrillBack}
      onClearSearch={onClearSearch}
    />
  );
}
