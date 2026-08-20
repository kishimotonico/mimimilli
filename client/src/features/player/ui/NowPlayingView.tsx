// 再生中タブ本体。再生機能一式（カバー・シーク・トランスポート・ABリピート・トラックリスト）を
// 全画面級サーフェスとして提供する。既存の <dialog> 全画面プレイヤー（FullScreenPlayer）とは
// 独立した並行実装で、互いの表示・非表示を左右しない。
//
// 高頻度更新の currentTime/duration は NowPlayingScrub leaf だけが購読する
// （docs/HANDOFF.md の設計、他の leaf は usePlayerState() の core 投影のみ購読）。

import { useAtomValue } from "jotai";
import { playerIsActiveAtom } from "../../../entities/player/model/atoms";
import { usePlayerActions } from "../model/usePlayerActions";
import { usePlayerState } from "../model/usePlayerState";
import PlaybackArtwork from "./PlaybackArtwork";
import PlaybackErrorNotice from "./PlaybackErrorNotice";
import NowPlayingScrub from "./NowPlayingScrub";
import PlayerTransportControls from "./PlayerTransportControls";
import ABRepeatBar from "./ABRepeatBar";
import NowPlayingTrackList from "./NowPlayingTrackList";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";

interface NowPlayingViewProps {
  onOpenWork: (workId: string) => void;
}

export default function NowPlayingView({ onOpenWork }: NowPlayingViewProps) {
  const isActive = useAtomValue(playerIsActiveAtom);
  const state = usePlayerState();
  const actions = usePlayerActions();

  if (!isActive) {
    return (
      <div className="flex h-full flex-col">
        <CollectionStatus variant="list" kind="empty" message="再生中の作品はありません" />
      </div>
    );
  }

  const { currentWork, isFilePlayback, tracks, currentTrackIndex, abRepeat, playbackError } = state;
  const track = tracks[currentTrackIndex] ?? null;

  return (
    <div className="mx-auto flex h-full max-w-[560px] flex-col items-center overflow-y-auto px-6 py-10">
      <div className="h-[260px] w-[260px] shrink-0 overflow-hidden rounded-[10px] shadow-[var(--shadow-cover),0_30px_60px_-16px_oklch(20%_0.020_70/0.25)]">
        <PlaybackArtwork
          state={state}
          size={260}
          radius={10}
          requestWidth={selectFixedCoverThumbnailWidth(260, window.devicePixelRatio)}
        />
      </div>

      <div className="mt-6 flex w-full min-w-0 flex-col items-center gap-1.5 text-center">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          {isFilePlayback ? "ファイル" : currentWork!.title}
        </div>
        <h1 className="m-0 max-w-full text-balance font-jp text-[26px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink-0">
          {track?.title ?? "—"}
        </h1>
      </div>

      <PlaybackErrorNotice
        error={playbackError}
        className="mt-2 inline-flex min-w-0 max-w-full items-center gap-1 font-jp text-[10.5px] text-[var(--r-coral)]"
      />

      <div className="mt-6 w-full">
        <NowPlayingScrub
          onSeek={actions.seek}
          abRepeat={abRepeat}
          onSetABPointAt={actions.setABPointAt}
        />
      </div>

      <PlayerTransportControls
        isPlaying={state.isPlaying}
        volume={state.volume}
        loop={state.loop}
        channelSwap={state.channelSwap}
        onTogglePlay={actions.togglePlay}
        onSeekRelative={actions.seekRelative}
        onNext={actions.nextTrack}
        onPrev={actions.prevTrack}
        onSetLoop={actions.setLoop}
        onSetChannelSwap={actions.setChannelSwap}
        onSetVolume={actions.setVolume}
      />

      <ABRepeatBar
        abRepeat={abRepeat}
        onSetABPoint={actions.setABPoint}
        onClearABRepeat={actions.clearABRepeat}
      />

      {!isFilePlayback && currentWork && (
        <Button
          variant="ghost"
          icon={I.info}
          className="mt-6"
          onClick={() => onOpenWork(currentWork.id)}
        >
          この作品の詳細を見る
        </Button>
      )}

      <div className="w-full">
        <NowPlayingTrackList
          tracks={tracks}
          currentTrackIndex={currentTrackIndex}
          onSelectTrack={actions.setTrackIndex}
        />
      </div>
    </div>
  );
}
