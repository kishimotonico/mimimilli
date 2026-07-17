import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useAtomValue } from "jotai";
import type { AxisId, GridLayoutMode } from "../model/types";
import { tagPrefixesAtom } from "../model/atoms";
import type { WorkSummary } from "@mimimilli/shared";
import CoverImg from "../../../entities/work/ui/CoverImg";
import { getCircleName } from "../../../entities/work/model";
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
  countGridColumns,
  getNextGridIndex,
  getNextJustifiedIndex,
  type GridArrowKey,
} from "../model/gridNavigation";
import { computeJustifiedLayout, type JustifiedLayout } from "../model/justifiedLayout";
import { buildEmptyWorksMessage } from "../model/emptyWorks";
import { isFacetAxis, isSmartAxis } from "../model/axisDefinitions";
import CollectionStatus from "./CollectionStatus";
import DrillHeader from "./DrillHeader";

interface WorkGridProps {
  axis: AxisId;
  drillValue: string | null;
  works: WorkSummary[];
  selectedWorkId: string | null;
  searchQuery: string;
  tileSize: number;
  gridLayoutMode: GridLayoutMode;
  isLoading: boolean;
  isError: boolean;
  onTileSizeChange: (size: number) => void;
  onWorkSelect: (id: string) => void;
  onWorkPlay: (work: WorkSummary) => void;
  onDrillBack: () => void;
  onClearSearch: () => void;
  inspector: ReactNode | null;
  onInspectorClose: () => void;
}

