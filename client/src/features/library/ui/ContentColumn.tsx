import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { parseTag } from "@mimimilli/shared";
import type { WorkListItem, AxisFacetItem, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { getAxisLabel, isFacetAxis, isSmartAxis } from "../model/axisDefinitions";
import { buildEmptyWorksHint, buildEmptyWorksMessage } from "../model/emptyWorks";
import { groupTagFacetItems } from "../model/tagAxisGrouping";
import { shouldLoadMore } from "../model/virtualScroll";
import WorkRow from "./WorkRow";
import CollectionStatus from "./CollectionStatus";
import LoadMore from "./LoadMore";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import { tagPrefixColorToCss } from "../../../entities/work/tagPrefixColor";

// ドリル済みファセット軸は showGrid（libraryPresentation.ts）が常に横取りして
// 全幅グリッドへ合流するため、ContentColumn にはファセット軸のドリル状態が
// 渡らない（構造的に到達不能）。ドリル表示・戻る導線は WorkGrid 側が担う。

interface ContentColumnProps {
  axis: AxisId;
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
  isPending?: boolean;
  /** タグ軸・ファセット軸一覧（facetItems）自体の取得状態。作品一覧の isLoading/isError とは
   *  別のクエリ（GET /axes/:axis）のため区別する（R2: 軸切替時の見出し固着調査） */
  isFacetLoading?: boolean;
  isFacetError?: boolean;
  /** タグprefix一覧（分類軸の色・ラベル定義）の取得状態。タグ軸のグルーピングに
   *  必須のため、取得失敗時は facetItems が取れていてもエラー表示に倒す。 */
  isTagPrefixesError?: boolean;
  /** 次ページがあるか（追加読み込みボタンの表示判定。TASK-73） */
  hasNextPage?: boolean;
  /** サーバー側の総件数（残件数の表示用） */
  worksTotal?: number;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onWorkSelect: (id: string) => void;
  onDrillSelect: (value: string) => void;
  onTagToggle: (tag: string) => void;
  onClearSearch: () => void;
  /** 作品一覧取得の再試行（isError 時） */
  onRetryWorks?: () => void;
  /** タグ・ファセット一覧取得の再試行（isFacetError 時） */
  onRetryFacets?: () => void;
  /** タグprefix一覧取得の再試行（isTagPrefixesError 時） */
  onRetryTagPrefixes?: () => void;
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
  tagPrefixes: TagPrefix[];
  selectedTags: string[];
  worksTotal?: number;
  worksQueryKey: string;
  /** タグ軸ファセット自体の取得状態（作品一覧の isLoading/isError とは別系統） */
  isFacetLoading?: boolean;
  isFacetError?: boolean;
  isTagPrefixesError?: boolean;
  onTagToggle: (tag: string) => void;
  onRetryFacets?: () => void;
  onRetryTagPrefixes?: () => void;
}

function TagAxisContent({
  facetItems,
  tagPrefixes,
  selectedTags,
  worksTotal,
  worksQueryKey,
  isFacetLoading,
  isFacetError,
  isTagPrefixesError,
  onTagToggle,
  onRetryFacets,
  onRetryTagPrefixes,
}: TagAxisContentProps) {
  const listRef = useRef<HTMLDivElement>(null);
  useResetListScrollOnQueryKeyChange(worksQueryKey, listRef);
  const groups = useMemo(
    () => groupTagFacetItems(facetItems, tagPrefixes),
    [facetItems, tagPrefixes],
  );
  return (
    <div className="mle-col is-content">
      <div className="mle-col__hd">
        <span>タグ</span>
        {!isFacetLoading && <span className="count">{facetItems.length} 件</span>}
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
          {worksTotal != null && <span className="mll-tagband__count">{worksTotal} 件</span>}
        </div>
      )}
      <div ref={listRef} className="mle-col__list">
        {isFacetLoading ? (
          <CollectionStatus variant="list" kind="loading" />
        ) : isFacetError && facetItems.length === 0 ? (
          // キャッシュが無い＝初回取得失敗のときだけ一覧全体をエラー画面に置き換える。
          <CollectionStatus variant="list" kind="error" onRetry={onRetryFacets} />
        ) : (
          <>
            {/* facetItemsの再取得が失敗していても、React Queryはキャッシュ済みのデータを
                保持したままisError=trueになる。キャッシュがある場合は一覧を残し、
                非ブロッキングのエラー行＋再試行だけを出す。 */}
            {isFacetError && (
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- AxisColumnの分類軸エラーと同様、role="status"で非ブロッキング通知にする
              <div className="mll-axis-error" role="status" aria-live="polite">
                <span>タグの取得に失敗しました</span>
                {onRetryFacets && (
                  <Button variant="ghost" icon={I.refresh} onClick={onRetryFacets}>
                    再試行
                  </Button>
                )}
              </div>
            )}
            {/* タグprefix一覧（グループ見出しのラベル・色定義）の取得に失敗していても、
                facetItems自体はキャッシュ表示できるため一覧をブロックしない。
                サイドバー（AxisColumn）の分類軸エラー表示と文言・見た目を揃える。 */}
            {isTagPrefixesError && (
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- AxisColumnの分類軸エラーと同様、role="status"で非ブロッキング通知にする
              <div className="mll-axis-error" role="status" aria-live="polite">
                <span>分類軸の取得に失敗しました</span>
                {onRetryTagPrefixes && (
                  <Button variant="ghost" icon={I.refresh} onClick={onRetryTagPrefixes}>
                    再試行
                  </Button>
                )}
              </div>
            )}
            {facetItems.length === 0 ? (
              <CollectionStatus variant="list" kind="empty" message="タグがありません" />
            ) : (
              groups.map((group) => (
                <div key={group.key || "__flat__"} className="mll-taggroup">
                  <div
                    className="mll-axisgroup__hd"
                    style={group.color ? { color: tagPrefixColorToCss(group.color) } : undefined}
                  >
                    {group.label}
                  </div>
                  {group.items.map((item) => (
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
                      <span className="nm">{parseTag(item.value).value}</span>
                      <span className="count">{item.count}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </>
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
  /** ファセット自体の取得状態（作品一覧の isLoading/isError とは別系統） */
  isFacetLoading?: boolean;
  isFacetError?: boolean;
  onDrillSelect: (value: string) => void;
  onRetryFacets?: () => void;
}

function FacetAxisContent({
  axis,
  tagPrefixes,
  facetItems,
  worksQueryKey,
  isFacetLoading,
  isFacetError,
  onDrillSelect,
  onRetryFacets,
}: FacetAxisContentProps) {
  const listRef = useRef<HTMLDivElement>(null);
  useResetListScrollOnQueryKeyChange(worksQueryKey, listRef);
  return (
    <div className="mle-col is-content">
      <div className="mle-col__hd">
        <span>{getAxisLabel(axis, tagPrefixes)}</span>
        {!isFacetLoading && <span className="count">{facetItems.length} 件</span>}
      </div>
      <div ref={listRef} className="mle-col__list">
        {isFacetLoading ? (
          <CollectionStatus variant="list" kind="loading" />
        ) : isFacetError && facetItems.length === 0 ? (
          // キャッシュが無い＝初回取得失敗のときだけ一覧全体をエラー画面に置き換える。
          <CollectionStatus variant="list" kind="error" onRetry={onRetryFacets} />
        ) : (
          <>
            {/* 再取得の失敗でもReact Queryはキャッシュ済みのfacetItemsを保持したまま
                isError=trueになる。キャッシュがある場合は一覧を残し、非ブロッキングの
                エラー行＋再試行だけを出す（190b0b2のタグ軸と同じパターン）。 */}
            {isFacetError && (
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- AxisColumnの分類軸エラーと同様、role="status"で非ブロッキング通知にする
              <div className="mll-axis-error" role="status" aria-live="polite">
                <span>{getAxisLabel(axis, tagPrefixes)}の取得に失敗しました</span>
                {onRetryFacets && (
                  <Button variant="ghost" icon={I.refresh} onClick={onRetryFacets}>
                    再試行
                  </Button>
                )}
              </div>
            )}
            {facetItems.length === 0 ? (
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
          </>
        )}
      </div>
    </div>
  );
}

interface WorksListContentProps {
  axis: AxisId;
  works: WorkListItem[];
  worksQueryKey: string;
  tagPrefixes: TagPrefix[];
  selectedWorkId: string | null;
  searchQuery: string;
  playingWorkId?: string;
  isPlaybackActive?: boolean;
  isLoading?: boolean;
  isError?: boolean;
  isPending?: boolean;
  hasNextPage?: boolean;
  worksTotal?: number;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onWorkSelect: (id: string) => void;
  onClearSearch: () => void;
  onRetryWorks?: () => void;
}

function WorksListContent({
  axis,
  works,
  worksQueryKey,
  tagPrefixes,
  selectedWorkId,
  searchQuery,
  playingWorkId,
  isPlaybackActive,
  isLoading,
  isError,
  isPending = false,
  hasNextPage = false,
  worksTotal,
  isFetchingNextPage = false,
  onLoadMore,
  onWorkSelect,
  onClearSearch,
  onRetryWorks,
}: WorksListContentProps) {
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
    <div className={`mle-col is-content ${isPending ? "is-pending" : ""}`}>
      <div className="mle-col__hd">
        <span>{isSmartAxis(axis) ? "スマートフォルダー" : "作品"}</span>
        {worksTotal != null && <span className="count">{worksTotal} 件</span>}
      </div>
      <div ref={listRef} className="mle-col__list">
        {isLoading ? (
          <CollectionStatus variant="list" kind="loading" />
        ) : isError ? (
          <CollectionStatus variant="list" kind="error" onRetry={onRetryWorks} />
        ) : works.length === 0 ? (
          <CollectionStatus
            variant="list"
            kind="empty"
            message={buildEmptyWorksMessage(searchQuery, null, null, tagPrefixes)}
            hint={buildEmptyWorksHint(axis, Boolean(searchQuery))}
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
  isPending,
  isFacetLoading,
  isFacetError,
  isTagPrefixesError,
  hasNextPage = false,
  worksTotal,
  isFetchingNextPage = false,
  onLoadMore,
  onWorkSelect,
  onDrillSelect,
  onTagToggle,
  onClearSearch,
  onRetryWorks,
  onRetryFacets,
  onRetryTagPrefixes,
}: ContentColumnProps) {
  if (axis === "tag") {
    return (
      <TagAxisContent
        facetItems={facetItems}
        tagPrefixes={tagPrefixes}
        selectedTags={selectedTags}
        worksTotal={worksTotal}
        worksQueryKey={worksQueryKey}
        isFacetLoading={isFacetLoading}
        isFacetError={isFacetError}
        isTagPrefixesError={isTagPrefixesError}
        onTagToggle={onTagToggle}
        onRetryFacets={onRetryFacets}
        onRetryTagPrefixes={onRetryTagPrefixes}
      />
    );
  }

  if (isFacetAxis(axis)) {
    return (
      <FacetAxisContent
        axis={axis}
        tagPrefixes={tagPrefixes}
        facetItems={facetItems}
        worksQueryKey={worksQueryKey}
        isFacetLoading={isFacetLoading}
        isFacetError={isFacetError}
        onDrillSelect={onDrillSelect}
        onRetryFacets={onRetryFacets}
      />
    );
  }

  return (
    <WorksListContent
      axis={axis}
      works={works}
      worksQueryKey={worksQueryKey}
      tagPrefixes={tagPrefixes}
      selectedWorkId={selectedWorkId}
      searchQuery={searchQuery}
      playingWorkId={playingWorkId}
      isPlaybackActive={isPlaybackActive}
      isLoading={isLoading}
      isError={isError}
      isPending={isPending}
      hasNextPage={hasNextPage}
      worksTotal={worksTotal}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={onLoadMore}
      onWorkSelect={onWorkSelect}
      onClearSearch={onClearSearch}
      onRetryWorks={onRetryWorks}
    />
  );
}
