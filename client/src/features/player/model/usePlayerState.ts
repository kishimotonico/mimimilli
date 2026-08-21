import { useAtomValue } from "jotai";
import { playerCoreAtom } from "../../../entities/player/model/atoms";
import type { PlayerCoreState } from "../../../entities/player/model/playerCoreState";

export type PlayerState = PlayerCoreState;

export function usePlayerState(): PlayerCoreState {
  return useAtomValue(playerCoreAtom);
}
