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
  const hd = drillValue
    ? `${works.length} 件`
    : facetItems.length > 0
      ? `${facetItems.length} 件`
      : `${works.length} 件`;

  const listRef = useRef<HTMLDivElement>(null);
  const [paddingEnd, setPaddingEnd] = useState(LIST_PADDING_END_BASE);

  // ドッキングバー表示状態を検知してスクロール終端の余白を調整する。
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

  // WorkRow の高さは .mll-wrow の block-size で 42px に固定されている。
  // measureElement も estimateSize と同値を返し、行ごとの高さずれを防ぐ（TASK-59）。
  // （デフォルトの measureElement は jsdom で offsetHeight=0 を返し無限ループになる）
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

  // 検索・軸・ソート・タグ・ドリル変更時にスクロール位置をリセット（AC#3）。
  // virtualizer 自体の再作成（リサイズ等）ではリセットしない。
  const prevWorksQueryKeyRef = useRef(worksQueryKey);
  useEffect(() => {
    if (prevWorksQueryKeyRef.current === worksQueryKey) return;
    prevWorksQueryKeyRef.current = worksQueryKey;
    virtualizer.scrollToIndex(0);
  }, [virtualizer, worksQueryKey]);

  // 末尾近傍の仮想行が表示されたら次ページを自動取得（AC#2）。
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

  // ── Tag axis: show tag list with checkboxes ───────────────
  if (axis === "tag" && !drillValue) {
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
                  <button className="x" onClick={() => onTagToggle(t)}>
                    <I.x size={9} />
                  </button>
                </span>
              </React.Fragment>
            ))}
            <span className="mll-tagband__count">{works.length} 件</span>
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

  // ── Facet axis, no drill: show facet value list ──────────
  if (isFacetAxis(axis) && !drillValue) {
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

  // ── View / drill / smart: show work list ─────────────────
  const showDrill = isFacetAxis(axis) && drillValue;

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
