import type { ResolvedTrack } from "@mimimilli/shared";
import { I } from "../../../../shared/ui/Icon";
import { formatDuration, formatTime } from "../../../../shared/lib/format";
import { cn } from "../../../../shared/lib/cn";

interface WorkTrackListProps {
  tracks: ResolvedTrack[];
  isPlayable: boolean;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  hasResume: boolean;
  resumeTrackId: string | null;
  resumeOffsetSec: number;
  onPlay: (trackIndex: number) => void;
}

export function WorkTrackList({
  tracks,
  isPlayable,
  playingTrackIndex,
  isPlaybackActive,
  hasResume,
  resumeTrackId,
  resumeOffsetSec,
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
              key={tr.id}
              className={cn(
                "group mle-prv__trk",
                isNowPlaying && "is-now",
                hasResume && resumeTrackId === tr.id && "is-resume",
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
                {hasResume && resumeTrackId === tr.id && (
                  <span className="resume">再開 {formatTime(resumeOffsetSec)}</span>
                )}
              </span>
              {tr.durationSec !== null && (
                <span className="dur">{formatDuration(Math.round(tr.durationSec))}</span>
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
