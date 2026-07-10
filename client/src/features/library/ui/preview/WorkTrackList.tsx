import type { Track } from "@mimimilli/shared";
import { I } from "../../../../shared/ui/Icon";
import { formatDuration, formatTime } from "../../../../shared/lib/format";
import { cn } from "../../../../shared/lib/cn";

interface WorkTrackListProps {
  tracks: Track[];
  isPlayable: boolean;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  hasResume: boolean;
  resumeTrackIndex: number;
  resumePosition: number;
  onPlay: (trackIndex: number) => void;
}

export function WorkTrackList({
  tracks,
  isPlayable,
  playingTrackIndex,
  isPlaybackActive,
  hasResume,
  resumeTrackIndex,
  resumePosition,
  onPlay,
}: WorkTrackListProps) {
  if (tracks.length === 0) return null;

  return (
    <>
      <div className="mle-sect">
        <span>トラック</span>
        <div className="mle-sect__rule" />
      </div>
      <div className="mle-prv__tracks">
        {tracks.map((tr, i) => {
          const isNowPlaying = playingTrackIndex === i;
          return (
            <button
              type="button"
              key={i}
              className={cn(
                "group mle-prv__trk",
                isNowPlaying && "is-now",
                hasResume && resumeTrackIndex === i && "is-resume",
                !isPlayable && "is-disabled",
              )}
              disabled={!isPlayable}
              aria-label={`${tr.title}を再生`}
              // 行全体がトラックの再生操作。右端のアイコンは補助的な視覚ヒントで、
              // 独立したボタンではない（トラックに「選択」概念は持たせない）。
              onClick={() => {
                if (isPlayable) onPlay(i);
              }}
            >
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
              <span className="name">
                <span className="title">{tr.title}</span>
                {hasResume && resumeTrackIndex === i && (
                  <span className="resume">再開 {formatTime(resumePosition)}</span>
                )}
              </span>
              {tr.end != null && tr.start != null && (
                <span className="dur">{formatDuration(Math.round(tr.end - tr.start))}</span>
              )}
              <div className="src">
                {isNowPlaying ? (
                  <span
                    className="mle-icbtn inline-flex items-center gap-[1px] text-acc"
                    aria-hidden="true"
                  >
                    {[6, 10, 8].map((height, barIndex) => (
                      <span
                        key={height}
                        className={cn(
                          "block w-[2px] origin-bottom rounded-[1px] bg-current motion-reduce:animate-none",
                          isPlaybackActive &&
                            "motion-safe:animate-[mll-eq-bar_840ms_ease-in-out_infinite]",
                        )}
                        style={{ height, animationDelay: `${barIndex * 120}ms` }}
                      />
                    ))}
                  </span>
                ) : (
                  <span
                    className="mle-icbtn opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                    aria-hidden="true"
                  >
                    <I.play size={11} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
