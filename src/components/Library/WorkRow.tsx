import type { WorkSummary } from "../../types";
import CoverImg from "../CoverImg";
import { I } from "../Icon";
import { formatDuration } from "../../hooks/usePlayer";

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

  return (
    <div className={`mll-wrow ${isSelected ? "is-on" : ""}`} onClick={onSelect}>
      <div className="mll-wrow__cv">
        <CoverImg id={work.id} title={work.title} hasCover={!!work.coverImage} size={32} radius={4} />
      </div>
      <div className="mll-wrow__body">
        <span className="mll-wrow__title">{work.title}</span>
        {sub && <span className="mll-wrow__sub">{sub}</span>}
      </div>
      <div className="mll-wrow__meta">
        {isPlaying && <span className="now">▸ 再生中</span>}
        {!isPlaying && work.bookmarked && <span className="fav"><I.starF size={10} /></span>}
        {!isPlaying && !work.bookmarked && (
          <span>{formatRelativeDate(work.addedAt)}</span>
        )}
      </div>
    </div>
  );
}
