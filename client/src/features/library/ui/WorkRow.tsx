import type { WorkSummary } from "@mimimilli/shared";
import CoverImg from "../../../entities/work/ui/CoverImg";
import { I } from "../../../shared/ui/Icon";
import { formatDuration } from "../../../shared/lib/format";

interface WorkRowProps {
  work: WorkSummary;
  isSelected: boolean;
  isPlaying?: boolean;
  onSelect: () => void;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays} 日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 週間前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ヶ月前`;
  return `${Math.floor(diffDays / 365)} 年前`;
}

export default function WorkRow({ work, isSelected, isPlaying, onSelect }: WorkRowProps) {
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
          <span className="now inline-flex items-center gap-[1px]" role="img" aria-label="再生中" title="再生中">
            {[6, 10, 8].map((height, i) => (
              <span
                key={height}
                aria-hidden="true"
                className="block w-[2px] origin-bottom rounded-[1px] bg-current motion-safe:animate-[mll-eq-bar_840ms_ease-in-out_infinite] motion-reduce:animate-none"
                style={{ height, animationDelay: `${i * 120}ms` }}
              />
            ))}
          </span>
        )}
        {!isPlaying && work.bookmarked && <span className="fav"><I.starF size={10} /></span>}
        {!isPlaying && !work.bookmarked && (
          <span>{formatRelativeDate(work.addedAt)}</span>
        )}
      </div>
    </div>
  );
}
