import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useAtom, useAtomValue } from "jotai";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AxisId } from "../model/types";
import { libraryGridLayoutModeAtom, libraryTileSizeAtom } from "../model/atoms";
import type { WorkListItem } from "@mimimilli/shared";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import {
  GRID_COLUMN_GAP,
  GRID_ROW_GAP,
  GRID_TILE_CHROME_HEIGHT,
  clampTileSize,
  computeGridColumnCount,
} from "../model/gridSizing";
import {
  getNextGridIndex,
  getNextJustifiedIndex,
  type GridArrowKey,
} from "../model/gridNavigation";
import { computeJustifiedLayout, type JustifiedLayout } from "../model/justifiedLayout";
import { shouldLoadMore } from "../model/virtualScroll";
import { buildEmptyWorksHint, buildEmptyWorksMessage } from "../model/emptyWorks";
import { isSmartAxis } from "../model/axisDefinitions";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import LoadMore from "./LoadMore";
import WorkGridRow from "./WorkGridRow";
import { dockedBarActiveAtom } from "../../player/model/atoms";

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
  isLoading: boolean;
  isError: boolean;
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
  /** 作品一覧取得の再試行（isError 時） */
  onRetryWorks?: () => void;
  /** スマートフォルダー軸のときだけ渡すルール表示・編集導線（結果面ヘッダー直下に置く。
   *  ADR-0012 §3 のレイアウト固定により、プレビュー側ではなく結果面自体が持つ） */
  smartFolderBanner?: ReactNode;
}

interface JustifiedRowGroup {
  rowIndex: number;
  height: number;
  entries: { work: WorkListItem; width: number; flatIndex: number }[];
}

// justifiedLayout.tiles（入力 works と同順序・同長さ）を行ごとにグルーピングする（レンダリング用）。
function groupJustifiedRows(works: WorkListItem[], layout: JustifiedLayout): JustifiedRowGroup[] {
  const rows: JustifiedRowGroup[] = [];
  layout.tiles.forEach((tile, flatIndex) => {
    const work = works[flatIndex];
    if (!work) return;
    let row = rows[tile.rowIndex];
    if (!row) {
      row = { rowIndex: tile.rowIndex, height: layout.rowHeights[tile.rowIndex] ?? 0, entries: [] };
      rows[tile.rowIndex] = row;
    }
    row.entries.push({ work, width: tile.width, flatIndex });
  });
  return rows;
}

/** スクロールコンテナ (.mll-grid) の padding を virtualizer に反映する */
const GRID_PADDING_START = 16;
const GRID_PADDING_END_BASE = 16;
/** .mle-app.has-docked-bar の際の追加余白（TASK-59: スクロール終端が見切れないよう） */
const GRID_DOCKED_BAR_EXTRA = 28;

