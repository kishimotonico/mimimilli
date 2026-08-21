import { formatDuration } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";
import type { PlaybackTrack } from "../model/trackTime";

interface NowPlayingTrackListProps {
  tracks: PlaybackTrack[];
  currentTrackIndex: number;
  onSelectTrack: (i: number) => void;
}

export default function NowPlayingTrackList({
  tracks,
  currentTrackIndex,
  onSelectTrack,
}: NowPlayingTrackListProps) {
  return (
    <div className="mle-nowplaying__tracklist-wrap">
      <div className="mle-nowplaying__tracklist-head">
        <b className="font-sans text-[13px] font-semibold text-ink-0">トラック</b>
        <small className="font-mono text-[10.5px] text-ink-3">{tracks.length} 件</small>
      </div>
      <div
        className="mle-nowplaying__tracklist"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- トラック行集合を名前付き集合として表す。fieldset等の代替タグは適合しない
        role="group"
        aria-label="トラック一覧"
      >
        <div className="flex flex-col gap-px">
          {tracks.map((t, i) => {
            const isCurrent = i === currentTrackIndex;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => onSelectTrack(i)}
                className={cn(
                  "grid cursor-pointer grid-cols-[28px_1fr_56px] items-center gap-2 rounded px-2 py-2",
                  isCurrent ? "bg-acc-soft" : "bg-transparent hover:bg-paper-2",
                )}
              >
                <span
                  className={cn("font-mono text-[11px]", isCurrent ? "text-acc" : "text-ink-3")}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]",
                    isCurrent ? "font-semibold text-acc-ink" : "font-normal text-ink-1",
                  )}
                >
                  {t.title}
                </span>
                <span className="text-right font-mono text-[11px] text-ink-3">
                  {t.end != null && t.start != null ? (formatDuration(t.end - t.start) ?? "") : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
