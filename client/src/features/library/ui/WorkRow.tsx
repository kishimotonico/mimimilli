import type { WorkListItem } from "@mimimilli/shared";
import CoverImg from "../../../entities/work/ui/CoverImg";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
import { getWorkStatusLabel } from "../../../entities/work/workStatusLabel";
import { I } from "../../../shared/ui/Icon";
import { formatDuration } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";
import type { GridArrowKey } from "../model/gridNavigation";

const LIST_ARROW_KEYS = new Set<GridArrowKey>(["ArrowUp", "ArrowDown", "Home", "End"]);

interface WorkRowProps {
  work: WorkListItem;
  flatIndex: number;
  /** roving tabindexの現在位置と一致する場合だけ0（それ以外は-1）。
   *  一覧全体をTabストップ1個にする（TASK-428.12） */
  tabIndex: 0 | -1;
  isSelected: boolean;
  isPlaying?: boolean;
  isPlaybackActive?: boolean;
  onSelect: () => void;
  onPlay: () => void;
  onArrowKey: (flatIndex: number, key: GridArrowKey) => void;
}

export default function WorkRow({
  work,
  flatIndex,
  tabIndex,
  isSelected,
  isPlaying,
  isPlaybackActive,
  onSelect,
  onPlay,
  onArrowKey,
}: WorkRowProps) {
  const sub = [
    work.circleName,
    work.trackCount > 0 ? `${work.trackCount}tr` : null,
    work.totalDurationSec !== null && work.totalDurationSec > 0
      ? (formatDuration(work.totalDurationSec) ?? null)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const statusLabel = getWorkStatusLabel(work.status);
  const isPlayable = work.status === "ok";

  return (
    <button
      type="button"
      className={`mll-wrow ${isSelected ? "is-on" : ""}`}
      data-flat-index={flatIndex}
      tabIndex={tabIndex}
      aria-label={
        statusLabel
          ? `${work.title}を選択（${statusLabel}のため再生できません）`
          : `${work.title}を選択、Enterで再生`
      }
      aria-pressed={isSelected}
      onClick={onSelect}
      onDoubleClick={() => {
        if (isPlayable) onPlay();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (isPlayable) onPlay();
          return;
        }
        if (!LIST_ARROW_KEYS.has(event.key as GridArrowKey)) return;
        event.preventDefault();
        onArrowKey(flatIndex, event.key as GridArrowKey);
      }}
    >
      <div className="mll-wrow__cv">
        <CoverImg
          id={work.id}
          title={work.title}
          cover={work.cover}
          size={32}
          radius={4}
          requestWidth={selectFixedCoverThumbnailWidth(32, window.devicePixelRatio)}
          loading="lazy"
        />
      </div>
      <div className="mll-wrow__body">
        <span className="mll-wrow__title">
          {statusLabel && (
            <span className="mll-wrow__status" title={statusLabel}>
              <I.err size={11} />
            </span>
          )}
          {work.title}
        </span>
        {sub && <span className="mll-wrow__sub">{sub}</span>}
      </div>
      <div className="mll-wrow__meta">
        {isPlaying && (
          <span
            className="now inline-flex items-center gap-[1px]"
            aria-label={isPlaybackActive ? "再生中" : "一時停止中"}
            title={isPlaybackActive ? "再生中" : "一時停止中"}
          >
            {[6, 10, 8].map((height, i) => (
              <span
                key={height}
                aria-hidden="true"
                className={cn(
                  "block w-[2px] origin-bottom rounded-[1px] bg-current motion-reduce:animate-none",
                  isPlaybackActive && "motion-safe:animate-[mll-eq-bar_840ms_ease-in-out_infinite]",
                )}
                style={{ height, animationDelay: `${i * 120}ms` }}
              />
            ))}
          </span>
        )}
        {!isPlaying && work.bookmarked && (
          <span className="fav">
            <I.starF size={10} />
          </span>
        )}
      </div>
    </button>
  );
}
