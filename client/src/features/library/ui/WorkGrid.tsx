import { useEffect, useRef, type CSSProperties } from "react";
import type { AxisId } from "../model/types";
import type { WorkSummary } from "@mimimilli/shared";
import CoverImg from "../../../entities/work/ui/CoverImg";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import { clampTileSize, selectCoverThumbnailWidth } from "../model/gridSizing";
import DrillHeader from "./DrillHeader";

interface WorkGridProps {
  axis: AxisId;
  drillValue: string | null;
  works: WorkSummary[];
  selectedWorkId: string | null;
  searchQuery: string;
  tileSize: number;
  isLoading: boolean;
  isError: boolean;
  onTileSizeChange: (size: number) => void;
  onWorkSelect: (id: string) => void;
  onWorkPlay: (work: WorkSummary) => void;
  onDrillBack: () => void;
  onClearSearch: () => void;
}

function circleName(work: WorkSummary): string {
  const tag = work.tags.find(
    (value) => value.startsWith("サークル/") || value.startsWith("circle/"),
  );
  return tag?.slice(tag.indexOf("/") + 1) || "サークル不明";
}

export default function WorkGrid({
  axis,
  drillValue,
  works,
  selectedWorkId,
  searchQuery,
  tileSize,
  isLoading,
  isError,
  onTileSizeChange,
  onWorkSelect,
  onWorkPlay,
  onDrillBack,
  onClearSearch,
}: WorkGridProps) {
  const safeTileSize = clampTileSize(tileSize);
  const requestWidth = selectCoverThumbnailWidth(safeTileSize, window.devicePixelRatio);
  const isDrilled = drillValue !== null;
  const paneRef = useRef<HTMLElement>(null);

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

  return (
    <section ref={paneRef} className="mll-grid-pane" aria-label="作品グリッド">
      {isDrilled ? (
        <DrillHeader
          axisLabel={axis}
          value={drillValue}
          count={works.length}
          onBack={onDrillBack}
        />
      ) : (
        <div className="mle-col__hd">
          <span>{String(axis).startsWith("smart-") ? "スマートフォルダー" : "作品"}</span>
          <span className="count">{works.length} 件</span>
        </div>
      )}
      <div className="mll-grid-scroll">
        {isLoading ? (
          <div className="mll-grid-empty">読み込み中...</div>
        ) : isError ? (
          <div className="mll-grid-empty">読み込みに失敗しました</div>
        ) : works.length === 0 ? (
          <div className="mll-grid-empty">
            <span>
              {searchQuery
                ? `「${searchQuery}」に一致する作品はありません`
                : "作品が見つかりません"}
            </span>
            {searchQuery && (
              <Button variant="ghost" icon={I.x} onClick={onClearSearch}>
                検索をクリア
              </Button>
            )}
          </div>
        ) : (
          <div className="mll-grid" style={{ "--tile-size": `${safeTileSize}px` } as CSSProperties}>
            {works.map((work) => (
              <button
                key={work.id}
                type="button"
                className={`mll-grid-tile ${work.id === selectedWorkId ? "is-on" : ""}`}
                aria-label={`${work.title}を選択`}
                aria-pressed={work.id === selectedWorkId}
                onClick={() => onWorkSelect(work.id)}
                onDoubleClick={() => onWorkPlay(work)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  onWorkPlay(work);
                }}
              >
                <span className="mll-grid-tile__cover">
                  <CoverImg
                    id={work.id}
                    title={work.title}
                    hasCover={Boolean(work.coverImage)}
                    fit="fill"
                    radius={6}
                    requestWidth={requestWidth}
                    loading="lazy"
                  />
                </span>
                <span className="mll-grid-tile__title">{work.title}</span>
                <span className="mll-grid-tile__circle">{circleName(work)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
