import { useAtomValue } from "jotai";
import { playerIsActiveAtom } from "../../../entities/player/model/atoms";
import { usePlayerActions } from "../model/usePlayerActions";
import { usePlayerState } from "../model/usePlayerState";
import FullScreenPlayer from "./FullScreenPlayer";

export default function FullScreenPlayerGate() {
  const state = usePlayerState();
  const actions = usePlayerActions();
  const isActive = useAtomValue(playerIsActiveAtom);

  if (!isActive || !state.showFullPlayer) return null;

  return (
    <FullScreenPlayer
      state={state}
      onTogglePlay={actions.togglePlay}
      onSeek={actions.seek}
      onSeekRelative={actions.seekRelative}
      onSetVolume={actions.setVolume}
      onSetLoop={actions.setLoop}
      onNext={actions.nextTrack}
      onPrev={actions.prevTrack}
      onSelectTrack={actions.setTrackIndex}
      onClose={() => actions.setShowFullPlayer(false)}
      onStop={actions.stop}
      onSetChannelSwap={actions.setChannelSwap}
      onSetABPoint={actions.setABPoint}
      onClearABRepeat={actions.clearABRepeat}
    />
  );
}
