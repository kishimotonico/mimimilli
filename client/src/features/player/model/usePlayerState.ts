import { useAtomValue } from "jotai";
import { playerCoreAtom } from "../../../entities/player/model/atoms";
import type { PlayerCoreState } from "./playerController";

export type PlayerState = PlayerCoreState;

export function usePlayerState(): PlayerCoreState {
  return useAtomValue(playerCoreAtom);
}
