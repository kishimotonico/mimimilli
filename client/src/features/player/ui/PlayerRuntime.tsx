import { useAtomValue } from "jotai";
import { useGlobalShortcuts } from "../../../app/model/useGlobalShortcuts";
import { playerIsActiveAtom } from "../model/atoms";
import { usePlayerActions } from "../model/usePlayerActions";
import { usePlayerRuntime } from "../model/usePlayer";

export default function PlayerRuntime() {
  usePlayerRuntime();
  const isActive = useAtomValue(playerIsActiveAtom);
  const actions = usePlayerActions();

  useGlobalShortcuts({
    onTogglePlay: actions.togglePlay,
    onSeekRelative: actions.seekRelative,
    isActive,
  });

  return null;
}
