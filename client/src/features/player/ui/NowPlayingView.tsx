// 再生中タブ本体。左カバー / 右トラックリストの横長2カラム + 下部固定バーで
// 再生機能一式（カバー・シーク・トランスポート・ABリピート・トラックリスト）を提供する。
// 既存の <dialog> 全画面プレイヤー（FullScreenPlayer）とは独立した並行実装で、
// 互いの表示・非表示を左右しない。
//
// 高頻度更新の currentTime/duration は NowPlayingScrub leaf だけが購読する
// （docs/HANDOFF.md の設計、他の leaf は usePlayerState() の core 投影のみ購読）。

import { useAtomValue } from "jotai";
import { playerIsActiveAtom } from "../../../entities/player/model/atoms";
import { usePlayerActions } from "../model/usePlayerActions";
import { usePlayerState } from "../model/usePlayerState";
import PlaybackArtwork from "./PlaybackArtwork";
import PlaybackErrorNotice from "./PlaybackErrorNotice";
import NowPlayingBar from "./NowPlayingBar";
import NowPlayingTrackList from "./NowPlayingTrackList";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";

interface NowPlayingViewProps {
  onOpenWork: (workId: string) => void;
}

const COVER_MAX_SIZE = 480;

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

  const { currentWork, isFilePlayback, tracks, currentTrackIndex, playbackError } = state;
  const track = tracks[currentTrackIndex] ?? null;

  return (
    <div className="mle-nowplaying">
      <div className="mle-nowplaying__body">
        <div className="mle-nowplaying__left">
          <div className="mle-nowplaying__cover-wrap">
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
          </div>

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
            onSelectTrack={actions.setTrackIndex}
          />
        </div>
      </div>

      <NowPlayingBar
        state={state}
        onSeek={actions.seek}
        onSetABPointAt={actions.setABPointAt}
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
    </div>
  );
}
