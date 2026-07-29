import { useAtomValue } from "jotai";
import { playerCoreAtom } from "./atoms";
import type { PlayerCoreState } from "./playerController";

export type PlayerState = PlayerCoreState;

export function usePlayerState(): PlayerCoreState {
  return useAtomValue(playerCoreAtom);
}
