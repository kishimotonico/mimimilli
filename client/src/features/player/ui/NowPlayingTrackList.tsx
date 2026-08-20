import { useState } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { formatDuration } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";
import { I } from "../../../shared/ui/Icon";
import type { PlaybackTrack } from "../model/trackTime";

interface NowPlayingTrackListProps {
  tracks: PlaybackTrack[];
  currentTrackIndex: number;
  onSelectTrack: (i: number) => void;
}

interface TrackRowsProps {
  tracks: PlaybackTrack[];
  currentTrackIndex: number;
  onSelectTrack: (i: number) => void;
}

// 展開パネル本体。overflow:hidden の高さクリップは呼び出し側の motion.div が担う。
function TrackRows({ tracks, currentTrackIndex, onSelectTrack }: TrackRowsProps) {
  const { collapse } = useMotionVariants();
  const isPresent = useIsPresent();
  return (
    <motion.div style={{ overflow: "hidden" }} inert={!isPresent} {...collapse()}>
      <div className="flex flex-col gap-px pt-2">
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
              <span className={cn("font-mono text-[11px]", isCurrent ? "text-acc" : "text-ink-3")}>
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
    </motion.div>
  );
}

export default function NowPlayingTrackList({
  tracks,
  currentTrackIndex,
  onSelectTrack,
}: NowPlayingTrackListProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-6 border-t border-line-soft pt-4">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full cursor-pointer items-center gap-2 py-1 text-left"
      >
        <I.chevD
          size={14}
          className={cn("text-ink-3 transition-transform", expanded && "rotate-180")}
        />
        <b className="font-sans text-[13px] font-semibold text-ink-0">トラック</b>
        <small className="font-mono text-[10.5px] text-ink-3">{tracks.length} 件</small>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <TrackRows
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            onSelectTrack={onSelectTrack}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
