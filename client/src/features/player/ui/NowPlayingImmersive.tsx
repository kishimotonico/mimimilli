// 再生中タブの没入モード本文。ビューポート全面のカバー＋環境光風の背景と、
// 最小限のオーバーレイ（切替アイコン・タイトル）だけで構成する。シーク行は
// NowPlayingView 側の永続スロットを使うため、ここでは持たない。

import { useRef } from "react";
import { motion, useIsPresent } from "motion/react";
import type { PlayerState } from "../model/usePlayerState";
import PlaybackArtwork from "./PlaybackArtwork";
import { useImmersiveIdle } from "../model/useImmersiveIdle";
import { useNowPlayingImmersiveShell } from "../model/useNowPlayingImmersiveShell";
import { getCoverImageUrl } from "../../../entities/work/api";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { I } from "../../../shared/ui/Icon";
import { cn } from "../../../shared/lib/cn";

/** ファイル再生・カバー欠損時のプレースホルダーの表示サイズ（正方形）。 */
const COVER_PLACEHOLDER_SIZE = 480;
/** 環境光風の背景は60pxブラーで潰れるため、小さいサムネイルで十分。 */
const AMBIENT_DISPLAY_SIZE = 96;

interface NowPlayingImmersiveProps {
  state: Pick<PlayerState, "currentWork" | "isFilePlayback" | "tracks" | "currentTrackIndex">;
  onTogglePlay: () => void;
  onExit: () => void;
}

export default function NowPlayingImmersive({
  state,
  onTogglePlay,
  onExit,
}: NowPlayingImmersiveProps) {
  const isPresent = useIsPresent();
  const { fade } = useMotionVariants();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const idle = useImmersiveIdle(isPresent);
  useNowPlayingImmersiveShell(isPresent, onExit, toggleRef);

  const { currentWork, isFilePlayback, tracks, currentTrackIndex } = state;
  const track = tracks[currentTrackIndex] ?? null;
  const ambientUrl =
    !isFilePlayback && currentWork?.cover
      ? getCoverImageUrl(
          currentWork.id,
          selectFixedCoverThumbnailWidth(AMBIENT_DISPLAY_SIZE, window.devicePixelRatio),
        )
      : null;

  return (
    <motion.div
      className="mle-nowplaying__immersive"
      inert={!isPresent}
      data-idle={idle || undefined}
      onClick={onTogglePlay}
      {...fade({ exitAbsolute: false })}
    >
      <div
        className="mle-nowplaying__immersive-ambient"
        aria-hidden
        style={ambientUrl ? { backgroundImage: `url(${ambientUrl})` } : undefined}
      />
      <div className="mle-nowplaying__immersive-scrim" aria-hidden />
      <div className="mle-nowplaying__immersive-cover">
        <PlaybackArtwork
          state={state}
          size={COVER_PLACEHOLDER_SIZE}
          radius={0}
          fit="fixed"
          objectFit="contain"
          requestWidth={selectFixedCoverThumbnailWidth(
            Math.min(window.innerWidth, 1920),
            window.devicePixelRatio,
          )}
        />
      </div>

      <button
        ref={toggleRef}
        type="button"
        aria-label="通常表示に戻す"
        title="通常表示に戻す"
        className={cn("mle-nowplaying__immersive-toggle", idle && "is-idle")}
        onClick={(e) => {
          e.stopPropagation();
          onExit();
        }}
      >
        <I.minimize size={16} />
      </button>

      <div className={cn("mle-nowplaying__immersive-title", idle && "is-idle")}>
        <div className="mle-nowplaying__immersive-eyebrow">
          {isFilePlayback ? "ファイル" : currentWork!.title}
        </div>
        <h1 className="mle-nowplaying__immersive-h1">{track?.title ?? "—"}</h1>
      </div>
    </motion.div>
  );
}