const GRID_ARROW_KEYS = new Set<GridArrowKey>(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

interface JustifiedRowGroup {
  rowIndex: number;
  height: number;
  entries: { work: WorkSummary; width: number; flatIndex: number }[];
}

// justifiedLayout.tiles（入力 works と同順序・同長さ）を行ごとにグルーピングする（レンダリング用）。
function groupJustifiedRows(works: WorkSummary[], layout: JustifiedLayout): JustifiedRowGroup[] {
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

export default function WorkGrid({
  axis,
  drillValue,
  works,
  selectedWorkId,
  searchQuery,
  tileSize,
  gridLayoutMode,
  isLoading,
  isError,
  onTileSizeChange,
  onWorkSelect,
  onWorkPlay,
  onDrillBack,
  onClearSearch,
  inspector,
  onInspectorClose,
}: WorkGridProps) {
  const tagPrefixes = useAtomValue(tagPrefixesAtom);
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

  useEffect(() => {
    if (!gridEl) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(gridEl);
    return () => observer.disconnect();
  }, [gridEl]);

  // ジャスティファイド用のカバー実寸（アスペクト比）計測キャッシュ。
  // サーバーは画像寸法を返さないため、実際に読み込まれた <img> の
  // naturalWidth/naturalHeight から計測する（CoverImg.onLoadDimensions）。
  // works が入れ替わっても（軸切り替え等）このキャッシュは保持し、同じ作品の再計測を避ける。
  //
  // レイアウトシフト対策:
  //   - 未計測の作品はプレースホルダ比率 1:1 として扱う（初回レイアウトが破綻しない）
  //   - 画像読み込みが短時間に連続すると（初回マウント・高速スクロール時）その都度
  //     再レイアウトすると再描画が連発するため、rAF で1フレーム分バッチしてからまとめて state を更新する
  //   - それでも「未計測→実測」の切り替わり時に行の高さがずれる一度きりのシフトは
  //     サーバーに画像寸法がない以上避けられない（将来サーバー側で寸法を保持できれば解消できる）
  const [coverRatios, setCoverRatios] = useState<Map<string, number>>(() => new Map());
  const pendingRatiosRef = useRef<Map<string, number>>(new Map());
  const flushHandleRef = useRef<number | null>(null);

  const scheduleRatioFlush = useCallback(() => {
    if (flushHandleRef.current !== null) return;
    flushHandleRef.current = requestAnimationFrame(() => {
      flushHandleRef.current = null;
      setCoverRatios((prev) => {
        if (pendingRatiosRef.current.size === 0) return prev;
        const next = new Map(prev);
        for (const [id, ratio] of pendingRatiosRef.current) next.set(id, ratio);
        pendingRatiosRef.current.clear();
        return next;
      });
    });
  }, []);

  useEffect(
    () => () => {
      if (flushHandleRef.current !== null) cancelAnimationFrame(flushHandleRef.current);
    },
    [],
  );

  const handleCoverLoad = useCallback(
    (workId: string, naturalWidth: number, naturalHeight: number) => {
      if (naturalWidth <= 0 || naturalHeight <= 0) return;
      pendingRatiosRef.current.set(workId, naturalWidth / naturalHeight);
      scheduleRatioFlush();
    },
    [scheduleRatioFlush],
  );

  const justifiedLayout = useMemo<JustifiedLayout | null>(() => {
    if (gridLayoutMode !== "justified" || containerWidth <= 0 || works.length === 0) return null;
    const items = works.map((work) => ({
      id: work.id,
      aspectRatio: coverRatios.get(work.id) ?? 1,
    }));
    return computeJustifiedLayout(items, {
      containerWidth,
      targetRowHeight: safeTileSize,
      gap: GRID_COLUMN_GAP,
    });
  }, [gridLayoutMode, containerWidth, works, coverRatios, safeTileSize]);

  const justifiedRows = useMemo(
    () => (justifiedLayout ? groupJustifiedRows(works, justifiedLayout) : []),
    [justifiedLayout, works],
  );

  const columnCount = useMemo(
    () => computeGridColumnCount(containerWidth, safeTileSize, GRID_COLUMN_GAP),
    [containerWidth, safeTileSize],
  );

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      onTileSizeChange(clampTileSize(safeTileSize - event.deltaY * 0.1));
    };

    pane.addEventListener("wheel", handleWheel, { passive: false });
    return () => pane.removeEventListener("wheel", handleWheel);
  }, [onTileSizeChange, safeTileSize]);

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

  // 2次元キーボードナビ（TASK-45で両形式対応）。
  // 1:1タイルは列数が一定なので固定ストライドで、ジャスティファイドは行ごとに
  // アイテム数が不揃いなので justifiedLayout の行内中心x座標を使った近傍探索で移動する。
  const moveTileFocus = (currentIndex: number, key: GridArrowKey) => {
    if (!gridEl) return;

    const tiles = Array.from(gridEl.querySelectorAll<HTMLElement>(".mll-grid-tile"));
    const nextIndex =
      gridLayoutMode === "justified" && justifiedLayout
        ? getNextJustifiedIndex(justifiedLayout.tiles, currentIndex, key)
        : getNextGridIndex(
            currentIndex,
            key,
            countGridColumns(tiles.map((tile) => tile.offsetTop)),
            tiles.length,
          );
    if (nextIndex === currentIndex) return;

    const nextTile = tiles[nextIndex];
    nextTile?.focus({ preventScroll: true });
    nextTile?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const renderTile = (
    work: WorkSummary,
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
            hasCover={Boolean(work.coverImage)}
            fit="fill"
            radius={6}
            requestWidth={requestWidth}
            loading="lazy"
            onLoadDimensions={
              gridLayoutMode === "justified"
                ? (naturalWidth, naturalHeight) =>
                    handleCoverLoad(work.id, naturalWidth, naturalHeight)
                : undefined
            }
          />
        </span>
        <span className="mll-grid-tile__title">{work.title}</span>
        <span className="mll-grid-tile__circle">{getCircleName(work) ?? "サークル不明"}</span>
      </button>
    );
  };

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
                "--tile-size": `${safeTileSize}px`,
                "--grid-row-gap": `${GRID_ROW_GAP}px`,
                "--grid-col-gap": `${GRID_COLUMN_GAP}px`,
                "--tile-chrome-h": `${GRID_TILE_CHROME_HEIGHT}px`,
                ...(gridLayoutMode === "square" && containerWidth > 0
                  ? { gridTemplateColumns: `repeat(${columnCount}, 1fr)` }
                  : {}),
              } as CSSProperties
            }
          >
            {gridLayoutMode === "justified" && justifiedLayout
              ? justifiedRows.map((row) => (
                  <div
                    key={row.rowIndex}
                    className="mll-grid-row"
                    style={
                      {
                        containIntrinsicSize: `auto ${row.height + GRID_TILE_CHROME_HEIGHT}px`,
                      } as CSSProperties
                    }
                  >
                    {row.entries.map((entry) =>
                      renderTile(entry.work, entry.flatIndex, entry.width, row.height),
                    )}
                  </div>
                ))
              : works.map((work, index) => renderTile(work, index, undefined, undefined))}
          </div>
        )}
      </div>
      {inspector}
    </section>
  );
}
