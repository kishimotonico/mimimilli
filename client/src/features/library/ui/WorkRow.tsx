import type { WorkSummary } from "@mimimilli/shared";
import CoverImg from "../../../entities/work/ui/CoverImg";
import { I } from "../../../shared/ui/Icon";
import { formatDuration } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";

interface WorkRowProps {
  work: WorkSummary;
  isSelected: boolean;
  isPlaying?: boolean;
  isPlaybackActive?: boolean;
  onSelect: () => void;
}

export default function WorkRow({ work, isSelected, isPlaying, isPlaybackActive, onSelect }: WorkRowProps) {
  const circleTag = work.tags.find((t) => t.startsWith("サークル/") || t.startsWith("circle/"));
  const circleValue = circleTag ? circleTag.split("/")[1] : null;

  const sub = [
    circleValue,
    work.trackCount > 0 ? `${work.trackCount}tr` : null,
    work.totalDurationSec > 0 ? formatDuration(work.totalDurationSec) : null,
  ].filter(Boolean).join(" · ");

  const statusLabel =
    work.status === "missing" ? "ファイル欠損"
    : work.status === "error" ? "メタ読み込みエラー"
    : null;

  return (
    <div className={`mll-wrow ${isSelected ? "is-on" : ""}`} onClick={onSelect}>
      <div className="mll-wrow__cv">
        <CoverImg id={work.id} title={work.title} hasCover={!!work.coverImage} size={32} radius={4} />
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
            role="img"
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
        {!isPlaying && work.bookmarked && <span className="fav"><I.starF size={10} /></span>}
      </div>
    </div>
  );
}
