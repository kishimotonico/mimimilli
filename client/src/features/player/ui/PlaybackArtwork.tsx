import CoverImg from "../../../entities/work/ui/CoverImg";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
import { I } from "../../../shared/ui/Icon";
import type { PlayerState } from "../model/usePlayerState";

interface PlaybackArtworkProps {
  state: Pick<PlayerState, "currentWork" | "isFilePlayback">;
  size: number;
  radius: number;
  fit?: "fixed" | "fill";
  requestWidth?: number;
}

export default function PlaybackArtwork({
  state,
  size,
  radius,
  fit = "fixed",
  requestWidth,
}: PlaybackArtworkProps) {
  if (state.isFilePlayback) {
    return (
      <div
        className="grid place-items-center bg-paper-2 text-ink-3"
        style={{ width: size, height: size, borderRadius: radius }}
        aria-hidden
      >
        <I.audio size={Math.round(size * 0.38)} />
      </div>
    );
  }

  if (!state.currentWork) return null;

  return (
    <CoverImg
      id={state.currentWork.id}
      title={state.currentWork.title}
      cover={state.currentWork.cover}
      size={size}
      radius={radius}
      fit={fit}
      requestWidth={requestWidth ?? selectFixedCoverThumbnailWidth(size, window.devicePixelRatio)}
    />
  );
}
