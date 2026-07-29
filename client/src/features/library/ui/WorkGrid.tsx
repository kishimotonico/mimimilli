import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useAtom, useAtomValue } from "jotai";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AxisId } from "../model/types";
import { libraryGridLayoutModeAtom, libraryTileSizeAtom, tagPrefixesAtom } from "../model/atoms";
import type { WorkListItem } from "@mimimilli/shared";
import CoverImg from "../../../entities/work/ui/CoverImg";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import {
  GRID_COLUMN_GAP,
  GRID_ROW_GAP,
  GRID_TILE_CHROME_HEIGHT,
  clampTileSize,
  computeGridColumnCount,
  selectCoverThumbnailWidth,
} from "../model/gridSizing";
import {
  getNextGridIndex,
  getNextJustifiedIndex,
  type GridArrowKey,
} from "../model/gridNavigation";
import { computeJustifiedLayout, type JustifiedLayout } from "../model/justifiedLayout";
import { shouldLoadMore } from "../model/virtualScroll";
import { buildEmptyWorksMessage } from "../model/emptyWorks";
import { isFacetAxis, isSmartAxis } from "../model/axisDefinitions";
import CollectionStatus from "./CollectionStatus";
import DrillHeader from "./DrillHeader";
import LoadMore from "./LoadMore";

interface WorkGridProps {
  axis: AxisId;
  drillValue: string | null;
  works: WorkListItem[];
  /** 検索・軸・ソート・タグ・ドリル変更を検知してスクロール位置をリセットする key */
  worksQueryKey: string;
  selectedWorkId: string | null;
  searchQuery: string;
  isLoading: boolean;
  isError: boolean;
  /** 次ページがあるか（追加読み込みボタンの表示判定。TASK-73） */
  hasNextPage?: boolean;
  /** サーバー側の総件数（残件数の表示用） */
  worksTotal?: number;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onWorkSelect: (id: string) => void;
  onWorkPlay: (work: WorkListItem) => void;
  onDrillBack: () => void;
  onClearSearch: () => void;
  inspector: ReactNode | null;
  onInspectorClose: () => void;
}

