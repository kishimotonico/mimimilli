// 再生中タブの没入モード本文。ビューポート全面のカバー＋環境光風の背景と、
// 最小限のオーバーレイ（切替アイコン・タイトル・マウスアクティブ時のミニ操作）だけで
// 構成する。シーク行は NowPlayingView 側の永続スロットを使うため、ここでは持たない。

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import type { PlayerState } from "../model/usePlayerState";
import { selectActiveTrackView } from "../../../entities/player/model/playerCoreState";
import PlaybackArtwork from "./PlaybackArtwork";
import NowPlayingImmersiveMiniControls from "./NowPlayingImmersiveMiniControls";
import { NOW_PLAYING_IMMERSIVE_IDLE_MS, useImmersiveIdle } from "../model/useImmersiveIdle";
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
/** 再生⇄一時停止バーストを画面に留める時間（ms）。退出アニメーション分は別途乗る。 */
const BURST_HOLD_MS = 380;

interface NowPlayingImmersiveProps {
  state: Pick<
    PlayerState,
    "currentWork" | "isFilePlayback" | "tracks" | "currentTrackIndex" | "isPlaying" | "volume"
  >;
  onTogglePlay: () => void;
  onExit: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSetVolume: (v: number) => void;
}

function ImmersivePlaybackBurst({ isPlaying, active }: { isPlaying: boolean; active: boolean }) {
  const { playbackBurst } = useMotionVariants();
  const [burst, setBurst] = useState<{ id: number; playing: boolean } | null>(null);
  const prevPlayingRef = useRef(isPlaying);
  const nextIdRef = useRef(0);

  useEffect(() => {
    if (!active || prevPlayingRef.current === isPlaying) {
      prevPlayingRef.current = isPlaying;
      return;
    }
    prevPlayingRef.current = isPlaying;
    nextIdRef.current += 1;
    const id = nextIdRef.current;
    setBurst({ id, playing: isPlaying });
    const timer = setTimeout(() => {
      setBurst((current) => (current?.id === id ? null : current));
    }, BURST_HOLD_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, active]);

  return (
    <div className="mle-nowplaying__immersive-burst-layer" aria-hidden>
      <AnimatePresence>
        {burst && (
          <motion.div
            key={burst.id}
            className="mle-nowplaying__immersive-burst"
            {...playbackBurst()}
          >
            {burst.playing ? <I.play size={34} /> : <I.pause size={34} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NowPlayingImmersive({
  state,
  onTogglePlay,
  onExit,
  onNext,
  onPrev,
  onSetVolume,
}: NowPlayingImmersiveProps) {
  const isPresent = useIsPresent();
  const { fade } = useMotionVariants();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const { currentWork, isFilePlayback, currentTrackIndex, isPlaying, volume } = state;
  // マウス移動・キー操作の監視は1箇所（このidle）に集約し、ミニコントロールへは
  // 表示用の値だけをpropsで渡す（window listener・timerの二重化を避ける）。
  const idle = useImmersiveIdle(isPresent);
  // タイトル・切替アイコンはトラック切替のたびに一定時間だけ再表示する
  // （ミニコントロールはこの再表示規則の対象外）。
  const [trackJustChanged, setTrackJustChanged] = useState(false);
  useEffect(() => {
    setTrackJustChanged(true);
    const timer = setTimeout(() => setTrackJustChanged(false), NOW_PLAYING_IMMERSIVE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [currentTrackIndex]);
  const titleIdle = idle && !trackJustChanged;
  useNowPlayingImmersiveShell(isPresent, onExit, toggleRef);

  const { workTitle, trackTitle } = selectActiveTrackView(state);
  const ambientUrl =
    !isFilePlayback && currentWork?.cover
      ? getCoverImageUrl(
          currentWork.id,
          currentWork.cover.version,
          selectFixedCoverThumbnailWidth(AMBIENT_DISPLAY_SIZE, window.devicePixelRatio),
        )
      : null;

  return (
    <motion.div
      className="mle-nowplaying__immersive"
      inert={!isPresent}
      data-idle={titleIdle || undefined}
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

      <ImmersivePlaybackBurst isPlaying={isPlaying} active={isPresent} />

      <button
        ref={toggleRef}
        type="button"
        aria-label="通常表示に戻す"
        title="通常表示に戻す"
        className={cn("mle-nowplaying__immersive-toggle", titleIdle && "is-idle")}
        onClick={(e) => {
          e.stopPropagation();
          onExit();
        }}
      >
        <I.minimize size={16} />
      </button>

      <div className={cn("mle-nowplaying__immersive-title", titleIdle && "is-idle")}>
        <div className="mle-nowplaying__immersive-eyebrow">{workTitle}</div>
        <h1 className="mle-nowplaying__immersive-h1">{trackTitle}</h1>
      </div>

      <NowPlayingImmersiveMiniControls
        idle={idle}
        isPlaying={isPlaying}
        volume={volume}
        onTogglePlay={onTogglePlay}
        onNext={onNext}
        onPrev={onPrev}
        onSetVolume={onSetVolume}
      />
    </motion.div>
  );
}