export default function WorkGrid({
  axis,
  works,
  worksQueryKey,
  selectedWorkId,
  searchQuery,
  hasSelectedTags,
  playingWorkId = null,
  isPlaybackActive = false,
  isLoading,
  isError,
  isPending = false,
  hasNextPage = false,
  worksTotal,
  isFetchingNextPage = false,
  onLoadMore,
  onWorkSelect,
  onWorkPlay,
  onClearSearch,
  onDeselect,
  onRetryWorks,
  smartFolderBanner,
}: WorkGridProps) {
  const [tileSize, setTileSize] = useAtom(libraryTileSizeAtom);
  const gridLayoutMode = useAtomValue(libraryGridLayoutModeAtom);
  const safeTileSize = clampTileSize(tileSize);
  const paneRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 作品選択中かどうか。Escape・グリッド背景クリックでの選択解除を有効にする条件に使う。
  const isWorkSelected = selectedWorkId !== null;

  // .mll-grid のコンテンツ幅（padding除く）。1:1タイルの列数計算・ジャスティファイドの
  // 行幅計算の両方で使う。ref にコールバックを使うのは、works の読み込み前後で
  // .mll-grid 自体が CollectionStatus とマウント/アンマウントされ、
  // useRef + useEffect だけでは DOM 出現タイミングを取り逃すため。
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const dockedBarActive = useAtomValue(dockedBarActiveAtom);
  const paddingEnd = dockedBarActive
    ? GRID_PADDING_END_BASE + GRID_DOCKED_BAR_EXTRA
    : GRID_PADDING_END_BASE;

  // layout effect でマウント直後に同期測定してから初回ペイントさせる。
  // ResizeObserver のコールバックはブラウザが非同期にスケジュールするため、
  // それだけに頼るとマウント直後の1フレームが containerWidth=0 のまま描画され空白になる。
  useLayoutEffect(() => {
    if (!gridEl) return;
    setContainerWidth(gridEl.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(gridEl);
    return () => observer.disconnect();
  }, [gridEl]);

  const justifiedLayout = useMemo<JustifiedLayout | null>(() => {
    if (gridLayoutMode !== "justified" || containerWidth <= 0 || works.length === 0) return null;
    // アスペクト比はサーバー提供の cover.dimensions から確定させる（画像ロードを待たない）。
    // cover===null は「表示可能なカバーが無い」仕様として正方形プレースホルダで表す。
    const items = works.map((work) => ({
      id: work.id,
      aspectRatio: work.cover ? work.cover.dimensions.width / work.cover.dimensions.height : 1,
    }));
    return computeJustifiedLayout(items, {
      containerWidth,
      targetRowHeight: safeTileSize,
      gap: GRID_COLUMN_GAP,
    });
  }, [gridLayoutMode, containerWidth, works, safeTileSize]);

  const justifiedRows = useMemo(
    () => (justifiedLayout ? groupJustifiedRows(works, justifiedLayout) : []),
    [justifiedLayout, works],
  );

  const columnCount = useMemo(
    () => computeGridColumnCount(containerWidth, safeTileSize, GRID_COLUMN_GAP),
    [containerWidth, safeTileSize],
  );

  const rowCount = useMemo(
    () =>
      gridLayoutMode === "justified" ? justifiedRows.length : Math.ceil(works.length / columnCount),
    [gridLayoutMode, justifiedRows.length, works.length, columnCount],
  );

  const estimateSize = useCallback(
    (index: number) => {
      if (gridLayoutMode === "justified") {
        return (justifiedLayout?.rowHeights[index] ?? 0) + GRID_TILE_CHROME_HEIGHT;
      }
      // square: 行高 = タイル実寸 + chrome。containerWidth=0 の間は仮に目標値を返す。
      const tileWidth =
        containerWidth > 0
          ? (containerWidth - (columnCount - 1) * GRID_COLUMN_GAP) / columnCount
          : safeTileSize;
      return tileWidth + GRID_TILE_CHROME_HEIGHT;
    },
    [gridLayoutMode, justifiedLayout, containerWidth, columnCount, safeTileSize],
  );

  // 両モードとも行高はレイアウト計算（justified は cover.dimensions 由来）で確定するため、
  // DOM 実測ではなく estimateSize をそのまま採用する。
  const measureElement = useCallback(
    (element: HTMLDivElement) => estimateSize(Number(element.getAttribute("data-index"))),
    [estimateSize],
  );

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 5,
    gap: GRID_ROW_GAP,
    paddingStart: GRID_PADDING_START,
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
    if (shouldLoadMore(virtualItems, rowCount, virtualizer.options.overscan)) {
      onLoadMore();
    }
  }, [virtualItems, hasNextPage, isFetchingNextPage, onLoadMore, rowCount, virtualizer]);

  // justified の行高はリサイズ・ページ追加でレイアウトが再計算されると変わるため、measure で伝える。
  useEffect(() => {
    if (gridLayoutMode !== "justified") return;
    virtualizer.measure();
  }, [gridLayoutMode, justifiedLayout, virtualizer]);

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setTileSize(clampTileSize(safeTileSize - event.deltaY * 0.1));
    };

    pane.addEventListener("wheel", handleWheel, { passive: false });
    return () => pane.removeEventListener("wheel", handleWheel);
  }, [setTileSize, safeTileSize]);

  useEffect(() => {
    if (!isWorkSelected) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;

      const target = event.target instanceof Element ? event.target : null;
      if (
        document.querySelector("dialog[open]") ||
        target?.closest('dialog, [role="dialog"]') ||
        target?.closest('input, textarea, select, [contenteditable="true"], [aria-expanded="true"]')
      ) {
        return;
      }

      onDeselect();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isWorkSelected, onDeselect]);

  useEffect(() => {
    if (!isWorkSelected) return;
    const scroll = scrollRef.current;
    if (!scroll) return;

    const handleGridBackgroundClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".mll-grid-tile")) return;
      onDeselect();
    };

    scroll.addEventListener("click", handleGridBackgroundClick);
    return () => scroll.removeEventListener("click", handleGridBackgroundClick);
  }, [isWorkSelected, onDeselect]);

  // 2次元キーボードナビ（TASK-45）。DOM 計測（querySelectorAll）をやめ、
  // レイアウト計算済みの columnCount / justifiedLayout.tiles から次インデックスを求める。
  const moveTileFocus = useCallback(
    (currentIndex: number, key: GridArrowKey) => {
      if (!gridEl) return;

      const nextIndex =
        gridLayoutMode === "justified" && justifiedLayout
          ? getNextJustifiedIndex(justifiedLayout.tiles, currentIndex, key)
          : getNextGridIndex(currentIndex, key, columnCount, works.length);
      if (nextIndex === currentIndex) return;

      const rowIndex =
        gridLayoutMode === "justified" && justifiedLayout
          ? justifiedLayout.tiles[nextIndex]?.rowIndex
          : Math.floor(nextIndex / columnCount);
      if (rowIndex === undefined || rowIndex < 0) return;

      const nextWork = works[nextIndex];
      if (nextWork) onWorkSelect(nextWork.id);

      virtualizer.scrollToIndex(rowIndex, { align: "auto" });

      let attempts = 0;
      const tryFocus = () => {
        if (attempts++ > 20) return;
        const tile = gridEl.querySelector<HTMLElement>(`[data-flat-index="${nextIndex}"]`);
        if (tile) {
          tile.focus({ preventScroll: true });
          tile.scrollIntoView({ block: "nearest", inline: "nearest" });
        } else {
          requestAnimationFrame(tryFocus);
        }
      };
      requestAnimationFrame(tryFocus);
    },
    [gridEl, gridLayoutMode, justifiedLayout, columnCount, works, onWorkSelect, virtualizer],
  );

  const rowTileProps = {
    selectedWorkId,
    playingWorkId,
    isPlaybackActive,
    safeTileSize,
    onWorkSelect,
    onWorkPlay,
    onTileArrowKey: moveTileFocus,
  };

  const renderVirtualRow = (rowIndex: number) => {
    if (gridLayoutMode === "justified" && justifiedLayout) {
      const row = justifiedRows[rowIndex];
      if (!row) return null;
      return (
        <WorkGridRow
          mode="justified"
          rowHeight={row.height}
          entries={row.entries}
          {...rowTileProps}
        />
      );
    }

    const start = rowIndex * columnCount;
    return (
      <WorkGridRow
        mode="square"
        columnCount={columnCount}
        works={works.slice(start, start + columnCount)}
        startIndex={start}
        {...rowTileProps}
      />
    );
  };

  return (
    <section
      ref={paneRef}
      className={`mll-grid-pane ${isPending ? "is-pending" : ""}`}
      aria-label="作品グリッド"
    >
      <div className="mle-col__hd">
        <span>{isSmartAxis(axis) ? "スマートフォルダー" : "作品"}</span>
        {worksTotal != null && <span className="count">{worksTotal} 件</span>}
      </div>
      {smartFolderBanner}
      <div className="mll-grid-body">
        <div ref={scrollRef} className="mll-grid-scroll">
          {isLoading ? (
            <CollectionStatus variant="grid" kind="loading" />
          ) : isError ? (
            <CollectionStatus variant="grid" kind="error" onRetry={onRetryWorks} />
          ) : works.length === 0 ? (
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
            <div
              ref={setGridEl}
              className={`mll-grid ${gridLayoutMode === "justified" ? "mll-grid--justified" : ""}`}
              style={
                {
                  position: "relative",
                  width: "100%",
                  height: `${virtualizer.getTotalSize()}px`,
                  "--tile-size": `${safeTileSize}px`,
                  "--grid-row-gap": `${GRID_ROW_GAP}px`,
                  "--grid-col-gap": `${GRID_COLUMN_GAP}px`,
                  "--tile-chrome-h": `${GRID_TILE_CHROME_HEIGHT}px`,
                } as CSSProperties
              }
            >
              {virtualizer.getVirtualItems().map((virtualRow) => (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={
                    {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    } as CSSProperties
                  }
                >
                  {renderVirtualRow(virtualRow.index)}
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
    </section>
  );
}