const GRID_ARROW_KEYS = new Set<GridArrowKey>(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

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
  drillValue,
  works,
  worksQueryKey,
  selectedWorkId,
  searchQuery,
  isLoading,
  isError,
  hasNextPage = false,
  worksTotal,
  isFetchingNextPage = false,
  onLoadMore,
  onWorkSelect,
  onWorkPlay,
  onDrillBack,
  onClearSearch,
  inspector,
  onInspectorClose,
}: WorkGridProps) {
  const tagPrefixes = useAtomValue(tagPrefixesAtom);
  const [tileSize, setTileSize] = useAtom(libraryTileSizeAtom);
  const gridLayoutMode = useAtomValue(libraryGridLayoutModeAtom);
  const safeTileSize = clampTileSize(tileSize);
  const isDrilled = drillValue !== null;
  const paneRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInspectorOpen = inspector !== null;

  // .mll-grid のコンテンツ幅（padding除く）。1:1タイルの列数計算・ジャスティファイドの
  // 行幅計算の両方で使う。ref にコールバックを使うのは、works の読み込み前後で
  // .mll-grid 自体が CollectionStatus とマウント/アンマウントされ、
  // useRef + useEffect だけでは DOM 出現タイミングを取り逃すため。
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [paddingEnd, setPaddingEnd] = useState(GRID_PADDING_END_BASE);

  useEffect(() => {
    if (!gridEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(gridEl);
    return () => observer.disconnect();
  }, [gridEl]);

  // ドッキングバー表示状態を検知してスクロール終端の余白を調整する。
  useEffect(() => {
    const app = paneRef.current?.closest(".mle-app");
    if (!app) return;
    const update = () => {
      setPaddingEnd(
        app.classList.contains("has-docked-bar")
          ? GRID_PADDING_END_BASE + GRID_DOCKED_BAR_EXTRA
          : GRID_PADDING_END_BASE,
      );
    };
    const observer = new MutationObserver(update);
    observer.observe(app, { attributes: true, attributeFilter: ["class"] });
    update();
    return () => observer.disconnect();
  }, []);

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
    if (!isInspectorOpen) return;

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

      onInspectorClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isInspectorOpen, onInspectorClose]);

  useEffect(() => {
    if (!isInspectorOpen) return;
    const scroll = scrollRef.current;
    if (!scroll) return;

    const handleGridBackgroundClick = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".mll-grid-tile")) return;
      onInspectorClose();
    };

    scroll.addEventListener("click", handleGridBackgroundClick);
    return () => scroll.removeEventListener("click", handleGridBackgroundClick);
  }, [isInspectorOpen, onInspectorClose]);

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
    [gridEl, gridLayoutMode, justifiedLayout, columnCount, works.length, virtualizer],
  );

  const renderTile = useCallback(
    (
      work: WorkListItem,
      flatIndex: number,
      tileWidth: number | undefined,
      coverHeight: number | undefined,
    ) => {
      const requestWidth = selectCoverThumbnailWidth(
        tileWidth ?? safeTileSize,
        window.devicePixelRatio,
      );

      return (
        <button
          key={work.id}
          type="button"
          className={`mll-grid-tile ${work.id === selectedWorkId ? "is-on" : ""}`}
          data-flat-index={flatIndex}
          aria-label={`${work.title}を選択`}
          aria-pressed={work.id === selectedWorkId}
          style={tileWidth !== undefined ? { width: tileWidth } : undefined}
          onClick={() => onWorkSelect(work.id)}
          onDoubleClick={() => onWorkPlay(work)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onWorkPlay(work);
              return;
            }
            if (!GRID_ARROW_KEYS.has(event.key as GridArrowKey)) return;
            event.preventDefault();
            moveTileFocus(flatIndex, event.key as GridArrowKey);
          }}
        >
          <span
            className="mll-grid-tile__cover"
            style={coverHeight !== undefined ? { height: coverHeight } : undefined}
          >
            <CoverImg
              id={work.id}
              title={work.title}
              cover={work.cover}
              fit="fill"
              radius={6}
              requestWidth={requestWidth}
              loading="lazy"
            />
          </span>
          <span className="mll-grid-tile__title">{work.title}</span>
          <span className="mll-grid-tile__circle">{work.circleName ?? "サークル不明"}</span>
        </button>
      );
    },
    [selectedWorkId, safeTileSize, onWorkSelect, onWorkPlay, moveTileFocus],
  );

  const renderRow = useCallback(
    (rowIndex: number) => {
      if (gridLayoutMode === "justified" && justifiedLayout) {
        const row = justifiedRows[rowIndex];
        if (!row) return null;
        return (
          <div className="mll-grid-row">
            {row.entries.map((entry) =>
              renderTile(entry.work, entry.flatIndex, entry.width, row.height),
            )}
          </div>
        );
      }

      const start = rowIndex * columnCount;
      const rowWorks = works.slice(start, start + columnCount);
      return (
        <div
          className="mll-grid-row mll-grid-row--square"
          style={
            {
              display: "grid",
              gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
              gap: `var(--grid-col-gap)`,
            } as CSSProperties
          }
        >
          {rowWorks.map((work, i) => renderTile(work, start + i, undefined, undefined))}
        </div>
      );
    },
    [gridLayoutMode, justifiedLayout, justifiedRows, columnCount, works, renderTile],
  );

  return (
    <section
      ref={paneRef}
      className={`mll-grid-pane ${isInspectorOpen ? "is-inspector-open" : ""}`}
      aria-label="作品グリッド"
    >
      {isDrilled ? (
        <DrillHeader
          axisLabel={axis}
          value={drillValue}
          count={works.length}
          onBack={onDrillBack}
        />
      ) : (
        <div className="mle-col__hd">
          <span>{isSmartAxis(axis) ? "スマートフォルダー" : "作品"}</span>
          <span className="count">{works.length} 件</span>
        </div>
      )}
      <div ref={scrollRef} className="mll-grid-scroll">
        {isLoading ? (
          <CollectionStatus variant="grid" kind="loading" />
        ) : isError ? (
          <CollectionStatus variant="grid" kind="error" />
        ) : works.length === 0 ? (
          <CollectionStatus
            variant="grid"
            kind="empty"
            message={buildEmptyWorksMessage(
              searchQuery,
              isDrilled && isFacetAxis(axis) ? axis : null,
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
                {renderRow(virtualRow.index)}
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
      {inspector}
    </section>
  );
}
