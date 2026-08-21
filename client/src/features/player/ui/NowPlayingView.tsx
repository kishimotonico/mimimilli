// 再生中タブ本体。通常モード（左カバー / 右トラックリストの横長2カラム + 下部固定バー）と
// 没入モード（ビューポート全面カバー）を切り替える。
//
// シーク行（.mle-nowplaying__seek）はモードを問わず1回だけマウントする永続スロットで、
// NowPlayingScrub 自体をモードごとに作り分けない。周辺（2カラム本文⇄没入オーバーレイ）
// だけを AnimatePresence でクロスフェードし、シーク行の DOM ノード・位置・寸法は変えない。
//
// 高頻度更新の currentTime/duration は NowPlayingScrub leaf だけが購読する
// （docs/HANDOFF.md の設計、他の leaf は usePlayerState() の core 投影のみ購読）。

import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useAtom, useAtomValue } from "jotai";
import { playerIsActiveAtom, nowPlayingViewModeAtom } from "../../../entities/player/model/atoms";
import { usePlayerActions } from "../model/usePlayerActions";
import { usePlayerState, type PlayerState } from "../model/usePlayerState";
import PlaybackArtwork from "./PlaybackArtwork";
import PlaybackErrorNotice from "./PlaybackErrorNotice";
import NowPlayingScrub from "./NowPlayingScrub";
import NowPlayingImmersive from "./NowPlayingImmersive";
import NowPlayingTrackList from "./NowPlayingTrackList";
import PlayerTransportControls from "./PlayerTransportControls";
import ABRepeatBar from "./ABRepeatBar";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import Button from "../../../shared/ui/Button";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";

interface NowPlayingViewProps {
  onOpenWork: (workId: string) => void;
}

const COVER_MAX_SIZE = 480;

interface NowPlayingNormalBodyProps {
  state: PlayerState;
  onOpenWork: (workId: string) => void;
  onSelectTrack: (i: number) => void;
  onEnterImmersive: () => void;
  onTogglePlay: () => void;
  onSeekRelative: (d: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onSetLoop: (l: boolean) => void;
  onSetChannelSwap: (enabled: boolean) => void;
  onSetVolume: (v: number) => void;
  onSetABPoint: (point: "a" | "b") => void;
  onClearABRepeat: () => void;
}

function NowPlayingNormalBody({
  state,
  onOpenWork,
  onSelectTrack,
  onEnterImmersive,
  onTogglePlay,
  onSeekRelative,
  onNext,
  onPrev,
  onSetLoop,
  onSetChannelSwap,
  onSetVolume,
  onSetABPoint,
  onClearABRepeat,
}: NowPlayingNormalBodyProps) {
  const isPresent = useIsPresent();
  const { fade } = useMotionVariants();
  const { currentWork, isFilePlayback, tracks, currentTrackIndex, playbackError } = state;
  const track = tracks[currentTrackIndex] ?? null;

  return (
    <motion.div className="h-full min-h-0" inert={!isPresent} {...fade({ exitAbsolute: false })}>
      <div className="mle-nowplaying__body">
        <div className="mle-nowplaying__left">
          <button
            type="button"
            className="mle-nowplaying__cover-wrap"
            onClick={onEnterImmersive}
            aria-label="カバーを没入表示にする"
          >
            <div className="mle-nowplaying__cover">
              <PlaybackArtwork
                state={state}
                size={COVER_MAX_SIZE}
                radius={12}
                fit="fill"
                requestWidth={selectFixedCoverThumbnailWidth(
                  COVER_MAX_SIZE,
                  window.devicePixelRatio,
                )}
              />
            </div>
          </button>

          <div className="flex w-full min-w-0 shrink-0 flex-col items-center gap-1.5 text-center">
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {isFilePlayback ? "ファイル" : currentWork!.title}
            </div>
            <h1 className="m-0 max-w-full text-balance font-jp text-[24px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink-0">
              {track?.title ?? "—"}
            </h1>
          </div>

          <PlaybackErrorNotice
            error={playbackError}
            className="inline-flex min-w-0 max-w-full shrink-0 items-center gap-1 font-jp text-[10.5px] text-[var(--r-coral)]"
          />

          {!isFilePlayback && currentWork && (
            <Button
              variant="ghost"
              icon={I.info}
              className="shrink-0"
              onClick={() => onOpenWork(currentWork.id)}
            >
              この作品の詳細を見る
            </Button>
          )}
        </div>

        <div className="mle-nowplaying__right">
          <NowPlayingTrackList
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            onSelectTrack={onSelectTrack}
          />
        </div>

        <IconButton
          size="md"
          icon={I.fs}
          label="没入モードにする"
          onClick={onEnterImmersive}
          className="mle-nowplaying__mode-toggle"
        />
      </div>

      <div className="mle-nowplaying__bg" aria-hidden />
      <div className="mle-nowplaying__controls">
        <PlayerTransportControls
          isPlaying={state.isPlaying}
          volume={state.volume}
          loop={state.loop}
          channelSwap={state.channelSwap}
          onTogglePlay={onTogglePlay}
          onSeekRelative={onSeekRelative}
          onNext={onNext}
          onPrev={onPrev}
          onSetLoop={onSetLoop}
          onSetChannelSwap={onSetChannelSwap}
          onSetVolume={onSetVolume}
        />
        <ABRepeatBar
          abRepeat={state.abRepeat}
          onSetABPoint={onSetABPoint}
          onClearABRepeat={onClearABRepeat}
        />
      </div>
    </motion.div>
  );
}

export default function NowPlayingView({ onOpenWork }: NowPlayingViewProps) {
  const isActive = useAtomValue(playerIsActiveAtom);
  const state = usePlayerState();
  const actions = usePlayerActions();
  const [mode, setMode] = useAtom(nowPlayingViewModeAtom);

  if (!isActive) {
    return (
      <div className="flex h-full flex-col">
        <CollectionStatus variant="list" kind="empty" message="再生中の作品はありません" />
      </div>
    );
  }

  const isImmersive = mode === "immersive";

  return (
    <div className="mle-nowplaying" data-mode={mode}>
      <AnimatePresence initial={false}>
        {isImmersive ? (
          <NowPlayingImmersive
            key="immersive"
            state={state}
            onTogglePlay={actions.togglePlay}
            onExit={() => setMode("normal")}
          />
        ) : (
          <NowPlayingNormalBody
            key="normal"
            state={state}
            onOpenWork={onOpenWork}
            onSelectTrack={actions.setTrackIndex}
            onEnterImmersive={() => setMode("immersive")}
            onTogglePlay={actions.togglePlay}
            onSeekRelative={actions.seekRelative}
            onNext={actions.nextTrack}
            onPrev={actions.prevTrack}
            onSetLoop={actions.setLoop}
            onSetChannelSwap={actions.setChannelSwap}
            onSetVolume={actions.setVolume}
            onSetABPoint={actions.setABPoint}
            onClearABRepeat={actions.clearABRepeat}
          />
        )}
      </AnimatePresence>

      <div className="mle-nowplaying__seek" data-testid="nowplaying-seek-row">
        <NowPlayingScrub
          onSeek={actions.seek}
          abRepeat={state.abRepeat}
          onSetABPointAt={actions.setABPointAt}
        />
      </div>
    </div>
  );
}
